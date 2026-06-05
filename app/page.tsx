"use client";

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NavStep } from "./api/directions/route";

const RouteMap = lazy(() => import("./components/RouteMap"));

// ─── Shared types ─────────────────────────────────────────────────────────────

interface TrotroLeg {
  from: string; to: string;
  whatToLookFor: string;
  fare: number; durationMins: number; transitType: string;
}
interface DirectionsResult {
  destCoords:   { lat: number; lng: number };
  boardingStop: { name: string; lat: number; lng: number; description: string; distanceM: number; walkingMins: number };
  walkingGeoJSON: object | null;
  steps: NavStep[];
  trotro: { leg1: TrotroLeg; leg2: TrotroLeg | null } | null;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
function formatDist(m: number) {
  if (m < 50)   return "a few steps";
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
function formatTime(d: Date) {
  return d.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
}
function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92; u.lang = "en-GB";
  window.speechSynthesis.speak(u);
}
function parseInput(text: string): { fromAddress?: string; destination?: string; locatedAt?: string } {
  // "I'm at X" / "I am at X" / "am at X" → location statement, not a destination
  const atMatch = text.match(/^(?:i(?:'m|\s+am)\s+at|am\s+at)\s+(.+)$/i);
  if (atMatch) return { locatedAt: atMatch[1].trim() };
  const m = text.match(/^(?:from\s+)?(.+?)\s+to\s+(.+)$/i);
  if (m) return { fromAddress: m[1].trim(), destination: m[2].trim() };
  return { destination: text.trim() };
}

async function fetchDirections(body: Record<string, unknown>): Promise<{ ok: boolean; data: DirectionsResult & { error?: string } }> {
  const res = await fetch("/api/directions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json() };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function MapPane({ result, userLoc, navigating, height }: {
  result: DirectionsResult | null;
  userLoc: { lat: number; lng: number } | null;
  navigating: boolean;
  height: string;
}) {
  return (
    <div className="shrink-0 px-4 pt-1 transition-all duration-500" style={{ height }}>
      <Suspense fallback={
        <div className="w-full h-full rounded-2xl bg-surface-card border border-stroke flex items-center justify-center">
          <span className="text-content-muted text-xs">Loading map…</span>
        </div>
      }>
        <RouteMap
          userLocation={userLoc}
          boardingStop={result?.boardingStop ?? null}
          destCoords={result?.destCoords ?? null}
          walkingGeoJSON={result?.walkingGeoJSON ?? null}
          followUser={navigating}
        />
      </Suspense>
    </div>
  );
}

function RouteCard({ result }: { result: DirectionsResult }) {
  return (
    <div className="bg-surface-card border border-stroke rounded-2xl rounded-bl-sm overflow-hidden min-w-[240px] shadow-card"
         style={{ borderLeftColor: "var(--accent-interactive)", borderLeftWidth: 3 }}>
      <div className="px-4 py-3.5 space-y-3">
      <div className="flex gap-2.5 items-start">
        <span className="text-base mt-0.5 shrink-0">🚶</span>
        <div>
          <p className="text-content-primary text-xs font-semibold">Walk to {result.boardingStop.name}</p>
          <p className="text-content-secondary text-xs mt-0.5 leading-relaxed">{result.boardingStop.description}</p>
          <p className="text-content-muted text-xs mt-1">{formatDist(result.boardingStop.distanceM)} · ~{result.boardingStop.walkingMins} min</p>
        </div>
      </div>
      {result.trotro && (
        <>
          <div className="flex items-center gap-2"><div className="flex-1 h-px bg-stroke" /><span className="text-content-disabled text-[10px]">THEN</span><div className="flex-1 h-px bg-stroke" /></div>
          <div className="flex gap-2.5 items-start">
            <span className="text-base mt-0.5 shrink-0">🚐</span>
            <div>
              <p className="text-content-primary text-xs font-semibold">{result.trotro.leg1.from} → {result.trotro.leg1.to}</p>
              <p className="text-content-secondary text-xs mt-0.5 leading-relaxed">{result.trotro.leg1.whatToLookFor}</p>
              <p className="text-content-muted text-xs mt-1">₵{result.trotro.leg1.fare.toFixed(2)} · ~{result.trotro.leg1.durationMins} min</p>
            </div>
          </div>
          {result.trotro.leg2 && (
            <>
              <div className="flex items-center gap-2"><div className="flex-1 h-px bg-stroke" /><span className="text-content-disabled text-[10px]">TRANSFER</span><div className="flex-1 h-px bg-stroke" /></div>
              <div className="flex gap-2.5 items-start">
                <span className="text-base mt-0.5 shrink-0">🚐</span>
                <div>
                  <p className="text-content-primary text-xs font-semibold">{result.trotro.leg2.from} → {result.trotro.leg2.to}</p>
                  <p className="text-content-secondary text-xs mt-0.5 leading-relaxed">{result.trotro.leg2.whatToLookFor}</p>
                  <p className="text-content-muted text-xs mt-1">₵{result.trotro.leg2.fare.toFixed(2)} · ~{result.trotro.leg2.durationMins} min</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}

// ─── Report modal ────────────────────────────────────────────────────────────

const REPORT_REASONS = [
  "Fare is wrong",
  "Wrong boarding stop",
  "Route doesn't exist",
  "Instructions unclear",
];

function ReportModal({ result, onClose }: { result: DirectionsResult; onClose: () => void }) {
  const [reason,  setReason]  = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const routeSummary = [
    `Boarding: ${result.boardingStop.name}`,
    result.trotro ? `Trotro: ${result.trotro.leg1.from} → ${result.trotro.leg1.to} (₵${result.trotro.leg1.fare.toFixed(2)})` : null,
    result.trotro?.leg2 ? `Transfer: ${result.trotro.leg2.from} → ${result.trotro.leg2.to}` : null,
  ].filter(Boolean).join(" | ");

  const submit = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      await fetch("/api/report", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination:  result.boardingStop.name,
          routeSummary,
          reason:       details ? `${reason}: ${details}` : reason,
        }),
      });
      setSent(true);
      setTimeout(onClose, 2000);
    } catch { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full bg-raised rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,.5)]"
           onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-8 h-1 bg-stroke rounded-full mt-3 mb-1" />
        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
          <p className="text-content-primary font-semibold text-sm">Report wrong info</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-card border border-stroke flex items-center justify-center text-content-secondary active:scale-90">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {sent ? (
          <div className="px-5 pb-10 pt-4 flex flex-col items-center gap-3">
            <span className="text-3xl">🙏</span>
            <p className="text-content-primary font-semibold text-sm">Got it — thanks!</p>
            <p className="text-content-secondary text-xs text-center">Your report helps improve routes for everyone.</p>
          </div>
        ) : (
          <div className="px-5 pb-8 flex flex-col gap-4">
            <p className="text-content-secondary text-xs">What&apos;s wrong with this route?</p>
            <div className="flex flex-wrap gap-2">
              {REPORT_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r === reason ? "" : r)}
                  className={`text-xs px-3 py-2 rounded-full border transition-all active:scale-95 ${
                    reason === r ? "bg-accent text-white border-accent shadow-md shadow-accent-sm" : "text-content-secondary border-stroke bg-surface-card"
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2}
              placeholder="Optional details…"
              className="w-full bg-surface-card border border-stroke rounded-xl px-4 py-3 text-xs text-content-primary placeholder-content-placeholder outline-none resize-none focus:border-accent transition-colors" />
            <button onClick={submit} disabled={!reason || loading}
              className="w-full py-3.5 rounded-xl bg-accent text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-accent-sm disabled:opacity-30 active:scale-[0.98] transition-all">
              {loading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Sending…</> : "Submit Report →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CHAT MODE ────────────────────────────────────────────────────────────────

type MsgType = "text" | "typing" | "route" | "navstep" | "chips";
interface Msg {
  id: string; from: "bot" | "user"; type: MsgType; text?: string;
  timestamp: Date; result?: DirectionsResult; step?: NavStep;
  chips?: { label: string; action: string }[];
}

function ChatMode({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [msgs,       setMsgs]       = useState<Msg[]>([]);
  const [input,      setInput]      = useState("");
  const [userLoc,    setUserLoc]    = useState<{ lat: number; lng: number } | null>(null);
  const [result,     setResult]     = useState<DirectionsResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [voiceOn,    setVoiceOn]    = useState(false);
  const [watchId,    setWatchId]    = useState<number | null>(null);
  const [stepIdx,    setStepIdx]    = useState(0);
  const [pendingDest,setPendingDest]= useState<string | null>(null);
  const [knownOrigin,setKnownOrigin]= useState<string | null>(null);
  const [deepLinkDest,    setDeepLinkDest]    = useState<string | null>(null);
  const [listening,       setListening]       = useState(false);
  const [hasSpeech,       setHasSpeech]       = useState(false);
  const [reportingResult, setReportingResult] = useState<DirectionsResult | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const resultRef    = useRef<DirectionsResult | null>(null);
  const stepIdxRef   = useRef(0);
  const voiceOnRef   = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);

  useEffect(() => { resultRef.current = result; },  [result]);
  useEffect(() => { stepIdxRef.current = stepIdx; }, [stepIdx]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Read ?to= deep-link param once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const dest = new URLSearchParams(window.location.search).get("to");
    if (dest?.trim()) {
      setDeepLinkDest(dest.trim());
      window.history.replaceState({}, "", window.location.pathname);
    }
    setHasSpeech("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  const addMsg = useCallback((m: Omit<Msg, "id" | "timestamp">) =>
    setMsgs(p => [...p, { id: uid(), timestamp: new Date(), ...m }]), []);
  const removeTyping = useCallback(() => setMsgs(p => p.filter(m => m.type !== "typing")), []);

  // Persist conversation to sessionStorage on every message change
  useEffect(() => {
    if (msgs.length === 0) return;
    try {
      const serialized = msgs
        .filter(m => m.type !== "typing") // never persist the typing indicator
        .map(m => ({ ...m, timestamp: m.timestamp.toISOString() }));
      sessionStorage.setItem("sf_msgs", JSON.stringify(serialized));
    } catch { /* storage full — silent */ }
  }, [msgs]);

  // On mount: restore from sessionStorage or show welcome
  useEffect(() => {
    const saved = sessionStorage.getItem("sf_msgs");
    const restored = saved ? (() => {
      try {
        return (JSON.parse(saved) as Array<Omit<Msg, "timestamp"> & { timestamp: string }>)
          .map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch { return null; }
    })() : null;

    if (restored && restored.length > 0) {
      setMsgs(restored);
      // Re-acquire GPS silently in the background — no new messages
      navigator.geolocation?.getCurrentPosition(
        (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { timeout: 10000, enableHighAccuracy: true }
      );
      return;
    }

    // Fresh session — show welcome and acquire GPS
    const noGps = () => addMsg({ from: "bot", type: "text", text: "Akwaaba! 👋 Couldn't get your GPS. Tell me where you are and where you're going — e.g. *Teiman to Kaneshie*" });
    if (!navigator.geolocation) { noGps(); return; }
    addMsg({ from: "bot", type: "text", text: "Akwaaba! 👋 Getting your location…" });
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setMsgs(p => p.filter(m => m.text !== "Akwaaba! 👋 Getting your location…")); addMsg({ from: "bot", type: "text", text: "Got your location 📍 Where are you headed?" }); },
      () => { setMsgs(p => p.filter(m => m.text !== "Akwaaba! 👋 Getting your location…")); noGps(); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = useCallback(async (destination: string, fromAddress?: string, coords?: { lat: number; lng: number }) => {
    setProcessing(true);
    setTimeout(() => addMsg({ from: "bot", type: "typing" }), 200);
    const body: Record<string, unknown> = { destination };
    if (fromAddress) body.fromAddress = fromAddress;
    else if (coords) { body.userLat = coords.lat; body.userLng = coords.lng; }
    else             { body.userLat = 5.6863; body.userLng = -0.1488; }
    try {
      const { ok, data } = await fetchDirections(body);
      removeTyping();
      if (!ok) {
        addMsg({ from: "bot", type: "text", text: `Chale, I don't have that route in my database yet 😅\n\nIf you find yourself at a trotro stop near there, please help me put it on the map — you'll earn points and help every commuter after you! 🙏` });
        addMsg({ from: "bot", type: "chips", chips: [{ label: "📍 Help Map It →", action: "map_it" }] });
        setProcessing(false); return;
      }
      setResult(data);
      const fare = data.trotro ? data.trotro.leg1.fare + (data.trotro.leg2?.fare ?? 0) : null;
      addMsg({ from: "bot", type: "text",  text: `Found a route!${fare ? ` Total fare: ₵${fare.toFixed(2)}` : ""}` });
      addMsg({ from: "bot", type: "route", result: data });
      addMsg({ from: "bot", type: "chips", chips: [{ label: "Start Navigation →", action: "start_nav" }] });
    } catch { removeTyping(); addMsg({ from: "bot", type: "text", text: "Connection error. Please try again." }); }
    setProcessing(false);
  }, [addMsg, removeTyping]);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || processing) return;
    addMsg({ from: "user", type: "text", text: t });
    setInput(""); if (inputRef.current) inputRef.current.style.height = "auto";

    const parsed = parseInput(t);

    // "I'm at X" — save as known origin, works even mid-navigation
    if (parsed.locatedAt) {
      setKnownOrigin(parsed.locatedAt);
      addMsg({ from: "bot", type: "text", text: `📍 Got it! You're at **${parsed.locatedAt}**. Where would you like to go?` });
      return;
    }

    // New route search — stop any active navigation first
    if (navigating) {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
      setNavigating(false);
    }

    // Bot asked "where are you from?" and user replied
    if (pendingDest) {
      setPendingDest(null);
      await search(pendingDest, t);
      return;
    }

    const { fromAddress, destination } = parsed;
    if (!destination) return;
    if (fromAddress)       await search(destination, fromAddress);
    else if (userLoc)      await search(destination, undefined, userLoc);
    else if (knownOrigin)  await search(destination, knownOrigin);
    else { setPendingDest(destination); addMsg({ from: "bot", type: "text", text: "Where are you coming from? (e.g. Teiman, Oyarifa)" }); }
  }, [addMsg, pendingDest, processing, navigating, watchId, search, userLoc, knownOrigin]);

  // Trigger deep-link search once welcome messages have loaded (placed after send to avoid TDZ)
  useEffect(() => {
    if (!deepLinkDest || msgs.length === 0 || processing) return;
    const t = setTimeout(() => { send(deepLinkDest); setDeepLinkDest(null); }, 500);
    return () => clearTimeout(t);
  }, [deepLinkDest, msgs.length, processing, send]);

  const startNavigation = useCallback(() => {
    if (!resultRef.current?.steps.length) return;
    setNavigating(true); setStepIdx(0);
    const first = resultRef.current.steps[0];
    addMsg({ from: "bot", type: "text", text: "Let's go! 🚶 Follow the steps:" });
    addMsg({ from: "bot", type: "navstep", step: first });
    if (voiceOnRef.current) speak(first.instruction);
    const id = navigator.geolocation.watchPosition((p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      setUserLoc(pos);
      const res = resultRef.current; const idx = stepIdxRef.current;
      if (!res) return;
      if (haversineM(pos, { lat: res.boardingStop.lat, lng: res.boardingStop.lng }) < 25) {
        setNavigating(false); navigator.geolocation.clearWatch(id); setWatchId(null);
        const t = res.trotro?.leg1;
        addMsg({ from: "bot", type: "text", text: `You're at ${res.boardingStop.name}! 🚐\n\n${t ? `${t.whatToLookFor}\n\n₵${t.fare.toFixed(2)} · ~${t.durationMins} min to ${t.to}` : "Board here."}` });
        if (voiceOnRef.current) speak(`You've arrived at ${res.boardingStop.name}. ${t?.whatToLookFor ?? ""}`);
        return;
      }
      if (idx < res.steps.length) {
        const dist = haversineM(pos, { lat: res.steps[idx].maneuverLat, lng: res.steps[idx].maneuverLng });
        if (dist < 18 && idx + 1 < res.steps.length) {
          const next = res.steps[idx + 1]; setStepIdx(idx + 1);
          addMsg({ from: "bot", type: "navstep", step: next });
          if (voiceOnRef.current) speak(next.instruction);
        }
      }
    }, (e) => console.warn("GPS:", e), { enableHighAccuracy: true, maximumAge: 1500 });
    setWatchId(id);
  }, [addMsg]);

  const stopNavigation = useCallback(() => {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
    setNavigating(false);
    addMsg({ from: "bot", type: "text", text: "Navigation stopped. Where would you like to go next?" });
  }, [watchId, addMsg]);

  const toggleVoiceInput = useCallback(() => {
    if (listening) { speechRecRef.current?.stop(); setListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any;
    rec.lang = "en-US";
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript as string;
      setInput(t);
      if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 110)}px`; }
    };
    rec.onend  = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    speechRecRef.current = rec;
    setListening(true);
  }, [listening]);

  const onChip = useCallback((action: string) => {
    if (action === "start_nav") startNavigation();
    if (action === "map_it")   router.push("/map-it");
  }, [startNavigation, router]);

  const mapH = navigating ? "46vh" : result ? "36vh" : "30vh";

  return (
    <div className="flex flex-col h-dvh bg-canvas" suppressHydrationWarning>
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-sm shadow-accent shrink-0">🚐</div>
          <div className="min-w-0">
            <p className="text-content-primary text-sm font-semibold leading-tight">Station Finder</p>
            <p className="text-[10px] text-content-muted leading-tight">{navigating ? "● Navigating" : "● Accra Pilot"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {navigating && <button onClick={stopNavigation} className="whitespace-nowrap text-[10px] text-[#f0c040]/80 border border-[#f0c040]/20 px-2.5 py-1.5 rounded-full active:scale-95">Stop</button>}
          <button onClick={() => setVoiceOn(v => !v)} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90 shrink-0 ${voiceOn ? "bg-accent text-white" : "text-content-muted"}`}>{voiceOn ? "🔊" : "🔇"}</button>
          {!navigating && <Link href="/map-it" className="whitespace-nowrap flex items-center gap-1 text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all">📍 Map It</Link>}
          <button onClick={onSwitch} className="whitespace-nowrap flex items-center gap-1 text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all">⇄ Switch</button>
        </div>
      </header>

      <MapPane result={result} userLoc={userLoc} navigating={navigating} height={mapH} />

      <div className="flex-1 flex flex-col rounded-t-3xl bg-raised mt-2 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,.35)]">
        <div className="mx-auto w-8 h-1 bg-stroke rounded-full mt-2.5 mb-1 shrink-0" />
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {msgs.map((msg) => {
            if (msg.type === "typing") return (
              <div key={msg.id} className="flex gap-2.5 items-end">
                <div className="w-7 h-7 rounded-full bg-surface-elevated border border-stroke flex items-center justify-center text-xs shrink-0">🚐</div>
                <div className="bg-surface-card border border-stroke rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-card">
                  <div className="flex gap-1.5 items-center h-3.5">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-content-muted animate-bounce" style={{ animationDelay: `${i*180}ms`, animationDuration: "0.9s" }} />)}</div>
                </div>
              </div>
            );
            if (msg.from === "user") return (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="bg-surface-interactive text-content-primary rounded-2xl rounded-br-sm px-4 py-3 text-[13px] leading-relaxed max-w-[80%] font-medium">{msg.text}</div>
                <p className="text-content-disabled text-[9px] mt-1.5 mr-1 tracking-wide">{formatTime(msg.timestamp)}</p>
              </div>
            );
            if (msg.type === "chips") return (
              <div key={msg.id} className="flex gap-2 flex-wrap pl-8">
                {msg.chips!.map(c => <button key={c.action} onClick={() => onChip(c.action)} className="text-xs text-accent border border-accent bg-accent-subtle px-4 py-2 rounded-full active:scale-95 transition-all hover:bg-surface-elevated font-medium">{c.label}</button>)}
              </div>
            );
            return (
              <div key={msg.id} className="flex gap-2.5 items-end max-w-[85%]">
                <div className="w-7 h-7 rounded-full bg-surface-elevated border border-stroke flex items-center justify-center text-xs shrink-0 mb-5">🚐</div>
                <div>
                  {msg.type === "text"    && <div className="bg-surface-card border border-stroke rounded-2xl rounded-bl-sm px-4 py-3 text-[13px] text-content-primary leading-relaxed whitespace-pre-line shadow-card">{msg.text}</div>}
                  {msg.type === "route"   && msg.result && (
                    <>
                      <RouteCard result={msg.result} />
                      <button onClick={() => setReportingResult(msg.result!)}
                        className="text-[10px] text-content-disabled hover:text-content-muted mt-0.5 ml-1 active:opacity-60 transition-colors">
                        ⚠ Report wrong info
                      </button>
                    </>
                  )}
                  {msg.type === "navstep" && msg.step   && (
                    <div className="bg-accent rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-3.5 min-w-[200px] shadow-accent-sm">
                      <span className="text-2xl font-bold text-white leading-none shrink-0">{msg.step.icon}</span>
                      <div><p className="text-white text-sm font-semibold leading-snug">{msg.step.instruction}</p>{msg.step.distanceM > 0 && <p className="text-white/60 text-xs mt-1">{formatDist(msg.step.distanceM)}</p>}</div>
                    </div>
                  )}
                  <p className="text-content-disabled text-[9px] mt-1.5 ml-1 tracking-wide">{formatTime(msg.timestamp)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="shrink-0 px-4 pb-safe pb-5 pt-3 flex gap-3 items-end border-t border-stroke">
          <div className="flex-1 bg-surface-card border border-stroke rounded-2xl px-4 py-3 focus-within:border-accent transition-colors">
            <textarea ref={inputRef} rows={1} value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={navigating ? "Ask something or go somewhere else…" : !userLoc && !knownOrigin ? "Where are you going? (or: I'm at [place])" : "Where are you going?"} disabled={processing}
              className="w-full bg-transparent text-[13px] text-content-primary placeholder-content-placeholder outline-none resize-none leading-relaxed disabled:opacity-40" />
          </div>
          {hasSpeech && (
            <button onClick={toggleVoiceInput}
              className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                listening
                  ? "bg-red-500/20 text-red-400 animate-pulse border border-red-500/30"
                  : "text-content-muted bg-surface-card border border-stroke"
              }`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
          )}
          <button onClick={() => send(input)} disabled={!input.trim() || processing}
            className="shrink-0 w-11 h-11 rounded-full bg-accent flex items-center justify-center text-white shadow-accent disabled:opacity-30 active:scale-90 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </div>
      {reportingResult && <ReportModal result={reportingResult} onClose={() => setReportingResult(null)} />}
    </div>
  );
}

// ─── NAV MODE ─────────────────────────────────────────────────────────────────

type NavPhase = "locating" | "ready" | "searching" | "preview" | "navigating" | "boarding" | "arrived" | "denied";
const QUICK = ["Accra Mall", "Kaneshie", "Legon", "Tema Station"];

function NavMode({ onSwitch }: { onSwitch: () => void }) {
  const [phase,       setPhase]      = useState<NavPhase>("locating");
  const [userLoc,     setUserLoc]    = useState<{ lat: number; lng: number } | null>(null);
  const [fromText,    setFromText]   = useState("");
  const [destination, setDest]       = useState("");
  const [result,      setResult]     = useState<DirectionsResult | null>(null);
  const [error,       setError]      = useState<string | null>(null);
  const [stepIdx,     setStepIdx]    = useState(0);
  const [distToNext,  setDistToNext] = useState<number | null>(null);
  const [voiceOn,     setVoiceOn]    = useState(false);
  const [watchId,     setWatchId]    = useState<number | null>(null);

  const inputRef   = useRef<HTMLInputElement>(null);
  const resultRef  = useRef<DirectionsResult | null>(null);
  const stepIdxRef = useRef(0);
  const voiceOnRef = useRef(false);

  useEffect(() => { resultRef.current = result; },  [result]);
  useEffect(() => { stepIdxRef.current = stepIdx; }, [stepIdx]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);

  useEffect(() => {
    if (!navigator.geolocation) { setPhase("ready"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setPhase("ready"); },
      () => setPhase("denied"),
      { timeout: 12000, enableHighAccuracy: true }
    );
  }, []);

  const stopWatch = useCallback(() => {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
  }, [watchId]);

  useEffect(() => { if (phase !== "navigating" && phase !== "boarding") stopWatch(); }, [phase, stopWatch]);

  const search = async (dest: string) => {
    const d = dest.trim(); if (!d) return;
    setDest(d); setPhase("searching"); setError(null);
    const body: Record<string, unknown> = { destination: d };
    if (fromText.trim()) body.fromAddress = fromText.trim();
    else { body.userLat = userLoc?.lat ?? 5.6863; body.userLng = userLoc?.lng ?? -0.1488; }
    try {
      const { ok, data } = await fetchDirections(body);
      if (!ok) { setError("Chale, I don't have that route yet 😅 — if you're near a trotro stop, tap 📍 Map It to help!"); setPhase("ready"); return; }
      setResult(data); setPhase("preview");
    } catch { setError("Connection error."); setPhase("ready"); }
  };

  const startNavigation = useCallback(() => {
    if (!resultRef.current?.steps.length) return;
    setStepIdx(0); setPhase("navigating");
    const first = resultRef.current.steps[0];
    if (voiceOnRef.current) speak(first.instruction);
    const id = navigator.geolocation.watchPosition((p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      setUserLoc(pos);
      const res = resultRef.current; const idx = stepIdxRef.current;
      if (!res) return;
      if (haversineM(pos, { lat: res.boardingStop.lat, lng: res.boardingStop.lng }) < 25) {
        setPhase("boarding");
        if (voiceOnRef.current) speak(`You've arrived at ${res.boardingStop.name}. ${res.trotro?.leg1.whatToLookFor ?? ""}`);
        return;
      }
      if (idx < res.steps.length) {
        const dist = haversineM(pos, { lat: res.steps[idx].maneuverLat, lng: res.steps[idx].maneuverLng });
        setDistToNext(dist);
        if (dist < 18 && idx + 1 < res.steps.length) {
          const next = res.steps[idx + 1]; setStepIdx(idx + 1); setDistToNext(null);
          if (voiceOnRef.current) speak(next.instruction);
        }
      }
    }, (e) => console.warn("GPS:", e), { enableHighAccuracy: true, maximumAge: 1500 });
    setWatchId(id);
  }, []);

  const reset = () => {
    stopWatch(); setPhase("ready"); setResult(null); setError(null);
    setDest(""); setFromText(""); setStepIdx(0); setDistToNext(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const currentStep = result?.steps[stepIdx] ?? null;
  const nextStep    = result?.steps[stepIdx + 1] ?? null;
  const totalSteps  = result?.steps.length ?? 0;
  const totalFare   = result?.trotro ? result.trotro.leg1.fare + (result.trotro.leg2?.fare ?? 0) : null;
  const isNavigating = phase === "navigating" || phase === "boarding";
  const mapH = isNavigating ? "46vh" : result ? "38vh" : "30vh";

  return (
    <div className="flex flex-col h-dvh bg-canvas" suppressHydrationWarning>
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2 min-w-0">
          {(phase === "preview" || isNavigating || phase === "arrived")
            ? <button onClick={reset} className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-accent text-sm active:scale-90 shrink-0">←</button>
            : <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-sm shadow-accent shrink-0">🚐</div>}
          <div className="min-w-0">
            <p className="text-content-primary text-sm font-semibold leading-tight">Station Finder</p>
            <p className="text-[10px] text-content-muted leading-tight">{isNavigating ? "● Navigating" : "● Accra Pilot"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(phase === "preview" || isNavigating) && (
            <button onClick={() => { setVoiceOn(v => !v); if (!voiceOn && currentStep) speak(currentStep.instruction); else window.speechSynthesis?.cancel(); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90 shrink-0 ${voiceOn ? "bg-accent text-white" : "text-content-muted"}`}>
              {voiceOn ? "🔊" : "🔇"}
            </button>
          )}
          {!isNavigating && <Link href="/map-it" className="whitespace-nowrap flex items-center gap-1 text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all">📍 Map It</Link>}
          <button onClick={onSwitch} className="whitespace-nowrap flex items-center gap-1 text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all">⇄ Switch</button>
        </div>
      </header>

      <MapPane result={result} userLoc={userLoc} navigating={isNavigating} height={mapH} />

      <div className="flex-1 flex flex-col rounded-t-3xl bg-raised mt-2 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,.35)]">
        <div className="mx-auto w-8 h-1 bg-stroke rounded-full mt-2.5 mb-1 shrink-0" />
        <div className="flex-1 overflow-y-auto px-5 py-3 gap-3 flex flex-col">

          {(phase === "locating") && <div className="flex-1 flex flex-col items-center justify-center gap-3"><div className="w-7 h-7 rounded-full border-2 border-accent border-t-transparent animate-spin" /><p className="text-content-secondary text-sm">Getting your location…</p></div>}

          {(phase === "denied") && <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center"><p className="text-content-primary text-sm font-medium">Location access denied</p><p className="text-content-muted text-xs max-w-[240px] leading-relaxed">Allow location or type your starting point below.</p><button onClick={() => setPhase("ready")} className="text-xs text-accent border border-stroke px-4 py-2 rounded-full active:scale-95">Continue</button></div>}

          {(phase === "ready" || phase === "searching") && (
            <>
              <div className="bg-surface-card border border-stroke rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stroke-subtle">
                  <span className="text-base shrink-0">📍</span>
                  <input type="text" value={fromText} onChange={(e) => setFromText(e.target.value)} placeholder={userLoc ? "My location (GPS)" : "Where are you now?"} className="flex-1 bg-transparent text-sm text-content-primary placeholder-content-placeholder outline-none" />
                  {userLoc && !fromText && <span className="shrink-0 text-[9px] text-accent font-semibold tracking-widest">GPS ●</span>}
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="text-base shrink-0">🏁</span>
                  <input ref={inputRef} type="text" value={destination} onChange={(e) => setDest(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(destination)} placeholder="Where are you going?" autoFocus className="flex-1 bg-transparent text-sm text-content-primary placeholder-content-placeholder outline-none" />
                </div>
              </div>
              {error && <p className="text-red-400/80 text-xs px-1">{error}</p>}
              <button onClick={() => search(destination)} disabled={!destination.trim() || phase === "searching"}
                className="w-full py-4 rounded-2xl bg-accent flex items-center justify-center gap-2 text-white font-semibold text-sm shadow-lg shadow-accent-sm disabled:opacity-30 active:scale-[0.98] transition-all">
                {phase === "searching" ? <><div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />Finding route…</> : "Get Directions →"}
              </button>
              <div className="flex gap-2 flex-wrap">{QUICK.map(q => <button key={q} onClick={() => search(q)} className="text-xs text-content-secondary border border-stroke bg-[#0d1a0b] px-3 py-1.5 rounded-full active:scale-95">{q}</button>)}</div>
            </>
          )}

          {(phase === "preview" && result) && (
            <>
              <div className="flex items-center justify-between">
                <div><p className="text-[9px] text-content-muted tracking-widest uppercase">To</p><p className="text-content-primary font-semibold text-base capitalize">{destination}</p></div>
                {totalFare !== null && <div className="bg-surface-elevated border border-stroke rounded-xl px-3 py-1.5 text-center"><p className="text-accent font-bold">₵{totalFare.toFixed(2)}</p><p className="text-[9px] text-content-muted">total</p></div>}
              </div>
              <div className="relative pl-11">
                <div className="absolute left-[18px] top-5 h-[calc(100%-20px)] w-px bg-stroke" />
                <div className="relative mb-5">
                  <div className="absolute -left-11 w-9 h-9 rounded-full bg-accent flex items-center justify-center text-base shadow-md shadow-accent">🚶</div>
                  <p className="text-content-primary text-sm font-semibold">Walk to {result.boardingStop.name}</p>
                  <p className="text-content-secondary text-xs mt-1 leading-relaxed">{result.boardingStop.description}</p>
                  <p className="text-content-muted text-xs mt-1">{formatDist(result.boardingStop.distanceM)} · ~{result.boardingStop.walkingMins} min</p>
                </div>
                {result.trotro && (
                  <div className="relative">
                    <div className="absolute -left-11 w-9 h-9 rounded-full bg-surface-elevated border-2 border-accent flex items-center justify-center text-base">🚐</div>
                    <p className="text-content-primary text-sm font-semibold">{result.trotro.leg1.from} → {result.trotro.leg1.to}</p>
                    <p className="text-content-secondary text-xs mt-1 leading-relaxed">{result.trotro.leg1.whatToLookFor}</p>
                    <p className="text-content-muted text-xs mt-1">₵{result.trotro.leg1.fare.toFixed(2)} · ~{result.trotro.leg1.durationMins} min</p>
                  </div>
                )}
              </div>
              <button onClick={startNavigation} className="w-full py-4 rounded-2xl bg-accent text-white font-semibold text-sm shadow-lg shadow-accent-sm active:scale-[0.98] transition-all">Start Walking →</button>
            </>
          )}

          {(phase === "navigating" && currentStep) && (
            <>
              <div className="bg-accent rounded-2xl p-5 flex items-center gap-4">
                <div className="shrink-0 w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center"><span className="text-4xl font-black text-white leading-none">{currentStep.icon}</span></div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">{currentStep.instruction}</p>
                  {distToNext !== null ? <p className="text-white/60 text-sm mt-1">{formatDist(distToNext)}</p> : <p className="text-white/40 text-xs mt-1">{formatDist(currentStep.distanceM)} total</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 justify-center">
                {Array.from({ length: Math.min(totalSteps, 8) }).map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-300 ${i < stepIdx ? "w-1.5 h-1.5 bg-accent" : i === stepIdx ? "w-3 h-1.5 bg-accent" : "w-1.5 h-1.5 bg-stroke"}`} />
                ))}
              </div>
              {nextStep && (
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl text-content-muted shrink-0 w-6 text-center">{nextStep.icon}</span>
                  <div className="flex-1 min-w-0"><p className="text-[9px] text-content-muted uppercase tracking-widest">Then</p><p className="text-accent text-sm truncate">{nextStep.instruction}</p></div>
                  <span className="text-content-muted text-xs shrink-0">{formatDist(nextStep.distanceM)}</span>
                </div>
              )}
            </>
          )}

          {(phase === "boarding" && result?.trotro) && (
            <>
              <div className="bg-surface-card border border-stroke rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-3"><span className="text-2xl">🚐</span><div><p className="text-white/60 text-xs tracking-widest uppercase">You're here</p><p className="text-white font-bold text-base">{result.boardingStop.name}</p></div></div>
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5">Listen for</p>
                  <p className="text-white font-semibold text-sm leading-relaxed">{result.trotro.leg1.whatToLookFor}</p>
                  <p className="text-white/40 text-xs mt-2">₵{result.trotro.leg1.fare.toFixed(2)} · ~{result.trotro.leg1.durationMins} min to {result.trotro.leg1.to}</p>
                </div>
              </div>
              <button onClick={() => setPhase("arrived")} className="w-full py-3.5 rounded-2xl bg-surface-elevated border border-stroke text-accent text-sm font-medium active:scale-[0.98] transition-all">I'm on the trotro ✓</button>
            </>
          )}

          {phase === "arrived" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-stroke flex items-center justify-center text-3xl">🎉</div>
              <div><p className="text-content-primary font-bold text-lg">On your way!</p><p className="text-content-secondary text-sm mt-1">Heading to {destination}</p></div>
              <button onClick={reset} className="text-xs text-accent border border-stroke px-5 py-2.5 rounded-full active:scale-95">Plan another trip</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [mode, setMode] = useState<"chat" | "nav">("chat");
  return mode === "chat"
    ? <ChatMode onSwitch={() => setMode("nav")} />
    : <NavMode  onSwitch={() => setMode("chat")} />;
}
