import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function auth(req: NextRequest) {
  return req.headers.get("authorization")?.replace("Bearer ", "") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ reports });
  } catch (err) {
    console.error("[admin/reports]", err);
    return NextResponse.json({ error: "Failed to load reports." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json() as { id: string };
    await prisma.report.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/reports DELETE]", err);
    return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  }
}
