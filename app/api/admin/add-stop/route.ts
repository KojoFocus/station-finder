import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseFare(routes: string): number {
  const m = routes.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { latitude, longitude, stopName, routes = "" } = await req.json() as {
      latitude:  unknown;
      longitude: unknown;
      stopName:  unknown;
      routes?:   unknown;
    };

    if (
      typeof latitude  !== "number" ||
      typeof longitude !== "number" ||
      typeof stopName  !== "string" || !stopName.trim()
    ) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    const routesStr = typeof routes === "string" ? routes : "";

    const stop = await prisma.crowdsourcedStop.create({
      data: {
        stopName:      stopName.trim().slice(0, 120),
        latitude,
        longitude,
        routeHeading:  routesStr.trim().slice(0, 240) || "Not specified",
        estimatedFare: parseFare(routesStr),
        submitterId:   "admin",
        votes:         5,
        status:        "VERIFIED",
      },
    });

    return NextResponse.json({ stop });
  } catch (err) {
    console.error("[admin/add-stop]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
