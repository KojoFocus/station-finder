import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  let text = "";
  try {
    ({ text } = await req.json() as { text: string });
    if (!text) return NextResponse.json({ translated: "" });

    const model  = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(
      `Translate the following to Akan Twi (Ghana). Rules:
- Keep place names exactly as-is (Madina, Circle, Kaneshie, etc.)
- Keep fare amounts (₵4, ~₵3–5) and time durations (~15 min) unchanged
- Keep markdown bold (**text**) and italic (*text*) markers intact
- Keep emojis
- Return ONLY the Twi translation, nothing else

Text:
${text}`
    );

    return NextResponse.json({ translated: result.response.text().trim() });
  } catch {
    return NextResponse.json({ translated: text });
  }
}
