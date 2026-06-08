import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Strips type labels so suggestions feel natural:
// "Kpando Station" → "Kpando", "Accra Central (Circle)" → "Circle", "Hohoe Lorry Park" → "Hohoe"
function clean(raw: string): string {
  // Prefer the common name in parentheses if present — e.g. "Accra Central (Circle)" → "Circle"
  const paren = raw.match(/\(([^)]+)\)\s*$/);
  if (paren) return paren[1].trim();

  return raw
    .replace(/\s+(Station|Lorry\s+Park|Lorry\s+Station|Loading\s+Bay|Terminal|Junction|Interchange|Barrier|Main\s+Gate|Main\s+Station|Town\s+Station|Last\s+Stop|New\s+Terminal|Bus\s+Station|Border\s+Station)\s*$/i, "")
    .trim();
}

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

    return NextResponse.json({ locations: names.map((name) => ({ name: clean(name) })) });
  } catch {
    return NextResponse.json({ locations: [] });
  }
}
