import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("id");
  if (!deviceId) return NextResponse.json([]);

  const searches = await prisma.recentSearch.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, origin: true, destination: true },
  });

  return NextResponse.json(searches);
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, origin, destination } = await req.json();
    if (!deviceId || !destination) return NextResponse.json({ ok: false }, { status: 400 });

    const dest = destination.trim().toLowerCase();
    const orig = (origin ?? "").trim();

    // If same trip already exists for this device, just bump its timestamp
    const existing = await prisma.recentSearch.findFirst({
      where: { deviceId, origin: { equals: orig, mode: "insensitive" }, destination: { equals: dest, mode: "insensitive" } },
    });

    if (existing) {
      await prisma.recentSearch.update({ where: { id: existing.id }, data: { createdAt: new Date() } });
    } else {
      await prisma.recentSearch.create({ data: { deviceId, origin: orig, destination: dest } });

      // Keep max 10 per device
      const all = await prisma.recentSearch.findMany({
        where: { deviceId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (all.length > 10) {
        await prisma.recentSearch.deleteMany({ where: { id: { in: all.slice(10).map((r) => r.id) } } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("History POST error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
