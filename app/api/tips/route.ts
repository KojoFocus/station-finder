import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function fallbackTips(terminal: string, destination: string, timeCtx: string): string[] {
  const rush = timeCtx.includes("rush");
  const late = timeCtx.includes("late night");
  return [
    rush
      ? `${terminal} fills up fast during rush hour — arrive 20–30 min early to secure a seat.`
      : late
      ? `${terminal} has fewer buses late at night. Confirm departure times before heading out.`
      : `Buses from ${terminal} usually load within 30–45 minutes. Check in with the station master for the next departure.`,
    `For the journey to ${destination}, bring water and a small snack — vendors at the terminal also sell food and drinks before you board.`,
    `Once you arrive in ${destination}, shared taxis and trotros are available at the main lorry park to take you to your final stop.`,
  ];
}

export async function POST(req: NextRequest) {
  const { terminal, destination } = await req.json() as { terminal?: string; destination?: string };
  if (!terminal || !destination) return NextResponse.json({ tips: [] });

  const h = new Date().getHours();
  const timeCtx = h >= 6 && h < 9 ? "early morning rush hour" : h >= 16 && h < 20 ? "evening rush hour" : h >= 21 || h < 5 ? "late night" : "daytime";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(
      `You know Ghana's transport system well. Give exactly 3 practical travel tips for someone heading to ${destination} from ${terminal} in Accra. It is currently ${timeCtx}.

Tips must be specific and genuinely useful — things a local would tell a friend. Cover:
1. What to expect at ${terminal} (loading time, where to stand, how busy it is at this hour)
2. Journey comfort (food, water, what to bring, how long the ride takes)
3. An arrival or local insight about ${destination} (where to find onward transport, a landmark, local tip)

Return ONLY a valid JSON array of exactly 3 strings — no markdown, no extra keys, just the array.
["Tip one.", "Tip two.", "Tip three."]`
    );

    const raw = result.response.text().trim()
      .replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    let tips: string[];
    try {
      tips = JSON.parse(raw) as string[];
    } catch {
      tips = [];
    }
    if (!Array.isArray(tips) || tips.length === 0) {
      tips = fallbackTips(terminal, destination, timeCtx);
    }
    return NextResponse.json({ tips: tips.slice(0, 3) });
  } catch {
    return NextResponse.json({ tips: fallbackTips(terminal, destination, timeCtx) });
  }
}
