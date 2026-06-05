import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public GeoJSON feed of all verified/promoted crowdsourced stops
export async function GET() {
  try {
    const stops = await prisma.crowdsourcedStop.findMany({
      where:  { status: { in: ["VERIFIED", "PROMOTED"] } },
      select: { id: true, stopName: true, latitude: true, longitude: true, routeHeading: true, status: true },
    });

    return NextResponse.json({
      type: "FeatureCollection",
      features: stops.map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
        properties: { id: s.id, stopName: s.stopName, routeHeading: s.routeHeading, status: s.status },
      })),
    });
  } catch {
    return NextResponse.json({ type: "FeatureCollection", features: [] });
  }
}
