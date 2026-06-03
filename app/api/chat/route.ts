import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── Keyword fallback: no Gemini needed ────────────────────────────────────────

const KNOWN_LOCATIONS = [
  { keywords: ["aburi"], name: "Aburi Junction" },
  { keywords: ["oyarifa"], name: "Oyarifa Junction" },
  { keywords: ["teiman"], name: "Teiman Junction" },
  { keywords: ["madina"], name: "Madina Station" },
  { keywords: ["circle", "accra central", "accra"], name: "Accra Central (Circle)" },
];

function extractIntentFromKeywords(
  message: string
): { origin: string | null; destination: string | null } {
  const msg = message.toLowerCase();

  const found = KNOWN_LOCATIONS
    .map((loc) => ({
      name: loc.name,
      idx: Math.min(...loc.keywords.map((k) => (msg.includes(k) ? msg.indexOf(k) : Infinity))),
    }))
    .filter((loc) => loc.idx !== Infinity)
    .sort((a, b) => a.idx - b.idx);

  if (found.length >= 2) return { origin: found[0].name, destination: found[1].name };
  if (found.length === 1) return { origin: null, destination: found[0].name };
  return { origin: null, destination: null };
}

// ── Gemini: extract { origin, destination } from free-form text ───────────────

async function extractIntent(
  message: string,
  history: { role: string; text: string }[]
): Promise<{ origin: string | null; destination: string | null }> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const historyBlock =
      history.length > 0
        ? `\nConversation so far:\n${history.map((m) => `${m.role}: ${m.text}`).join("\n")}\n`
        : "";

    const prompt = `
You are a transit assistant for Accra, Ghana. Extract the origin and destination from the user's latest message, using conversation history for context if origin or destination was mentioned earlier.

Known locations: Aburi Junction, Oyarifa Junction, Teiman Junction, Madina Station, Accra Central (Circle).

Return ONLY valid JSON in this exact shape:
{"origin": "<location name or null>", "destination": "<location name or null>"}

Rules:
- If the user does not mention an origin in the latest message but mentioned one earlier in the conversation, use the earlier one.
- Match partial names: "Madina" → "Madina Station", "Circle" → "Accra Central (Circle)", "Accra" → "Accra Central (Circle)".
- If a location is not in the known list, return null for that field.
${historyBlock}
Latest message: "${message}"
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(clean);
  } catch {
    // Gemini unavailable — fall back to keyword matching
    return extractIntentFromKeywords(message);
  }
}

// ── Prisma: find a direct route between two location names ────────────────────

async function findDirectRoute(origin: string, destination: string) {
  return prisma.route.findFirst({
    where: {
      origin: { name: { contains: origin, mode: "insensitive" } },
      destination: { name: { contains: destination, mode: "insensitive" } },
    },
    include: { origin: true, destination: true },
  });
}

// ── Prisma: find a two-hop chain origin → mid → destination ──────────────────

async function findTwoHopRoute(origin: string, destination: string) {
  const firstLegs = await prisma.route.findMany({
    where: { origin: { name: { contains: origin, mode: "insensitive" } } },
    include: { origin: true, destination: true },
  });

  for (const leg1 of firstLegs) {
    const leg2 = await prisma.route.findFirst({
      where: {
        originId: leg1.destinationId,
        destination: { name: { contains: destination, mode: "insensitive" } },
      },
      include: { origin: true, destination: true },
    });
    if (leg2) return { leg1, leg2 };
  }

  return null;
}

// ── Reply builders ────────────────────────────────────────────────────────────

type RouteWithLocations = NonNullable<Awaited<ReturnType<typeof findDirectRoute>>>;

function buildDirectReply(route: RouteWithLocations): string {
  return (
    `From **${route.origin.name}** to **${route.destination.name}**: ` +
    `take a ${route.transitType}. ${route.whatToLookFor}. ` +
    `Fare is approx. ₵${route.estimatedFare.toFixed(2)}, about ${route.durationMins} min.`
  );
}

function buildTwoHopReply(hops: { leg1: RouteWithLocations; leg2: RouteWithLocations }): string {
  const { leg1, leg2 } = hops;
  const totalFare = (leg1.estimatedFare + leg2.estimatedFare).toFixed(2);
  const totalMins = leg1.durationMins + leg2.durationMins;
  return (
    `No direct trotro — you'll need two hops:\n\n` +
    `1️⃣ **${leg1.origin.name} → ${leg1.destination.name}**: ${leg1.whatToLookFor}. Fare ₵${leg1.estimatedFare.toFixed(2)}, ~${leg1.durationMins} min.\n\n` +
    `2️⃣ **${leg2.origin.name} → ${leg2.destination.name}**: ${leg2.whatToLookFor}. Fare ₵${leg2.estimatedFare.toFixed(2)}, ~${leg2.durationMins} min.\n\n` +
    `Total: approx. ₵${totalFare} and ${totalMins} min.`
  );
}

// ── Map pins extracted from route ─────────────────────────────────────────────

type MapPin = { name: string; lat: number; lng: number };

function pinsFromDirect(route: RouteWithLocations): MapPin[] {
  return [
    { name: route.origin.name, lat: route.origin.latitude, lng: route.origin.longitude },
    { name: route.destination.name, lat: route.destination.latitude, lng: route.destination.longitude },
  ];
}

function pinsFromTwoHop(hops: { leg1: RouteWithLocations; leg2: RouteWithLocations }): MapPin[] {
  return [
    { name: hops.leg1.origin.name, lat: hops.leg1.origin.latitude, lng: hops.leg1.origin.longitude },
    { name: hops.leg1.destination.name, lat: hops.leg1.destination.latitude, lng: hops.leg1.destination.longitude },
    { name: hops.leg2.destination.name, lat: hops.leg2.destination.latitude, lng: hops.leg2.destination.longitude },
  ];
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const { origin, destination } = await extractIntent(message, history);

    if (!destination) {
      return NextResponse.json({
        reply: "I didn't catch a destination. Try: \"Oyarifa to Madina\" or \"I want to go to Circle\".",
        pins: [],
      });
    }

    const direct = origin ? await findDirectRoute(origin, destination) : null;
    if (direct) {
      return NextResponse.json({ reply: buildDirectReply(direct), pins: pinsFromDirect(direct) });
    }

    if (origin) {
      const hops = await findTwoHopRoute(origin, destination);
      if (hops) {
        return NextResponse.json({ reply: buildTwoHopReply(hops), pins: pinsFromTwoHop(hops) });
      }
    }

    const notFound = origin
      ? `No route found from **${origin}** to **${destination}** yet. Pilot covers: Aburi, Oyarifa, Teiman, Madina, Circle.`
      : `Where are you coming from? (e.g. "From Oyarifa to ${destination}")`;

    return NextResponse.json({ reply: notFound, pins: [] });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { reply: "Something went wrong. Please try again.", pins: [] },
      { status: 500 }
    );
  }
}
