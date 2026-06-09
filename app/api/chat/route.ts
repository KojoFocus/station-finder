import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface IntentResult {
  intent:               "route" | "location_update" | "other";
  origin:               string | null;
  destination:          string | null;
  locatedAt:            string | null;
  clarificationQuestion: string | null;
  conversationalReply:  string | null;
}

// ── Regex fallback — works offline / when Gemini is slow ─────────────────────

const OTHER: IntentResult = { intent: "other", origin: null, destination: null, locatedAt: null, clarificationQuestion: null, conversationalReply: null };

function looksLikeQuestion(t: string): boolean {
  return /^(will|can|should|would|is|are|does|do|what|how|when|who|why|which|could|shall|has|have|did|was|were)\b/i.test(t)
    && !/\b(to|from|bus|trotro|station|terminal|route|fare|cost|going|heading|travel|direction)\b/i.test(t);
}

function regexExtract(message: string): IntentResult {
  const t = message.trim();
  if (looksLikeQuestion(t)) return OTHER;
  const atMatch = t.match(/^(?:i(?:'m|\s+am)\s+at|am\s+at)\s+(.+)$/i);
  if (atMatch) return { intent: "location_update", origin: null, destination: null, locatedAt: atMatch[1].trim(), clarificationQuestion: null, conversationalReply: null };
  const fromTo = t.match(/^(?:from\s+)?(.+?)\s+to\s+(.+)$/i);
  if (fromTo) return { intent: "route", origin: fromTo[1].trim(), destination: fromTo[2].trim(), locatedAt: null, clarificationQuestion: null, conversationalReply: null };
  // Extract destination from common travel phrases
  const destMatch = t.match(/(?:going to|get to|heading to|travel to|go to|bus to|trotro to|reach|take me to|route to|way to)\s+(.+)/i);
  if (destMatch) return { intent: "route", origin: null, destination: destMatch[1].trim(), locatedAt: null, clarificationQuestion: null, conversationalReply: null };
  if (t.split(/\s+/).length <= 4)
    return { intent: "route", origin: null, destination: t, locatedAt: null, clarificationQuestion: null, conversationalReply: null };
  return OTHER;
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

  const prompt = `You are a knowledgeable travel companion for Ghana. You help people navigate Ghana's public transport — trotros, intercity buses, STC, VIP, and everything in between. You also answer general travel questions like a local friend would.

${ctx}User's latest message: "${message.replace(/"/g, '\\"')}"

Ghanaian place name variants you should recognize and correct:
- "kanshie", "kanche", "kaneshi", "kaneshie market" → Kaneshie
- "achimota", "achimotta", "achimota tree" → Achimota
- "madina", "madinah", "medina" → Madina
- "legon", "laygon", "leygo", "lagoon" → Legon
- "ashaiman", "ashayman", "ashaimen", "ashiaman" → Ashaiman
- "dansoman", "dansaman", "danzoman" → Dansoman
- "lapas", "lapaz", "la paz" → Lapaz
- "takoradi", "takorady", "takorads" → Takoradi
- "koforidua", "koforidwa", "koforiduah", "kofi" → Koforidua
- "hohoe", "hohe", "hohoye", "ho ho" → Hohoe
- "tema", "tima", "teema" → Tema
- "nungua", "nungwa", "nunguah" → Nungua
- "teshie", "teshi", "teshee" → Teshie
- "circle", "the circle", "kwame nkrumah" → Accra Central (Circle)
- "stc", "stc bus" → Accra STC Terminal
- "lome", "lomé", "togo" → Aflao
- "bolga" → Bolgatanga
- "kejetia" → Kumasi
- "eschol" → Dansoman
- "spintex road" → Spintex

Return ONLY valid JSON — no markdown, no explanation:
{
  "intent": "route" | "location_update" | "other",
  "origin": "<where they're coming from, or null>",
  "destination": "<where they want to go, corrected if misspelled, or null>",
  "locatedAt": "<only if they said 'I'm at X' with NO destination, else null>",
  "clarificationQuestion": "<short conversational follow-up if genuinely ambiguous, else null>",
  "conversationalReply": "<helpful friendly reply when intent is 'other', else null>"
}

Intent rules (be aggressive about finding travel intent):
- "route" = user wants to travel somewhere — even indirect phrasing counts: "I need to get to...", "how do I reach...", "I'm going to...", "what's the bus to...", "can I get to...", "I want to travel to...", "take me to...", "heading to...", any mention of a destination
- "location_update" = user is ONLY saying where they currently are, no destination mentioned
- "other" = truly no destination and no travel route request (greetings, general questions, weather, packing tips, safety, timing questions without a specific destination)

When intent is "other" you MUST write a conversationalReply — a helpful, friendly answer as a Ghana transit expert. Examples of what to cover: weather and what to pack, best time to travel, safety tips, cost expectations, what to expect at terminals, how long journeys take, food options, local customs. Be warm and specific. 2-3 sentences max.

Additional rules:
- If you recognise a Ghanaian place even with typos, correct it and leave clarificationQuestion null
- Only use clarificationQuestion if the destination is truly unrecognisable — keep it short (e.g. "Did you mean Koforidua?")
- Return place names as clean standard forms — not the user's raw misspelling
- If the message is just a place name or short phrase, assume "route" with that as destination
- Use conversation history to fill in missing context`;

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
      return NextResponse.json(regexExtract(message));
    }
  } catch {
    return NextResponse.json({ intent: "other", origin: null, destination: null, locatedAt: null, clarificationQuestion: null });
  }
}
