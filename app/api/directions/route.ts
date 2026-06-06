import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type LatLng = { lat: number; lng: number };

export interface NavStep {
  instruction: string;
  distanceM: number;
  durationSecs: number;
  maneuverLat: number;
  maneuverLng: number;
  type: string;
  modifier: string;
  icon: string;
}

export interface TrotroLeg {
  from: string;
  to: string;
  whatToLookFor: string;
  fare: number;
  durationMins: number;
  transitType: string;
}

export interface DirectionsResponse {
  destCoords: LatLng;
  boardingStop: {
    name: string;
    lat: number;
    lng: number;
    description: string;
    distanceM: number;
    walkingMins: number;
  };
  walkingGeoJSON: object | null;
  steps: NavStep[];
  trotro: { legs: TrotroLeg[] } | null;
}

// ─── Haversine ────────────────────────────────────────────────────────────────
function distM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// ─── DB location types ────────────────────────────────────────────────────────
type Loc = { id: string; name: string; latitude: number; longitude: number; description: string };
type Route = { id: string; originId: string; destinationId: string; transitType: string; estimatedFare: number; durationMins: number; whatToLookFor: string };

// ─── DB name match — always prefer our data over Nominatim ───────────────────
function matchByName(locs: Loc[], query: string): Loc | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return locs
    .map((l) => {
      const n = l.name.toLowerCase();
      let s = Infinity;
      if (n === q)                                                             s = 0;
      else if (n.startsWith(q) || q.startsWith(n.split(" ")[0]))             s = 1;
      else if (n.includes(q) || q.includes(n.split(" ")[0]))                 s = 2;
      else if (q.split(/\s+/).some((w) => w.length > 3 && n.includes(w)) ||
               n.split(/\s+/).some((w) => w.length > 3 && q.includes(w)))   s = 3;
      return { l, s };
    })
    .filter((x) => x.s < Infinity)
    .sort((a, b) => a.s - b.s)[0]?.l ?? null;
}

function nearest(locs: Loc[], coords: LatLng): Loc {
  return [...locs].sort((a, b) =>
    distM(coords, { lat: a.latitude, lng: a.longitude }) -
    distM(coords, { lat: b.latitude, lng: b.longitude })
  )[0];
}

// ─── Nominatim geocoding (fallback only) ─────────────────────────────────────
async function geocode(query: string): Promise<LatLng | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " Ghana")}&format=json&limit=1&countrycodes=gh`,
      { headers: { "User-Agent": "StationFinder/1.0" } }
    );
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// ─── Turn instructions ────────────────────────────────────────────────────────
function makeInstruction(type: string, modifier: string, name: string): string {
  const on = name ? ` on ${name}` : "";
  switch (type) {
    case "depart":     return `Walk ${modifier ?? ""}${on}`.trim();
    case "arrive":     return "You have arrived at the boarding stop";
    case "turn":
    case "end of road":
      if (modifier === "left")         return `Turn left${on}`;
      if (modifier === "right")        return `Turn right${on}`;
      if (modifier === "slight left")  return `Keep slightly left${on}`;
      if (modifier === "slight right") return `Keep slightly right${on}`;
      if (modifier === "sharp left")   return `Turn sharp left${on}`;
      if (modifier === "sharp right")  return `Turn sharp right${on}`;
      if (modifier === "uturn")        return `Make a U-turn${on}`;
      return `Continue${on}`;
    case "new name":
    case "continue":   return `Continue straight${on}`;
    case "roundabout":
    case "rotary":     return `Enter the roundabout${on}`;
    case "exit roundabout":
    case "exit rotary":return `Exit the roundabout${on}`;
    case "fork":
      return modifier?.includes("left") ? `Keep left${on}` : modifier?.includes("right") ? `Keep right${on}` : `Continue${on}`;
    default:           return `Continue${on}`;
  }
}

function makeIcon(type: string, modifier: string): string {
  if (type === "arrive")                               return "🏁";
  if (type === "depart")                               return "↑";
  if (type === "roundabout" || type === "rotary")      return "⟳";
  if (modifier === "left"  || modifier === "sharp left")  return "←";
  if (modifier === "right" || modifier === "sharp right") return "→";
  if (modifier === "slight left")                      return "↖";
  if (modifier === "slight right")                     return "↗";
  if (modifier === "uturn")                            return "↩";
  return "↑";
}

// ─── OSRM walking route ───────────────────────────────────────────────────────
async function getWalking(from: LatLng, to: LatLng) {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?steps=true&geometries=geojson&overview=full`
    );
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const steps: NavStep[] = (route.legs?.[0]?.steps ?? [])
      .filter((s: Record<string, unknown>) => (s.distance as number) > 2)
      .map((s: Record<string, unknown>) => {
        const m = s.maneuver as Record<string, unknown>;
        const loc = m.location as [number, number];
        const type = (m.type as string) ?? "continue";
        const modifier = (m.modifier as string) ?? "straight";
        return {
          instruction: makeInstruction(type, modifier, (s.name as string) ?? ""),
          distanceM:    Math.round(s.distance as number),
          durationSecs: Math.round(s.duration as number),
          maneuverLat:  loc[1], maneuverLng: loc[0],
          type, modifier,
          icon: makeIcon(type, modifier),
        };
      });
    return { geometry: route.geometry, distanceM: Math.round(route.distance), durationMins: Math.max(1, Math.round(route.duration / 60)), steps };
  } catch { return null; }
}

// ─── BFS — in-memory, guaranteed shortest path ───────────────────────────────
function bfs(routes: Route[], fromId: string, toId: string): Route[] | null {
  if (fromId === toId) return [];
  const adj = new Map<string, Route[]>();
  for (const r of routes) {
    if (!adj.has(r.originId)) adj.set(r.originId, []);
    adj.get(r.originId)!.push(r);
  }
  const visited = new Set<string>([fromId]);
  const queue: { path: Route[]; node: string }[] = [{ path: [], node: fromId }];
  while (queue.length) {
    const { path, node } = queue.shift()!;
    for (const edge of adj.get(node) ?? []) {
      if (visited.has(edge.destinationId)) continue;
      const newPath = [...path, edge];
      if (edge.destinationId === toId) return newPath;
      visited.add(edge.destinationId);
      queue.push({ path: newPath, node: edge.destinationId });
    }
  }
  return null;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function logSearch(destination: string, found: boolean, userLat?: number, userLng?: number) {
  prisma.searchLog.create({
    data: { destination: destination.trim().toLowerCase().slice(0, 200), found, userLat: userLat ?? null, userLng: userLng ?? null },
  }).catch(() => {});
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { destination, userLat, userLng, fromAddress } = await req.json();
    if (!destination)
      return NextResponse.json({ error: "destination is required" }, { status: 400 });

    // Load all locations + routes in parallel (one round-trip to DB)
    const [locations, allRoutes] = await Promise.all([
      prisma.location.findMany(),
      prisma.route.findMany(),
    ]);

    const locMap = new Map(locations.map((l) => [l.id, l]));

    // ── Resolve user coordinates: DB match first, then geocode ────────────────
    let userCoords: LatLng = { lat: userLat ?? 5.5698, lng: userLng ?? -0.2184 };
    if (fromAddress) {
      const dbOrigin = matchByName(locations, fromAddress);
      if (dbOrigin) {
        userCoords = { lat: dbOrigin.latitude, lng: dbOrigin.longitude };
      } else {
        const geo = await geocode(fromAddress);
        if (!geo)
          return NextResponse.json({ error: `Couldn't find "${fromAddress}" in Ghana. Try a nearby landmark.` }, { status: 404 });
        userCoords = geo;
      }
    }

    // ── Boarding stop: nearest to user ────────────────────────────────────────
    const boardingStop = nearest(locations, userCoords);

    // ── Alighting stop: DB name match first, then geocode ─────────────────────
    let alightingStop: Loc;
    let destCoords: LatLng;
    const dbDest = matchByName(locations, destination);
    if (dbDest) {
      alightingStop = dbDest;
      destCoords = { lat: dbDest.latitude, lng: dbDest.longitude };
    } else {
      const geo = await geocode(destination);
      if (!geo) {
        logSearch(destination, false, userLat, userLng);
        return NextResponse.json({ error: `Couldn't find "${destination}" in Ghana. Try a landmark or area name.` }, { status: 404 });
      }
      destCoords = geo;
      alightingStop = nearest(locations, destCoords);
    }

    // ── Walking route to boarding stop (async, doesn't block BFS) ────────────
    const [walking] = await Promise.all([
      getWalking(userCoords, { lat: boardingStop.latitude, lng: boardingStop.longitude }),
    ]);

    const walkDistM  = walking?.distanceM  ?? Math.round(distM(userCoords, { lat: boardingStop.latitude, lng: boardingStop.longitude }));
    const walkMins   = walking?.durationMins ?? Math.max(1, Math.round(walkDistM / 80));

    // ── BFS — find shortest trotro path ───────────────────────────────────────
    const path = boardingStop.id !== alightingStop.id
      ? bfs(allRoutes, boardingStop.id, alightingStop.id)
      : [];

    const legs: TrotroLeg[] = (path ?? []).map((r) => {
      const o = locMap.get(r.originId)!;
      const d = locMap.get(r.destinationId)!;
      return { from: o.name, to: d.name, whatToLookFor: r.whatToLookFor, fare: r.estimatedFare, durationMins: r.durationMins, transitType: r.transitType };
    });

    logSearch(destination, legs.length > 0, userLat, userLng);

    return NextResponse.json({
      destCoords,
      boardingStop: { name: boardingStop.name, lat: boardingStop.latitude, lng: boardingStop.longitude, description: boardingStop.description, distanceM: walkDistM, walkingMins: walkMins },
      walkingGeoJSON: walking?.geometry ?? null,
      steps: walking?.steps ?? [],
      trotro: legs.length > 0 ? { legs } : null,
    } satisfies DirectionsResponse);
  } catch (err) {
    console.error("Directions error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
