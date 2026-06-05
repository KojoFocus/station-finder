import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest): boolean {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  return !!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Parse "Madina – 1.50 GHS, Circle – 3 GHS" → [{ dest: "Madina", fare: 1.5 }, ...]
function parseRoutes(text: string): { dest: string; fare: number }[] {
  if (!text || text === "Not specified") return [];
  return text
    .split(",")
    .map((p) => p.trim())
    .flatMap((part) => {
      const m = part.match(/^(.+?)\s*[–\-]\s*(\d+(?:[.,]\d+)?)\s*(?:GHS?|₵)?/i);
      if (!m) return [];
      const dest = m[1].trim();
      const fare = parseFloat(m[2].replace(",", "."));
      return dest.length >= 2 && !isNaN(fare) ? [{ dest, fare }] : [];
    });
}

// POST /api/admin/promote  { id: string }
// Promotes a VERIFIED CrowdsourcedStop into the live Location + Route tables.
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const stop = await prisma.crowdsourcedStop.findUnique({ where: { id } });
  if (!stop) return NextResponse.json({ error: "Stop not found" }, { status: 404 });
  if (stop.status !== "VERIFIED") {
    return NextResponse.json({ error: "Only VERIFIED stops can be promoted." }, { status: 400 });
  }

  // ── Check no live Location already exists within 50 m ──────────────────────
  const allLocations = await prisma.location.findMany({
    where: {
      latitude:  { gte: stop.latitude  - 0.001, lte: stop.latitude  + 0.001 },
      longitude: { gte: stop.longitude - 0.001, lte: stop.longitude + 0.001 },
    },
  });
  const nearby = allLocations.find(
    (l) => haversineM(stop.latitude, stop.longitude, l.latitude, l.longitude) < 50
  );
  if (nearby) {
    return NextResponse.json({
      error: `A live stop already exists within 50 m: "${nearby.name}". Merge or delete it first.`,
    }, { status: 409 });
  }

  // ── Create live Location ───────────────────────────────────────────────────
  const location = await prisma.location.create({
    data: {
      name:        stop.stopName,
      latitude:    stop.latitude,
      longitude:   stop.longitude,
      description: stop.routeHeading !== "Not specified"
        ? `Community stop. Routes: ${stop.routeHeading}`
        : `Community-mapped stop (${stop.votes} confirmation${stop.votes !== 1 ? "s" : ""})`,
    },
  });

  // ── Try to create Route records from parsed routeHeading ───────────────────
  const parsed    = parseRoutes(stop.routeHeading);
  const createdRoutes: string[] = [];

  for (const { dest, fare } of parsed) {
    const destLoc = await prisma.location.findFirst({
      where: { name: { contains: dest, mode: "insensitive" } },
    });
    if (!destLoc || destLoc.id === location.id) continue;

    const distM   = haversineM(stop.latitude, stop.longitude, destLoc.latitude, destLoc.longitude);
    const duration = Math.max(5, Math.round((distM / 1000) * 3)); // ~20 km/h trotro

    await prisma.route.create({
      data: {
        originId:      location.id,
        destinationId: destLoc.id,
        transitType:   "Trotro",
        estimatedFare: fare,
        whatToLookFor: `Trotro heading to ${destLoc.name}`,
        durationMins:  duration,
      },
    });
    createdRoutes.push(`${location.name} → ${destLoc.name} (₵${fare.toFixed(2)})`);
  }

  // ── Mark crowdsourced stop as promoted ────────────────────────────────────
  await prisma.crowdsourcedStop.update({
    where: { id },
    data:  { status: "PROMOTED" },
  });

  return NextResponse.json({
    location: location.name,
    routes:   createdRoutes,
    routesCreated: createdRoutes.length,
    unmatched: parsed.length - createdRoutes.length,
  });
}
