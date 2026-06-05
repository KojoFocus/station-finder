import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest): boolean {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  return !!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET;
}

// POST /api/admin/merge  { ids: string[] }
// Picks the oldest stop as master, sums votes, concatenates unique route headings, deletes the rest.
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids } = await req.json() as { ids: string[] };

  if (!Array.isArray(ids) || ids.length < 2) {
    return NextResponse.json({ error: "Select at least 2 stops to merge." }, { status: 400 });
  }

  const stops = await prisma.crowdsourcedStop.findMany({
    where:   { id: { in: ids } },
    orderBy: { createdAt: "asc" }, // oldest becomes master
  });

  if (stops.length < 2) {
    return NextResponse.json({ error: "Could not find selected stops." }, { status: 404 });
  }

  const [master, ...rest] = stops;

  const totalVotes = stops.reduce((sum, s) => sum + s.votes, 0);

  const uniqueRoutes = [
    ...new Set(stops.map((s) => s.routeHeading).filter((r) => r && r !== "Not specified")),
  ].join(" | ");

  const highestFare = Math.max(...stops.map((s) => s.estimatedFare));

  // Promote to VERIFIED if any merged stop was already verified
  const mergedStatus = stops.some((s) => s.status === "VERIFIED") ? "VERIFIED" : "PENDING";

  const [updated] = await prisma.$transaction([
    prisma.crowdsourcedStop.update({
      where: { id: master.id },
      data: {
        votes:         totalVotes,
        routeHeading:  uniqueRoutes || "Not specified",
        estimatedFare: highestFare,
        status:        mergedStatus,
      },
    }),
    prisma.crowdsourcedStop.deleteMany({
      where: { id: { in: rest.map((s) => s.id) } },
    }),
  ]);

  return NextResponse.json({ stop: updated, merged: rest.length });
}
