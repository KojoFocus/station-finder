import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Pull the first number out of a routes string like "Madina – 1.50 GHS, Circle – 3 GHS"
function parseFare(routes: string): number {
  const m = routes.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

// ── GET /api/map-it?submitterId=X ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const submitterId = req.nextUrl.searchParams.get("submitterId");
  if (!submitterId?.trim()) {
    return NextResponse.json({ error: "Missing submitterId." }, { status: 400 });
  }
  try {
    const stops = await prisma.crowdsourcedStop.findMany({
      where:   { submitterId: submitterId.trim() },
      orderBy: { createdAt: "desc" },
      take:    50,
    });
    const points = stops.length * 10 + stops.filter((s) => s.status === "VERIFIED" || s.status === "PROMOTED").length * 10;
    return NextResponse.json({ stops, points });
  } catch (err) {
    console.error("[map-it GET]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// ── POST /api/map-it ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { latitude, longitude, stopName, routes = "", submitterId } = body as {
      latitude: unknown;
      longitude: unknown;
      stopName: unknown;
      routes: unknown;
      submitterId: unknown;
    };

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (
      typeof latitude    !== "number" ||
      typeof longitude   !== "number" ||
      typeof stopName    !== "string" || !stopName.trim() ||
      typeof submitterId !== "string" || !submitterId.trim()
    ) {
      return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
    }

    // ── Rate limit: max 10 submissions per submitterId per hour ───────────────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.crowdsourcedStop.count({
      where: {
        submitterId: submitterId.trim(),
        createdAt:   { gte: oneHourAgo },
      },
    });
    if (recentCount >= 10) {
      return NextResponse.json(
        { error: "Chale, slow down! You've hit the limit of 10 stops per hour. Come back later." },
        { status: 429 }
      );
    }

    // Rough Ghana bounding box to catch obvious spoofed coordinates
    if (latitude < 4.5 || latitude > 11.5 || longitude < -3.5 || longitude > 1.5) {
      return NextResponse.json(
        { error: "Coordinates appear to be outside Ghana. Are you on a VPN?" },
        { status: 400 }
      );
    }

    // ── Proximity check ───────────────────────────────────────────────────────
    // ±0.0006° ≈ ±67m bounding box to pre-filter, then precise 50m haversine
    const DELTA = 0.0006;
    const candidates = await prisma.crowdsourcedStop.findMany({
      where: {
        latitude:  { gte: latitude  - DELTA, lte: latitude  + DELTA },
        longitude: { gte: longitude - DELTA, lte: longitude + DELTA },
      },
    });

    const nearby = candidates.find(
      (s) => haversineM(latitude, longitude, s.latitude, s.longitude) < 50
    );

    // ── Duplicate from the same device ────────────────────────────────────────
    if (nearby && nearby.submitterId === submitterId) {
      return NextResponse.json({
        action: "duplicate",
        message: "You already submitted this stop! Get a friend nearby to confirm it.",
      });
    }

    // ── Existing stop from a different commuter → vote ────────────────────────
    if (nearby) {
      const newVotes  = nearby.votes + 1;
      const newStatus = newVotes >= 3 && nearby.status === "PENDING" ? "VERIFIED" : nearby.status;

      await prisma.crowdsourcedStop.update({
        where: { id: nearby.id },
        data:  { votes: newVotes, status: newStatus },
      });

      return NextResponse.json({
        action: newStatus === "VERIFIED" ? "verified" : "voted",
        votes:  newVotes,
        stopName: nearby.stopName,
      });
    }

    // ── New stop → create ─────────────────────────────────────────────────────
    const routesStr = typeof routes === "string" ? routes : "";

    await prisma.crowdsourcedStop.create({
      data: {
        stopName:      stopName.trim().slice(0, 120),
        latitude,
        longitude,
        routeHeading:  routesStr.trim().slice(0, 240) || "Not specified",
        estimatedFare: parseFare(routesStr),
        submitterId:   submitterId.trim().slice(0, 50),
        votes:         1,
        status:        "PENDING",
      },
    });

    return NextResponse.json({ action: "created", votes: 1 });
  } catch (err) {
    console.error("[map-it]", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
