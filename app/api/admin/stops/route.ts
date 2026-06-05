import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return !!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // PENDING | VERIFIED | FLAGGED | null = all

  const [stops, pendingCount, verifiedCount, flaggedCount] = await Promise.all([
    prisma.crowdsourcedStop.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    }),
    prisma.crowdsourcedStop.count({ where: { status: "PENDING"  } }),
    prisma.crowdsourcedStop.count({ where: { status: "VERIFIED" } }),
    prisma.crowdsourcedStop.count({ where: { status: "FLAGGED"  } }),
  ]);

  return NextResponse.json({
    stops,
    stats: {
      total:    pendingCount + verifiedCount + flaggedCount,
      pending:  pendingCount,
      verified: verifiedCount,
      flagged:  flaggedCount,
    },
  });
}
