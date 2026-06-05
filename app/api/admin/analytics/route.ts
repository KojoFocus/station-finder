import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function auth(req: NextRequest) {
  return req.headers.get("authorization")?.replace("Bearer ", "") === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week      = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  try {
    const [total, todayTotal, weekTotal, foundTotal, topAll, topMissing, byDay] =
      await Promise.all([
        // All time totals
        prisma.searchLog.count(),
        prisma.searchLog.count({ where: { createdAt: { gte: today } } }),
        prisma.searchLog.count({ where: { createdAt: { gte: week } } }),
        prisma.searchLog.count({ where: { found: true } }),

        // Top 8 destinations ever searched
        prisma.searchLog.groupBy({
          by: ["destination"],
          _count: { destination: true },
          orderBy: { _count: { destination: "desc" } },
          take: 8,
        }),

        // Top 10 NOT FOUND — tells you exactly which routes to add
        prisma.searchLog.groupBy({
          by: ["destination"],
          where: { found: false },
          _count: { destination: true },
          orderBy: { _count: { destination: "desc" } },
          take: 10,
        }),

        // Last 7 days search volume
        prisma.$queryRaw<{ day: string; count: bigint }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('day', "createdAt"), 'Mon DD') AS day,
            COUNT(*) AS count
          FROM "SearchLog"
          WHERE "createdAt" >= ${week}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY DATE_TRUNC('day', "createdAt") ASC
        `,
      ]);

    const hitRate = total > 0 ? Math.round((foundTotal / total) * 100) : 0;

    return NextResponse.json({
      total,
      todayTotal,
      weekTotal,
      foundTotal,
      hitRate,
      topAll:     topAll.map((r)     => ({ destination: r.destination, count: r._count.destination })),
      topMissing: topMissing.map((r) => ({ destination: r.destination, count: r._count.destination })),
      byDay:      byDay.map((r)      => ({ day: r.day, count: Number(r.count) })),
    });
  } catch (err) {
    console.error("[admin/analytics]", err);
    return NextResponse.json({ error: "Failed to load analytics." }, { status: 500 });
  }
}
