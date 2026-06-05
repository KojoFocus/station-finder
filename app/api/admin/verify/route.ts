import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest): boolean {
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return !!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET;
}

// POST /api/admin/verify  { id, status: "PENDING" | "VERIFIED" | "FLAGGED" }
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await req.json() as { id: string; status: string };

  if (!id || !["PENDING", "VERIFIED", "FLAGGED"].includes(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const stop = await prisma.crowdsourcedStop.update({
    where: { id },
    data:  { status },
  });

  return NextResponse.json({ stop });
}
