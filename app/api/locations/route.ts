import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/locations?q=X — autocomplete suggestions for destination input
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ locations: [] });

  try {
    const [dbLocs, crowdLocs] = await Promise.all([
      prisma.location.findMany({
        where:   { name: { contains: q, mode: "insensitive" } },
        select:  { name: true },
        take:    5,
        orderBy: { name: "asc" },
      }),
      prisma.crowdsourcedStop.findMany({
        where:   { stopName: { contains: q, mode: "insensitive" }, status: { in: ["VERIFIED", "PROMOTED"] } },
        select:  { stopName: true },
        take:    4,
        orderBy: { stopName: "asc" },
      }),
    ]);

    const names = [...new Set([
      ...dbLocs.map((l) => l.name),
      ...crowdLocs.map((l) => l.stopName),
    ])].slice(0, 6);

    return NextResponse.json({ locations: names.map((name) => ({ name })) });
  } catch {
    return NextResponse.json({ locations: [] });
  }
}
