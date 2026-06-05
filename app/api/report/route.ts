import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { destination, routeSummary, reason } = await req.json() as {
      destination:  unknown;
      routeSummary: unknown;
      reason:       unknown;
    };

    if (typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json({ error: "Missing reason." }, { status: 400 });
    }

    await prisma.report.create({
      data: {
        destination:  String(destination ?? "").slice(0, 200),
        routeSummary: String(routeSummary ?? "").slice(0, 500),
        reason:       reason.trim().slice(0, 300),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[report]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
