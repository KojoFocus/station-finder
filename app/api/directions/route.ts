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
function distanceM(a: LatLng, b: LatLng): number {
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

// ─── DB name matching — always prefer our own data over external geocoding ────
type DbLocation = { id: string; name: string; latitude: number; longitude: number; description: string };

function matchLocationByName(locations: DbLocation[], query: string): DbLocation | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const scored = locations.map((l) => {
    const name = l.name.toLowerCase();
    let score = Infinity;
    if (name === q)                        score = 0; // exact
    else if (name.startsWith(q))           score = 1; // prefix
    else if (name.includes(q))             score = 2; // contains query
    else if (q.includes(name.split(" ")[0]) && name.split(" ")[0].length > 3) score = 3; // first word of name in query
    else {
      // any significant word match
      const qWords   = q.split(/\s+/).filter((w) => w.length > 3);
      const nameWords = name.split(/\s+/).filter((w) => w.length > 3);
      if (qWords.some((w) => name.includes(w)) || nameWords.some((w) => q.includes(w))) score = 4;
    }
    return { loc: l, score };
  })
  .filter((x) => x.score < Infinity)
  .sort((a, b) => a.score - b.score);

  return scored[0]?.loc ?? null;
}

function nearestLocation(locations: DbLocation[], coords: LatLng): DbLocation {
  return [...locations]
    .map((l) => ({ l, d: distanceM(coords, { lat: l.latitude, lng: l.longitude }) }))
    .sort((a, b) => a.d - b.d)[0].l;
}

// ─── Nominatim geocoding (fallback only) ─────────────────────────────────────
async function geocodeGhana(query: string): Promise<LatLng | null> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query + " Ghana")}` +
    `&format=json&limit=1&countrycodes=gh`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "StationFinder/1.0" } });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// ─── Turn instruction helpers ─────────────────────────────────────────────────
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
      if (modifier?.includes("left"))  return `Keep left${on}`;
      if (modifier?.includes("right")) return `Keep right${on}`;
      return `Continue${on}`;
    default:           return `Continue${on}`;
  }
}

function makeIcon(type: string, modifier: string): string {
  if (type === "arrive")                              return "🏁";
  if (type === "depart")                              return "↑";
  if (type === "roundabout" || type === "rotary")     return "⟳";
  if (modifier === "left"  || modifier === "sharp left")  return "←";
  if (modifier === "right" || modifier === "sharp right") return "→";
  if (modifier === "slight left")                     return "↖";
  if (modifier === "slight right")                    return "↗";
  if (modifier === "uturn")                           return "↩";
  return "↑";
}

// ─── OSRM walking route ───────────────────────────────────────────────────────
async function getWalkingRoute(from: LatLng, to: LatLng) {
  const url =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?steps=true&geometries=geojson&overview=full`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const osrmSteps = route.legs?.[0]?.steps ?? [];

    const steps: NavStep[] = osrmSteps
      .filter((s: Record<string, unknown>) => (s.distance as number) > 2)
      .map((s: Record<string, unknown>) => {
        const maneuver = s.maneuver as Record<string, unknown>;
        const loc = maneuver.location as [number, number];
        const type = (maneuver.type as string) ?? "continue";
        const modifier = (maneuver.modifier as string) ?? "straight";
        return {
          instruction: makeInstruction(type, modifier, (s.name as string) ?? ""),
          distanceM:    Math.round(s.distance as number),
          durationSecs: Math.round(s.duration as number),
          maneuverLat:  loc[1],
          maneuverLng:  loc[0],
          type,
          modifier,
          icon: makeIcon(type, modifier),
        };
      });

    return {
      geometry:     route.geometry,
      distanceM:    Math.round(route.distance),
      durationMins: Math.max(1, Math.round(route.duration / 60)),
      steps,
    };
  } catch {
    return null;
  }
}

// ─── Route finding: BFS — one DB query, guaranteed shortest path ──────────────
type RouteRowFull = {
  id: string; originId: string; destinationId: string;
  transitType: string; estimatedFare: number; durationMins: number; whatToLookFor: string;
  origin: DbLocation; destination: DbLocation;
};

async function findRoute(boardingId: string, alightingId: string): Promise<RouteRowFull[] | null> {
  if (boardingId === alightingId) return [];

  // Load entire route graph once
  const allRoutes = await prisma.route.findMany({
    include: { origin: true, destination: true },
  }) as RouteRowFull[];

  // Adjacency list
  const adj = new Map<string, RouteRowFull[]>();
  for (const r of allRoutes) {
    if (!adj.has(r.originId)) adj.set(r.originId, []);
    adj.get(r.originId)!.push(r);
  }

  // BFS — finds the fewest-hop path
  const visited = new Set<string>([boardingId]);
  const queue: { path: RouteRowFull[]; node: string }[] = [{ path: [], node: boardingId }];

  while (queue.length) {
    const { path, node } = queue.shift()!;
    for (const edge of adj.get(node) ?? []) {
      if (visited.has(edge.destinationId)) continue;
      const newPath = [...path, edge];
      if (edge.destinationId === alightingId) return newPath;
      visited.add(edge.destinationId);
      queue.push({ path: newPath, node: edge.destinationId });
    }
  }

  return null; // no connected path in graph
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function logSearch(destination: string, found: boolean, userLat?: number, userLng?: number) {
  prisma.searchLog.create({
    data: {
      destination: destination.trim().toLowerCase().slice(0, 200),
      found,
      userLat: userLat ?? null,
      userLng: userLng ?? null,
    },
  }).catch(() => {});
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { destination, userLat, userLng, fromAddress } = await req.json();
    if (!destination)
      return NextResponse.json({ error: "destination is required" }, { status: 400 });

    // Resolve user coordinates — default to Accra Central when nothing else known
    let userCoords: LatLng = { lat: userLat ?? 5.5698, lng: userLng ?? -0.2184 };
    if (fromAddress) {
      const geocoded = await geocodeGhana(fromAddress);
      if (!geocoded)
        return NextResponse.json(
          { error: `Couldn't find "${fromAddress}" in Ghana. Try a nearby landmark.` },
          { status: 404 }
        );
      userCoords = geocoded;
    }

    const locations = await prisma.location.findMany();

    // ── Boarding stop: nearest seeded location to user ────────────────────────
    const boardingStop = nearestLocation(locations, userCoords);

    // ── Alighting stop: match our DB by name FIRST — never trust Nominatim ────
    let alightingStop: DbLocation;
    let destCoords: LatLng;

    const dbMatch = matchLocationByName(locations, destination);
    if (dbMatch) {
      alightingStop = dbMatch;
      destCoords = { lat: dbMatch.latitude, lng: dbMatch.longitude };
    } else {
      // Unknown place — geocode and find nearest stop
      const geocoded = await geocodeGhana(destination);
      if (!geocoded) {
        logSearch(destination, false, userLat, userLng);
        return NextResponse.json(
          { error: `Couldn't find "${destination}" in Ghana. Try a landmark or area name.` },
          { status: 404 }
        );
      }
      destCoords = geocoded;
      alightingStop = nearestLocation(locations, destCoords);
    }

    // ── Walking route to boarding stop ────────────────────────────────────────
    const walking = await getWalkingRoute(userCoords, {
      lat: boardingStop.latitude,
      lng: boardingStop.longitude,
    });

    const walkDistM  = walking?.distanceM  ?? Math.round(distanceM(userCoords, { lat: boardingStop.latitude, lng: boardingStop.longitude }));
    const walkMins   = walking?.durationMins ?? Math.max(1, Math.round(walkDistM / 80));

    // ── Trotro route: BFS finds shortest path, any number of hops ────────────
    const routeLegs = boardingStop.id !== alightingStop.id
      ? await findRoute(boardingStop.id, alightingStop.id)
      : [];

    logSearch(destination, !!(routeLegs && routeLegs.length > 0), userLat, userLng);

    const legs: TrotroLeg[] = (routeLegs ?? []).map((r) => ({
      from:          r.origin.name,
      to:            r.destination.name,
      whatToLookFor: r.whatToLookFor,
      fare:          r.estimatedFare,
      durationMins:  r.durationMins,
      transitType:   r.transitType,
    }));

    return NextResponse.json({
      destCoords,
      boardingStop: {
        name:        boardingStop.name,
        lat:         boardingStop.latitude,
        lng:         boardingStop.longitude,
        description: boardingStop.description,
        distanceM:   walkDistM,
        walkingMins: walkMins,
      },
      walkingGeoJSON: walking?.geometry ?? null,
      steps:          walking?.steps ?? [],
      trotro: legs.length > 0 ? { legs } : null,
    } satisfies DirectionsResponse);
  } catch (err) {
    console.error("Directions error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
