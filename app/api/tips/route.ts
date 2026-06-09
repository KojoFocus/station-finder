import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { terminal, destination } = await req.json() as { terminal: string; destination: string };
    if (!terminal || !destination) return NextResponse.json({ tips: [] });

    const h = new Date().getHours();
    const timeCtx = h >= 6 && h < 9 ? "early morning rush hour" : h >= 16 && h < 20 ? "evening rush hour" : h >= 21 || h < 5 ? "late night" : "daytime";

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(
      `You know Ghana's transport system well. Give 3 practical travel tips for someone heading to ${destination} from ${terminal} in Accra. It is currently ${timeCtx}.

Tips should be specific and genuinely useful — things a local would tell a friend. Cover: what to expect at the terminal (loading time, where to stand), journey comfort (food, what to bring for long trips), and one arrival or local insight about the destination.

Return ONLY a valid JSON array of 3 short strings — no markdown, no keys, just the array.
Example: ["Tip one here.", "Tip two here.", "Tip three here."]`
    );

    const raw = result.response.text().trim()
      .replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const tips = JSON.parse(raw) as string[];
    return NextResponse.json({ tips: Array.isArray(tips) ? tips.slice(0, 4) : [] });
  } catch {
    return NextResponse.json({ tips: [] });
  }
}
