import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json() as {
      message: string;
      history?: { role: string; text: string }[];
    };

    const ctx = history.length
      ? `Recent conversation:\n${history.slice(-4).map(m => `${m.role}: ${m.text}`).join("\n")}\n\n`
      : "";

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(
      `You are a friendly, knowledgeable Ghana travel companion. You know Ghana well — the weather, the roads, transport, culture, safety, costs, local food, and what to pack. Answer conversationally in 2–3 sentences. Give specific, practical advice when you can. If it's a greeting or thanks, respond warmly and invite them to ask about their journey.

${ctx}User: "${message.replace(/"/g, '\\"')}"

Reply like a local friend who knows Ghana. Plain text only, no markdown.`
    );

    return NextResponse.json({ reply: result.response.text().trim() });
  } catch {
    return NextResponse.json({ reply: null });
  }
}
