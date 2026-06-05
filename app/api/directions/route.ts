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
  icon: string; // arrow character for the UI
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
  trotro: {
    leg1: TrotroLeg;
    leg2: TrotroLeg | null;
  } | null;
}

interface TrotroLeg {
  from: string;
  to: string;
  whatToLookFor: string;
  fare: number;
  durationMins: number;
  transitType: string;
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

// ─── Nominatim geocoding ──────────────────────────────────────────────────────
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

// ─── Turn instruction generator ───────────────────────────────────────────────
function makeInstruction(type: string, modifier: string, name: string): string {
  const on = name ? ` on ${name}` : "";
  switch (type) {
    case "depart":     return `Walk ${modifier ?? ""}${on}`.trim();
    case "arrive":     return "You have arrived at the boarding stop";
    case "turn":
    case "end of road":
      if (modifier === "left")        return `Turn left${on}`;
      if (modifier === "right")       return `Turn right${on}`;
      if (modifier === "slight left") return `Keep slightly left${on}`;
      if (modifier === "slight right")return `Keep slightly right${on}`;
      if (modifier === "sharp left")  return `Turn sharp left${on}`;
      if (modifier === "sharp right") return `Turn sharp right${on}`;
      if (modifier === "uturn")       return `Make a U-turn${on}`;
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
      .filter((s: Record<string, unknown>) => (s.distance as number) > 2) // skip micro-steps
      .map((s: Record<string, unknown>) => {
        const maneuver = s.maneuver as Record<string, unknown>;
        const loc = maneuver.location as [number, number];
        const type = (maneuver.type as string) ?? "continue";
        const modifier = (maneuver.modifier as string) ?? "straight";
        return {
          instruction: makeInstruction(type, modifier, (s.name as string) ?? ""),
          distanceM:   Math.round(s.distance as number),
          durationSecs:Math.round(s.duration as number),
          maneuverLat: loc[1],
          maneuverLng: loc[0],
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

// ─── Analytics helper ─────────────────────────────────────────────────────────
function logSearch(destination: string, found: boolean, userLat?: number, userLng?: number) {
  prisma.searchLog.create({
    data: {
      destination: destination.trim().toLowerCase().slice(0, 200),
      found,
      userLat: userLat ?? null,
      userLng: userLng ?? null,
    },
  }).catch(() => { /* never break the app over analytics */ });
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { destination, userLat, userLng, fromAddress } = await req.json();
    if (!destination)
      return NextResponse.json({ error: "destination is required" }, { status: 400 });

    // Geocode the "from" address if provided, otherwise use GPS coords
    let userCoords: LatLng = { lat: userLat ?? 5.6863, lng: userLng ?? -0.1488 };
    if (fromAddress) {
      const geocoded = await geocodeGhana(fromAddress);
      if (!geocoded)
        return NextResponse.json(
          { error: `Couldn't find "${fromAddress}" in Ghana. Try a nearby landmark.` },
          { status: 404 }
        );
      userCoords = geocoded;
    }

    const destCoords = await geocodeGhana(destination);
    if (!destCoords) {
      logSearch(destination, false, userLat, userLng);
      return NextResponse.json(
        { error: `Couldn't find "${destination}" in Ghana. Try a landmark or area name.` },
        { status: 404 }
      );
    }

    const locations = await prisma.location.findMany();

    const boardingStop = locations
      .map((l) => ({ ...l, dist: distanceM(userCoords, { lat: l.latitude, lng: l.longitude }) }))
      .sort((a, b) => a.dist - b.dist)[0];

    const alightingStop = locations
      .map((l) => ({ ...l, dist: distanceM(destCoords, { lat: l.latitude, lng: l.longitude }) }))
      .sort((a, b) => a.dist - b.dist)[0];

    const walking = await getWalkingRoute(userCoords, {
      lat: boardingStop.latitude,
      lng: boardingStop.longitude,
    });

    const walkDistM  = walking?.distanceM  ?? Math.round(boardingStop.dist);
    const walkMins   = walking?.durationMins ?? Math.max(1, Math.round(walkDistM / 80));

    let trotroLeg1 = null, trotroLeg2 = null;
    if (boardingStop.id !== alightingStop.id) {
      trotroLeg1 = await prisma.route.findFirst({
        where: { originId: boardingStop.id, destinationId: alightingStop.id },
        include: { origin: true, destination: true },
      });
      if (!trotroLeg1) {
        const firstLegs = await prisma.route.findMany({
          where: { originId: boardingStop.id },
          include: { origin: true, destination: true },
        });
        for (const l1 of firstLegs) {
          const l2 = await prisma.route.findFirst({
            where: { originId: l1.destinationId, destinationId: alightingStop.id },
            include: { origin: true, destination: true },
          });
          if (l2) { trotroLeg1 = l1; trotroLeg2 = l2; break; }
        }
      }
    }

    logSearch(destination, !!trotroLeg1, userLat, userLng);

    return NextResponse.json({
      destCoords,
      boardingStop: {
        name: boardingStop.name,
        lat: boardingStop.latitude,
        lng: boardingStop.longitude,
        description: boardingStop.description,
        distanceM: walkDistM,
        walkingMins: walkMins,
      },
      walkingGeoJSON: walking?.geometry ?? null,
      steps: walking?.steps ?? [],
      trotro: trotroLeg1 ? {
        leg1: {
          from: trotroLeg1.origin.name,
          to:   trotroLeg1.destination.name,
          whatToLookFor: trotroLeg1.whatToLookFor,
          fare: trotroLeg1.estimatedFare,
          durationMins: trotroLeg1.durationMins,
          transitType:  trotroLeg1.transitType,
        },
        leg2: trotroLeg2 ? {
          from: trotroLeg2.origin.name,
          to:   trotroLeg2.destination.name,
          whatToLookFor: trotroLeg2.whatToLookFor,
          fare: trotroLeg2.estimatedFare,
          durationMins: trotroLeg2.durationMins,
          transitType:  trotroLeg2.transitType,
        } : null,
      } : null,
    } satisfies DirectionsResponse);
  } catch (err) {
    console.error("Directions error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
