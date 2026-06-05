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

// A submitter is flagged as spam if 5+ of their stops cluster within 50 m of each other.
function detectSpam(stops: { latitude: number; longitude: number }[]): boolean {
  if (stops.length <= 5) return false;
  for (let i = 0; i < stops.length; i++) {
    let cluster = 1;
    for (let j = i + 1; j < stops.length; j++) {
      if (haversineM(stops[i].latitude, stops[i].longitude, stops[j].latitude, stops[j].longitude) < 50) {
        cluster++;
        if (cluster >= 5) return true;
      }
    }
  }
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allStops = await prisma.crowdsourcedStop.findMany({
    select: {
      submitterId:  true,
      status:       true,
      votes:        true,
      latitude:     true,
      longitude:    true,
      createdAt:    true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by submitterId
  const map = new Map<string, typeof allStops>();
  for (const s of allStops) {
    const list = map.get(s.submitterId) ?? [];
    list.push(s);
    map.set(s.submitterId, list);
  }

  const users = Array.from(map.entries())
    .map(([id, stops]) => ({
      submitterId:    id,
      count:          stops.length,
      verified:       stops.filter((s) => s.status === "VERIFIED").length,
      pending:        stops.filter((s) => s.status === "PENDING").length,
      flagged:        stops.filter((s) => s.status === "FLAGGED").length,
      totalVotes:     stops.reduce((sum, s) => sum + s.votes, 0),
      points:         stops.length * 10,
      isSpam:         detectSpam(stops),
      lastSubmission: stops[0]?.createdAt ?? null,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ users });
}
