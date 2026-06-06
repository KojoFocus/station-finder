import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface IntentResult {
  intent:      "route" | "location_update" | "other";
  origin:      string | null;
  destination: string | null;
  locatedAt:   string | null;
}

// ── Regex fallback — works offline / when Gemini is slow ─────────────────────

function regexExtract(message: string): IntentResult {
  const t = message.trim();
  const atMatch = t.match(/^(?:i(?:'m|\s+am)\s+at|am\s+at)\s+(.+)$/i);
  if (atMatch) return { intent: "location_update", origin: null, destination: null, locatedAt: atMatch[1].trim() };
  const fromTo = t.match(/^(?:from\s+)?(.+?)\s+to\s+(.+)$/i);
  if (fromTo) return { intent: "route", origin: fromTo[1].trim(), destination: fromTo[2].trim(), locatedAt: null };
  if (t.split(/\s+/).length <= 4)
    return { intent: "route", origin: null, destination: t, locatedAt: null };
  return { intent: "other", origin: null, destination: null, locatedAt: null };
}

// ── Gemini intent extraction ──────────────────────────────────────────────────

async function geminiExtract(
  message: string,
  history: { role: string; text: string }[],
): Promise<IntentResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const ctx = history.length
    ? `\nRecent conversation:\n${history.map((m) => `${m.role}: ${m.text}`).join("\n")}\n`
    : "";

  const prompt = `You are a transit assistant for Accra, Ghana. Extract travel intent from the user's message.

${ctx}
User's latest message: "${message.replace(/"/g, '\\"')}"

Return ONLY valid JSON — no markdown, no explanation:
{
  "intent": "route" | "location_update" | "other",
  "origin": "<where they're coming from, or null>",
  "destination": "<where they want to go, or null>",
  "locatedAt": "<only if they said 'I'm at X' with NO destination, else null>"
}

Rules:
- "route" = user wants directions (even if origin is missing)
- "location_update" = user is only saying where they are now, no destination mentioned
- "other" = greetings, thanks, unrelated questions
- Return place names as the user said them — don't normalise (e.g. keep "UG", "37", "Circle", "STC")
- If the message is just a place name or short phrase, assume intent is "route" with that as destination
- Use conversation history to fill in missing origin/destination when the user refers back to earlier context`;

  const result = await model.generateContent(prompt);
  const raw    = result.response.text().trim()
    .replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(raw) as IntentResult;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json() as {
      message: string;
      history?: { role: string; text: string }[];
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    try {
      const result = await geminiExtract(message, history);
      return NextResponse.json(result);
    } catch {
      // Gemini unavailable or parse failure — return regex result
      return NextResponse.json(regexExtract(message));
    }
  } catch {
    return NextResponse.json({ intent: "other", origin: null, destination: null, locatedAt: null });
  }
}
