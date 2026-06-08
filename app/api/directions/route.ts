import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

export interface AlternateRoute {
  legs: TrotroLeg[];
  totalMins: number;
  totalFare: number;
}

export interface DirectionsResponse {
  routeFound: boolean;
  aiGuidance: string | null;
  alternateTrotro: AlternateRoute | null;
  destCoords: LatLng;
  boardingStop: {
    name: string; lat: number; lng: number;
    description: string; distanceM: number; walkingMins: number;
  };
  alightingStop: { name: string; lat: number; lng: number } | null;
  finalWalk: { distanceM: number; walkingMins: number } | null;
  walkingGeoJSON: object | null;
  steps: NavStep[];
  trotro: {
    legs: TrotroLeg[];
    totalMins: number;
    alternateNote: string | null;
  } | null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Loc   = { id: string; name: string; latitude: number; longitude: number; description: string };
type Route = { id: string; originId: string; destinationId: string; transitType: string; estimatedFare: number; durationMins: number; whatToLookFor: string };

// ─── Haversine ────────────────────────────────────────────────────────────────
function distM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// ─── Alias table — common nicknames → canonical location name fragment ────────
const ALIASES: Record<string, string> = {
  // Circle / Accra Central
  "circle":            "Accra Central",
  "accra central":     "Accra Central",
  "kwame nkrumah":     "Accra Central",
  "nkrumah circle":    "Accra Central",
  "accra":             "Accra Central",
  // Legon
  "ug":                "Legon",
  "university":        "Legon",
  "university of ghana": "Legon",
  "legon campus":      "Legon",
  // 37
  "37":                "37 Military",
  "37 hospital":       "37 Military",
  "military hospital": "37 Military",
  "liberation road":   "37 Military",
  // STC / intercity
  "stc":               "Accra STC",
  "stc terminal":      "Accra STC",
  "vip":               "Accra STC",
  "intercity":         "Accra STC",
  // Airport
  "airport":           "Airport",
  "kotoka":            "Airport",
  "kia":               "Airport",
  // Osu
  "osu":               "Osu",
  "oxford street":     "Osu",
  "danquah":           "Osu",
  // Kaneshie
  "kaneshie market":   "Kaneshie",
  "kaneshie":          "Kaneshie",
  // Madina
  "madina zongo":      "Madina",
  "zongo junction":    "Madina",
  // Tema
  "comm 1":            "Tema Station",
  "community 1":       "Tema Station",
  "tema comm":         "Tema Station",
  // Lapaz / Achimota
  "lapaz":             "Lapaz",
  "achimota":          "Achimota",
  // Atomic
  "atomic":            "Atomic Junction",
  "gaec":              "Atomic Junction",
  // East Legon
  "east legon":        "East Legon",
  "bawaleshie":        "East Legon",
  // Adenta
  "adenta":            "Adenta",
  "adenta barrier":    "Adenta",
  // Spintex
  "spintex":           "Spintex",
  "coca cola":         "Spintex",
  // Kasoa
  "kasoa":             "Kasoa",
  // Cape Coast
  "cape coast":        "Cape Coast",
  "cc":                "Cape Coast",
  // Kumasi
  "kumasi":            "Kumasi",
  "kejetia":           "Kumasi",
  "adum":              "Kumasi",
  // Nungua
  "nungua":            "Nungua",
  // Teshie
  "teshie":            "Teshie",
  "lascala":           "Teshie",
  // Ashaiman
  "ashaiman":          "Ashaiman",
  // Abossey Okai
  "abossey":           "Abossey Okai",
  "spare parts":       "Abossey Okai",
  // Pokuase
  "pokuase":           "Pokuase",
  // Dome
  "dome":              "Dome",
  // Haatso
  "haatso":            "Haatso",
  // Nima
  "nima":              "Nima",
  // Tudu
  "tudu":              "Tudu",
  "makola":            "Tudu",
  // Agbogbloshie
  "agbogbloshie":      "Agbogbloshie",
  "agbo":              "Agbogbloshie",
  "abattoir":          "Agbogbloshie",
  // Bolgatanga
  "bolga":             "Bolgatanga",
  "bolgatanga":        "Bolgatanga",
  // Tamale
  "tamale":            "Tamale",
  // Ho
  "ho":                "Ho Main",
  "volta":             "Ho Main",
  // Koforidua
  "koforidua":         "Koforidua",
  "kof":               "Koforidua",
  // Wa
  "wa":                "Wa Central",
  // Sunyani
  "sunyani":           "Sunyani",
  // Takoradi
  "takoradi":          "Takoradi",
  "sekondi":           "Takoradi",
  // Winneba
  "winneba":           "Winneba",
  // Nsawam
  "nsawam":            "Nsawam",
  // Aburi
  "aburi":             "Aburi",
  "aburi gardens":     "Aburi",
  // Mallam
  "mallam":            "Mallam",
  // Dansoman
  "dansoman":          "Dansoman",
  "eschol":            "Dansoman",
  // Darkuman
  "darkuman":          "Darkuman",
  // Korle-Bu
  "korle bu":          "Korle-Bu",
  "korle-bu":          "Korle-Bu",
  // Weija
  "weija":             "Weija",
  "west hills":        "Weija",
  // Amasaman
  "amasaman":          "Amasaman",
  // Ofankor
  "ofankor":           "Ofankor",
  // Tesano
  "tesano":            "Tesano",
  "abeka":             "Tesano",
  // Bubuashie
  "bubuashie":         "Bubuashie",
  // Kanda
  "kanda":             "Kanda",
};

function resolveAlias(query: string): string {
  const q = query.trim().toLowerCase();
  if (ALIASES[q]) return ALIASES[q];
  // "stc bus station" → key "stc" is a prefix word of the query
  for (const [key, val] of Object.entries(ALIASES)) {
    if (key.length >= 2 && (q.startsWith(key + " ") || q.startsWith(key + ","))) return val;
  }
  // query contains a key as a whole token (only for keys ≥ 4 chars to avoid false positives)
  for (const [key, val] of Object.entries(ALIASES)) {
    if (key.length >= 4 && new RegExp(`\\b${key}\\b`).test(q)) return val;
  }
  return query;
}

// ─── DB name match ────────────────────────────────────────────────────────────
function matchByName(locs: Loc[], query: string): Loc | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return locs
    .map((l) => {
      const n = l.name.toLowerCase();
      let s = Infinity;
      if (n === q)                                                                          s = 0;
      else if (n.startsWith(q) || q.startsWith(n.split(" ")[0]))                          s = 1;
      else if (n.includes(q) || q.includes(n.split(" ")[0]))                              s = 2;
      else if (q.split(/\s+/).some((w) => w.length > 3 && n.includes(w)) ||
               n.split(/\s+/).some((w) => w.length > 3 && q.includes(w)))                s = 3;
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

// ─── Nominatim geocoding ──────────────────────────────────────────────────────
async function geocode(query: string): Promise<LatLng | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " Ghana")}&format=json&limit=1&countrycodes=gh`,
      { headers: { "User-Agent": "StationFinder/1.0" } }
    );
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

// ─── Dijkstra — fastest total time ───────────────────────────────────────────
function dijkstra(routes: Route[], fromId: string, toId: string): Route[] | null {
  if (fromId === toId) return [];
  const adj = new Map<string, Route[]>();
  for (const r of routes) {
    if (!adj.has(r.originId)) adj.set(r.originId, []);
    adj.get(r.originId)!.push(r);
  }
  const cost  = new Map<string, number>([[fromId, 0]]);
  const prev  = new Map<string, Route | null>([[fromId, null]]);
  const queue: { id: string; c: number }[] = [{ id: fromId, c: 0 }];

  while (queue.length) {
    queue.sort((a, b) => a.c - b.c);
    const { id: curr, c } = queue.shift()!;
    if (curr === toId) break;
    if (c > (cost.get(curr) ?? Infinity)) continue;
    for (const edge of adj.get(curr) ?? []) {
      const nc = c + edge.durationMins;
      if (nc < (cost.get(edge.destinationId) ?? Infinity)) {
        cost.set(edge.destinationId, nc);
        prev.set(edge.destinationId, edge);
        queue.push({ id: edge.destinationId, c: nc });
      }
    }
  }

  if (!prev.has(toId)) return null;
  const path: Route[] = [];
  let curr = toId;
  while (curr !== fromId) {
    const edge = prev.get(curr);
    if (!edge) return null;
    path.unshift(edge);
    curr = edge.originId;
  }
  return path;
}

// ─── BFS — fewest hops ───────────────────────────────────────────────────────
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
      const np = [...path, edge];
      if (edge.destinationId === toId) return np;
      visited.add(edge.destinationId);
      queue.push({ path: np, node: edge.destinationId });
    }
  }
  return null;
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
    case "exit rotary": return `Exit the roundabout${on}`;
    case "fork":
      return modifier?.includes("left") ? `Keep left${on}` : modifier?.includes("right") ? `Keep right${on}` : `Continue${on}`;
    default: return `Continue${on}`;
  }
}

function makeIcon(type: string, modifier: string): string {
  if (type === "arrive")                                return "🏁";
  if (type === "depart")                                return "↑";
  if (type === "roundabout" || type === "rotary")       return "⟳";
  if (modifier === "left"  || modifier === "sharp left")  return "←";
  if (modifier === "right" || modifier === "sharp right") return "→";
  if (modifier === "slight left")                       return "↖";
  if (modifier === "slight right")                      return "↗";
  if (modifier === "uturn")                             return "↩";
  return "↑";
}

// ─── OSRM walking ─────────────────────────────────────────────────────────────
async function getWalking(from: LatLng, to: LatLng) {
  try {
    const res  = await fetch(`https://router.project-osrm.org/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?steps=true&geometries=geojson&overview=full`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const steps: NavStep[] = (route.legs?.[0]?.steps ?? [])
      .filter((s: Record<string, unknown>) => (s.distance as number) > 2)
      .map((s: Record<string, unknown>) => {
        const m  = s.maneuver as Record<string, unknown>;
        const lc = m.location as [number, number];
        const type     = (m.type as string)     ?? "continue";
        const modifier = (m.modifier as string) ?? "straight";
        return { instruction: makeInstruction(type, modifier, (s.name as string) ?? ""), distanceM: Math.round(s.distance as number), durationSecs: Math.round(s.duration as number), maneuverLat: lc[1], maneuverLng: lc[0], type, modifier, icon: makeIcon(type, modifier) };
      });
    return { geometry: route.geometry, distanceM: Math.round(route.distance), durationMins: Math.max(1, Math.round(route.duration / 60)), steps };
  } catch { return null; }
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function logSearch(destination: string, found: boolean, userLat?: number, userLng?: number) {
  prisma.searchLog.create({ data: { destination: destination.trim().toLowerCase().slice(0, 200), found, userLat: userLat ?? null, userLng: userLng ?? null } }).catch(() => {});
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { destination, userLat, userLng, fromAddress } = await req.json();
    if (!destination) return NextResponse.json({ error: "destination is required" }, { status: 400 });

    const [locations, allRoutes] = await Promise.all([
      prisma.location.findMany(),
      prisma.route.findMany(),
    ]);
    const locMap = new Map(locations.map((l) => [l.id, l]));

    // ── Resolve user location ─────────────────────────────────────────────────
    let userCoords: LatLng = { lat: userLat ?? 5.5698, lng: userLng ?? -0.2184 };
    if (fromAddress) {
      const dbOrigin = matchByName(locations, resolveAlias(fromAddress));
      if (dbOrigin) {
        userCoords = { lat: dbOrigin.latitude, lng: dbOrigin.longitude };
      } else {
        const geo = await geocode(fromAddress);
        if (!geo) return NextResponse.json({ error: `Couldn't find "${fromAddress}" in Ghana.` }, { status: 404 });
        userCoords = geo;
      }
    }

    const boardingStop = nearest(locations, userCoords);

    // ── Resolve destination ───────────────────────────────────────────────────
    let alightingStop: Loc;
    let destCoords: LatLng;
    let destWasGeocoded = false;

    const dbDest = matchByName(locations, resolveAlias(destination));
    if (dbDest) {
      alightingStop = dbDest;
      destCoords = { lat: dbDest.latitude, lng: dbDest.longitude };
    } else {
      const geo = await geocode(destination);
      if (!geo) {
        logSearch(destination, false, userLat, userLng);
        return NextResponse.json({ error: `Couldn't find "${destination}" in Ghana.` }, { status: 404 });
      }
      destCoords = geo;
      alightingStop = nearest(locations, destCoords);
      destWasGeocoded = true;
    }

    // ── Walk to boarding stop ─────────────────────────────────────────────────
    const walking = await getWalking(userCoords, { lat: boardingStop.latitude, lng: boardingStop.longitude });
    const walkDistM = walking?.distanceM ?? Math.round(distM(userCoords, { lat: boardingStop.latitude, lng: boardingStop.longitude }));
    const walkMins  = walking?.durationMins ?? Math.max(1, Math.round(walkDistM / 80));

    // ── Route finding: Dijkstra (fastest) + BFS (fewest hops) ────────────────
    const fastPath = boardingStop.id !== alightingStop.id ? dijkstra(allRoutes, boardingStop.id, alightingStop.id) : [];
    const hopPath  = boardingStop.id !== alightingStop.id ? bfs(allRoutes,      boardingStop.id, alightingStop.id) : [];

    const primary = fastPath;

    // Build legs from primary path
    const legs: TrotroLeg[] = (primary ?? []).map((r) => {
      const o = locMap.get(r.originId)!;
      const d = locMap.get(r.destinationId)!;
      return { from: o.name, to: d.name, whatToLookFor: r.whatToLookFor, fare: r.estimatedFare, durationMins: r.durationMins, transitType: r.transitType };
    });

    const totalMins = legs.reduce((s, l) => s + l.durationMins, 0);

    // Build alternate route (BFS fewest-hops) as proper legs when it meaningfully differs
    let alternateTrotro: AlternateRoute | null = null;
    if (hopPath && fastPath && hopPath.length < fastPath.length) {
      const altLegs: TrotroLeg[] = hopPath.map((r) => {
        const o = locMap.get(r.originId)!;
        const d = locMap.get(r.destinationId)!;
        return { from: o.name, to: d.name, whatToLookFor: r.whatToLookFor, fare: r.estimatedFare, durationMins: r.durationMins, transitType: r.transitType };
      });
      const altMins = altLegs.reduce((s, l) => s + l.durationMins, 0);
      const altFare = altLegs.reduce((s, l) => s + l.fare, 0);
      if (Math.abs(altMins - totalMins) >= 5) {
        alternateTrotro = { legs: altLegs, totalMins: altMins, totalFare: altFare };
      }
    }
    const alternateNote = alternateTrotro
      ? `Fewer transfers: ${alternateTrotro.legs.length} hop${alternateTrotro.legs.length !== 1 ? "s" : ""} (~${alternateTrotro.totalMins} min)`
      : null;

    // ── Final walk from alighting stop to true destination ────────────────────
    let finalWalk: { distanceM: number; walkingMins: number } | null = null;
    if (destWasGeocoded && alightingStop) {
      const fd = Math.round(distM({ lat: alightingStop.latitude, lng: alightingStop.longitude }, destCoords));
      if (fd > 150) {
        finalWalk = { distanceM: fd, walkingMins: Math.max(1, Math.round(fd / 80)) };
      }
    }

    logSearch(destination, legs.length > 0, userLat, userLng);

    // ── AI guidance fallback when DB has no route ─────────────────────────────
    let aiGuidance: string | null = null;
    if (legs.length === 0) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        const result = await model.generateContent(
          `You are a friendly local trotro guide in Accra, Ghana. Someone near ${boardingStop.name} wants to get to "${destination}".
Using your knowledge of Accra's trotro network, give them warm, practical directions in 2–3 sentences.
Mention real station names, what the mate typically calls out, and a rough fare range if you know it.
If you're not certain, frame it naturally — "you'll likely need to..." or "ask at the station for...".
Write like a helpful local, not a robot. No bullet points, no markdown, no headers.`
        );
        aiGuidance = result.response.text().trim();
      } catch { /* leave null — client shows fallback */ }
    }

    return NextResponse.json({
      routeFound: legs.length > 0,
      aiGuidance,
      alternateTrotro,
      destCoords,
      boardingStop: { name: boardingStop.name, lat: boardingStop.latitude, lng: boardingStop.longitude, description: boardingStop.description, distanceM: walkDistM, walkingMins: walkMins },
      alightingStop: alightingStop ? { name: alightingStop.name, lat: alightingStop.latitude, lng: alightingStop.longitude } : null,
      finalWalk,
      walkingGeoJSON: walking?.geometry ?? null,
      steps: walking?.steps ?? [],
      trotro: legs.length > 0 ? { legs, totalMins, alternateNote } : null,
    } satisfies DirectionsResponse);
  } catch (err) {
    console.error("Directions error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
