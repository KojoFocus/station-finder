"use client";

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NavStep } from "./api/directions/route";

const RouteMap = lazy(() => import("./components/RouteMap"));

// ─── Types ────────────────────────────────────────────────────────────────────

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
type MsgType = "text" | "typing" | "route" | "navstep" | "chips";
interface Msg {
  id: string; from: "bot" | "user"; type: MsgType; text?: string;
  timestamp: Date; result?: DirectionsResult; step?: NavStep;
  chips?: { label: string; action: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
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
  const atMatch = text.match(/^(?:i(?:'m|\s+am)\s+at|am\s+at)\s+(.+)$/i);
  if (atMatch) return { locatedAt: atMatch[1].trim() };
  const m = text.match(/^(?:from\s+)?(.+?)\s+to\s+(.+)$/i);
  if (m) return { fromAddress: m[1].trim(), destination: m[2].trim() };
  return { destination: text.trim() };
}

async function fetchDirections(body: Record<string, unknown>) {
  const res = await fetch("/api/directions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json() as DirectionsResult & { error?: string } };
}

// ─── MapPane ──────────────────────────────────────────────────────────────────

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

// ─── RouteCard ────────────────────────────────────────────────────────────────

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
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-stroke" />
              <span className="text-content-disabled text-[10px]">THEN</span>
              <div className="flex-1 h-px bg-stroke" />
            </div>
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
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-stroke" />
                  <span className="text-content-disabled text-[10px]">TRANSFER</span>
                  <div className="flex-1 h-px bg-stroke" />
                </div>
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

// ─── ReportModal ──────────────────────────────────────────────────────────────

const REPORT_REASONS = ["Fare is wrong", "Wrong boarding stop", "Route doesn't exist", "Instructions unclear"];

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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: result.boardingStop.name, routeSummary, reason: details ? `${reason}: ${details}` : reason }),
      });
      setSent(true);
      setTimeout(onClose, 2000);
    } catch { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full bg-raised rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,.5)]" onClick={(e) => e.stopPropagation()}>
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

// ─── App ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [msgs,            setMsgs]           = useState<Msg[]>([]);
  const [input,           setInput]          = useState("");
  const [userLoc,         setUserLoc]        = useState<{ lat: number; lng: number } | null>(null);
  const [result,          setResult]         = useState<DirectionsResult | null>(null);
  const [processing,      setProcessing]     = useState(false);
  const [navigating,      setNavigating]     = useState(false);
  const [voiceOn,         setVoiceOn]        = useState(false);
  const [watchId,         setWatchId]        = useState<number | null>(null);
  const [stepIdx,         setStepIdx]        = useState(0);
  const [pendingDest,     setPendingDest]    = useState<string | null>(null);
  const [knownOrigin,     setKnownOrigin]    = useState<string | null>(null);
  const [deepLinkDest,    setDeepLinkDest]   = useState<string | null>(null);
  const [listening,       setListening]      = useState(false);
  const [hasSpeech,       setHasSpeech]      = useState(false);
  const [reportingResult, setReportingResult]= useState<DirectionsResult | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const resultRef    = useRef<DirectionsResult | null>(null);
  const stepIdxRef   = useRef(0);
  const voiceOnRef   = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);

  // Keep refs in sync
  useEffect(() => { resultRef.current  = result;  }, [result]);
  useEffect(() => { stepIdxRef.current = stepIdx; }, [stepIdx]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // ── Boot: deep link + speech detection ────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const dest = new URLSearchParams(window.location.search).get("to");
    if (dest?.trim()) {
      setDeepLinkDest(dest.trim());
      window.history.replaceState({}, "", window.location.pathname);
    }
    setHasSpeech("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  // ── Message helpers ────────────────────────────────────────────────────────
  const addMsg      = useCallback((m: Omit<Msg, "id" | "timestamp">) =>
    setMsgs(p => [...p, { id: uid(), timestamp: new Date(), ...m }]), []);
  const removeTyping = useCallback(() =>
    setMsgs(p => p.filter(m => m.type !== "typing")), []);

  // ── Persist chat to sessionStorage ────────────────────────────────────────
  useEffect(() => {
    if (msgs.length === 0) return;
    try {
      sessionStorage.setItem("sf_msgs", JSON.stringify(
        msgs.filter(m => m.type !== "typing")
            .map(m => ({ ...m, timestamp: m.timestamp.toISOString() }))
      ));
    } catch { /* storage full */ }
  }, [msgs]);

  // ── On mount: restore session or show welcome ──────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const saved = sessionStorage.getItem("sf_msgs");
    const restored = saved ? (() => {
      try {
        return (JSON.parse(saved) as Array<Omit<Msg, "timestamp"> & { timestamp: string }>)
          .map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch { return null; }
    })() : null;

    if (restored?.length) {
      setMsgs(restored);
      navigator.geolocation?.getCurrentPosition(
        (p) => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {}, { timeout: 10000, enableHighAccuracy: true }
      );
      return;
    }

    const noGps = () => addMsg({ from: "bot", type: "text",
      text: "Akwaaba! 👋 Couldn't get your GPS. Tell me where you are and where you're going — e.g. *Teiman to Kaneshie*" });
    if (!navigator.geolocation) { noGps(); return; }

    addMsg({ from: "bot", type: "text", text: "Akwaaba! 👋 Getting your location…" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setMsgs(p => p.filter(m => m.text !== "Akwaaba! 👋 Getting your location…"));
        addMsg({ from: "bot", type: "text", text: "Got your location 📍 Where are you headed?" });
      },
      () => {
        setMsgs(p => p.filter(m => m.text !== "Akwaaba! 👋 Getting your location…"));
        noGps();
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // ── Search ─────────────────────────────────────────────────────────────────
  const search = useCallback(async (destination: string, fromAddress?: string, coords?: { lat: number; lng: number }) => {
    setProcessing(true);
    setTimeout(() => addMsg({ from: "bot", type: "typing" }), 200);
    const body: Record<string, unknown> = { destination };
    if (fromAddress)  body.fromAddress = fromAddress;
    else if (coords)  { body.userLat = coords.lat; body.userLng = coords.lng; }
    else              { body.userLat = 5.6863; body.userLng = -0.1488; }
    try {
      const { ok, data } = await fetchDirections(body);
      removeTyping();
      if (!ok) {
        addMsg({ from: "bot", type: "text",
          text: `Chale, I don't have that route in my database yet 😅\n\nIf you find yourself at a trotro stop near there, please help me put it on the map — you'll earn points and help every commuter after you! 🙏` });
        addMsg({ from: "bot", type: "chips", chips: [{ label: "📍 Help Map It →", action: "map_it" }] });
        setProcessing(false); return;
      }
      setResult(data);
      const fare = data.trotro ? data.trotro.leg1.fare + (data.trotro.leg2?.fare ?? 0) : null;
      addMsg({ from: "bot", type: "text", text: `Found a route!${fare ? ` Total fare: ₵${fare.toFixed(2)}` : ""}` });
      addMsg({ from: "bot", type: "route", result: data });
      addMsg({ from: "bot", type: "chips", chips: [
        { label: "Start Navigation →", action: "start_nav" },
        { label: "📤 Share on WhatsApp", action: "share_wa" },
      ]});
    } catch {
      removeTyping();
      addMsg({ from: "bot", type: "text", text: "Connection error. Please try again." });
    }
    setProcessing(false);
  }, [addMsg, removeTyping]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || processing) return;
    addMsg({ from: "user", type: "text", text: t });
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const parsed = parseInput(t);

    if (parsed.locatedAt) {
      setKnownOrigin(parsed.locatedAt);
      addMsg({ from: "bot", type: "text", text: `📍 Got it! You're at **${parsed.locatedAt}**. Where would you like to go?` });
      return;
    }

    if (navigating) {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
      setNavigating(false);
    }

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
    else {
      setPendingDest(destination);
      addMsg({ from: "bot", type: "text", text: "Where are you coming from? (e.g. Teiman, Oyarifa)" });
    }
  }, [addMsg, pendingDest, processing, navigating, watchId, search, userLoc, knownOrigin]);

  // ── Deep link trigger (after send is defined) ─────────────────────────────
  useEffect(() => {
    if (!deepLinkDest || msgs.length === 0 || processing) return;
    const t = setTimeout(() => { send(deepLinkDest); setDeepLinkDest(null); }, 500);
    return () => clearTimeout(t);
  }, [deepLinkDest, msgs.length, processing, send]);

  // ── Navigation ─────────────────────────────────────────────────────────────
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
        const leg = res.trotro?.leg1;
        addMsg({ from: "bot", type: "text",
          text: `You're at ${res.boardingStop.name}! 🚐\n\n${leg ? `${leg.whatToLookFor}\n\n₵${leg.fare.toFixed(2)} · ~${leg.durationMins} min to ${leg.to}` : "Board here."}` });
        if (voiceOnRef.current) speak(`You've arrived at ${res.boardingStop.name}. ${leg?.whatToLookFor ?? ""}`);
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

  // ── Voice input ────────────────────────────────────────────────────────────
  const toggleVoiceInput = useCallback(() => {
    if (listening) { speechRecRef.current?.stop(); setListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any;
    rec.lang = "en-US"; rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript as string;
      setInput(t);
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 110)}px`;
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    speechRecRef.current = rec;
    setListening(true);
  }, [listening]);

  // ── Chip actions ───────────────────────────────────────────────────────────
  const onChip = useCallback((action: string) => {
    if (action === "start_nav") startNavigation();
    if (action === "map_it")   router.push("/map-it");
    if (action === "share_wa") {
      const r = resultRef.current;
      if (!r) return;
      const fare     = r.trotro ? (r.trotro.leg1.fare + (r.trotro.leg2?.fare ?? 0)).toFixed(2) : null;
      const duration = r.trotro ? r.trotro.leg1.durationMins + (r.trotro.leg2?.durationMins ?? 0) : null;
      const text = [
        `🚐 *Station Finder Route*`, ``,
        `🚶 Walk to *${r.boardingStop.name}* (~${r.boardingStop.walkingMins} min)`,
        `📍 ${r.boardingStop.description}`,
        r.trotro ? `` : null,
        r.trotro ? `🚐 Board: *${r.trotro.leg1.whatToLookFor}*` : null,
        r.trotro ? `➡️ ${r.trotro.leg1.from} → ${r.trotro.leg1.to}` : null,
        fare     ? `💰 Fare: *₵${fare}*${duration ? ` · ~${duration} min` : ""}` : null,
        ``, `Find yours 👉 https://stationfinder.vercel.app`,
      ].filter((l) => l !== null).join("\n");
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  }, [startNavigation, router]);

  // ── Map height ─────────────────────────────────────────────────────────────
  const mapH = navigating ? "46vh" : result ? "36vh" : "28vh";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-dvh bg-canvas" suppressHydrationWarning>

      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-sm shadow-accent shrink-0">🚐</div>
          <div className="min-w-0">
            <p className="text-content-primary text-sm font-semibold leading-tight">Station Finder</p>
            <p className="text-[10px] text-content-muted leading-tight">{navigating ? "● Navigating" : "● Accra Pilot"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {navigating && (
            <button onClick={stopNavigation}
              className="whitespace-nowrap text-[10px] text-[#f0c040]/80 border border-[#f0c040]/20 px-2.5 py-1.5 rounded-full active:scale-95">
              Stop
            </button>
          )}
          <button onClick={() => setVoiceOn(v => !v)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90 shrink-0 ${voiceOn ? "bg-accent text-white" : "text-content-muted"}`}>
            {voiceOn ? "🔊" : "🔇"}
          </button>
          {!navigating && (
            <Link href="/map-it"
              className="whitespace-nowrap flex items-center gap-1 text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all">
              📍 Map It
            </Link>
          )}
        </div>
      </header>

      {/* Map */}
      <MapPane result={result} userLoc={userLoc} navigating={navigating} height={mapH} />

      {/* Chat sheet */}
      <div className="flex-1 flex flex-col rounded-t-3xl bg-raised mt-2 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,.35)]">
        <div className="mx-auto w-8 h-1 bg-stroke rounded-full mt-2.5 mb-1 shrink-0" />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {msgs.map((msg) => {
            if (msg.type === "typing") return (
              <div key={msg.id} className="flex gap-2.5 items-end">
                <div className="w-7 h-7 rounded-full bg-surface-elevated border border-stroke flex items-center justify-center text-xs shrink-0">🚐</div>
                <div className="bg-surface-card border border-stroke rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-card">
                  <div className="flex gap-1.5 items-center h-3.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-content-muted animate-bounce"
                           style={{ animationDelay: `${i * 180}ms`, animationDuration: "0.9s" }} />
                    ))}
                  </div>
                </div>
              </div>
            );

            if (msg.from === "user") return (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="bg-surface-interactive text-content-primary rounded-2xl rounded-br-sm px-4 py-3 text-[13px] leading-relaxed max-w-[80%] font-medium">
                  {msg.text}
                </div>
                <p className="text-content-disabled text-[9px] mt-1.5 mr-1 tracking-wide">{formatTime(msg.timestamp)}</p>
              </div>
            );

            if (msg.type === "chips") return (
              <div key={msg.id} className="flex gap-2 flex-wrap pl-8">
                {msg.chips!.map(c => (
                  <button key={c.action} onClick={() => onChip(c.action)}
                    className="text-xs text-accent border border-accent bg-accent-subtle px-4 py-2 rounded-full active:scale-95 transition-all hover:bg-surface-elevated font-medium">
                    {c.label}
                  </button>
                ))}
              </div>
            );

            return (
              <div key={msg.id} className="flex gap-2.5 items-end max-w-[85%]">
                <div className="w-7 h-7 rounded-full bg-surface-elevated border border-stroke flex items-center justify-center text-xs shrink-0 mb-5">🚐</div>
                <div>
                  {msg.type === "text" && (
                    <div className="bg-surface-card border border-stroke rounded-2xl rounded-bl-sm px-4 py-3 text-[13px] text-content-primary leading-relaxed whitespace-pre-line shadow-card">
                      {msg.text}
                    </div>
                  )}
                  {msg.type === "route" && msg.result && (
                    <>
                      <RouteCard result={msg.result} />
                      <button onClick={() => setReportingResult(msg.result!)}
                        className="text-[10px] text-content-disabled hover:text-content-muted mt-0.5 ml-1 active:opacity-60 transition-colors">
                        ⚠ Report wrong info
                      </button>
                    </>
                  )}
                  {msg.type === "navstep" && msg.step && (
                    <div className="bg-accent rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-3.5 min-w-[200px] shadow-accent-sm">
                      <span className="text-2xl font-bold text-white leading-none shrink-0">{msg.step.icon}</span>
                      <div>
                        <p className="text-white text-sm font-semibold leading-snug">{msg.step.instruction}</p>
                        {msg.step.distanceM > 0 && <p className="text-white/60 text-xs mt-1">{formatDist(msg.step.distanceM)}</p>}
                      </div>
                    </div>
                  )}
                  <p className="text-content-disabled text-[9px] mt-1.5 ml-1 tracking-wide">{formatTime(msg.timestamp)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 px-4 pb-safe pb-5 pt-3 flex gap-3 items-end border-t border-stroke">
          <div className="flex-1 bg-surface-card border border-stroke rounded-2xl px-4 py-3 focus-within:border-accent transition-colors">
            <textarea ref={inputRef} rows={1} value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={
                navigating      ? "Ask something or go somewhere else…" :
                !userLoc && !knownOrigin ? "Where are you going? (or: I'm at [place])" :
                "Where are you going?"
              }
              disabled={processing}
              className="w-full bg-transparent text-[13px] text-content-primary placeholder-content-placeholder outline-none resize-none leading-relaxed disabled:opacity-40" />
          </div>
          {hasSpeech && (
            <button onClick={toggleVoiceInput}
              className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                listening ? "bg-red-500/20 text-red-400 animate-pulse border border-red-500/30" : "text-content-muted bg-surface-card border border-stroke"
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        </div>
      </div>

      {reportingResult && <ReportModal result={reportingResult} onClose={() => setReportingResult(null)} />}
    </div>
  );
}
