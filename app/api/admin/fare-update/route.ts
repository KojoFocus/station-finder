import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest): boolean {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  return !!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET;
}

// POST /api/admin/fare-update  { corridor: string, fare: number }
// Updates estimatedFare for all CrowdsourcedStops whose routeHeading contains the corridor keyword.
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { corridor, fare } = await req.json() as { corridor: string; fare: number };

  if (!corridor?.trim() || typeof fare !== "number" || fare < 0 || fare > 500) {
    return NextResponse.json({ error: "Invalid corridor or fare value." }, { status: 400 });
  }

  const result = await prisma.crowdsourcedStop.updateMany({
    where: { routeHeading: { contains: corridor.trim(), mode: "insensitive" } },
    data:  { estimatedFare: fare },
  });

  return NextResponse.json({ updated: result.count, corridor, fare });
}
