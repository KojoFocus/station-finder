"use client";

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
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
function parseInput(text: string) {
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
        <div className="w-full h-full rounded-2xl bg-[#141f12] border border-[#1e2d1b] flex items-center justify-center">
          <span className="text-[#3d5c3a] text-xs">Loading map…</span>
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
    <div className="bg-[#141f12] border border-[#1e2d1b] rounded-2xl rounded-bl-sm px-4 py-3.5 space-y-3 min-w-[220px]">
      <div className="flex gap-2.5 items-start">
        <span className="text-base mt-0.5 shrink-0">🚶</span>
        <div>
          <p className="text-[#c8e0c0] text-xs font-semibold">Walk to {result.boardingStop.name}</p>
          <p className="text-[#5a7a58] text-xs mt-0.5 leading-relaxed">{result.boardingStop.description}</p>
          <p className="text-[#3d5c3a] text-xs mt-1">{formatDist(result.boardingStop.distanceM)} · ~{result.boardingStop.walkingMins} min</p>
        </div>
      </div>
      {result.trotro && (
        <>
          <div className="flex items-center gap-2"><div className="flex-1 h-px bg-[#1e2d1b]" /><span className="text-[#2e4030] text-[10px]">THEN</span><div className="flex-1 h-px bg-[#1e2d1b]" /></div>
          <div className="flex gap-2.5 items-start">
            <span className="text-base mt-0.5 shrink-0">🚐</span>
            <div>
              <p className="text-[#c8e0c0] text-xs font-semibold">{result.trotro.leg1.from} → {result.trotro.leg1.to}</p>
              <p className="text-[#5a7a58] text-xs mt-0.5 leading-relaxed">{result.trotro.leg1.whatToLookFor}</p>
              <p className="text-[#3d5c3a] text-xs mt-1">₵{result.trotro.leg1.fare.toFixed(2)} · ~{result.trotro.leg1.durationMins} min</p>
            </div>
          </div>
          {result.trotro.leg2 && (
            <>
              <div className="flex items-center gap-2"><div className="flex-1 h-px bg-[#1e2d1b]" /><span className="text-[#2e4030] text-[10px]">TRANSFER</span><div className="flex-1 h-px bg-[#1e2d1b]" /></div>
              <div className="flex gap-2.5 items-start">
                <span className="text-base mt-0.5 shrink-0">🚐</span>
                <div>
                  <p className="text-[#c8e0c0] text-xs font-semibold">{result.trotro.leg2.from} → {result.trotro.leg2.to}</p>
                  <p className="text-[#5a7a58] text-xs mt-0.5 leading-relaxed">{result.trotro.leg2.whatToLookFor}</p>
                  <p className="text-[#3d5c3a] text-xs mt-1">₵{result.trotro.leg2.fare.toFixed(2)} · ~{result.trotro.leg2.durationMins} min</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
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

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const resultRef  = useRef<DirectionsResult | null>(null);
  const stepIdxRef = useRef(0);
  const voiceOnRef = useRef(false);

  useEffect(() => { resultRef.current = result; },  [result]);
  useEffect(() => { stepIdxRef.current = stepIdx; }, [stepIdx]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const addMsg = useCallback((m: Omit<Msg, "id" | "timestamp">) =>
    setMsgs(p => [...p, { id: uid(), timestamp: new Date(), ...m }]), []);
  const removeTyping = useCallback(() => setMsgs(p => p.filter(m => m.type !== "typing")), []);

  useEffect(() => {
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
      if (!ok) { addMsg({ from: "bot", type: "text", text: data.error ?? "Couldn't find that route. Try: *Oyarifa to Kaneshie*" }); setProcessing(false); return; }
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
    if (!t || processing || navigating) return;
    addMsg({ from: "user", type: "text", text: t });
    setInput(""); if (inputRef.current) inputRef.current.style.height = "auto";
    if (pendingDest) { setPendingDest(null); await search(pendingDest, t); return; }
    const { fromAddress, destination } = parseInput(t);
    if (fromAddress) await search(destination, fromAddress);
    else if (userLoc) await search(destination, undefined, userLoc);
    else { setPendingDest(destination); addMsg({ from: "bot", type: "text", text: "Where are you coming from? (e.g. Teiman, Oyarifa)" }); }
  }, [addMsg, pendingDest, processing, navigating, search, userLoc]);

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

  const onChip = useCallback((action: string) => {
    if (action === "start_nav") startNavigation();
  }, [startNavigation]);

  const mapH = navigating ? "46vh" : result ? "36vh" : "30vh";

  return (
    <div className="flex flex-col h-dvh bg-[#0a1508]" suppressHydrationWarning>
      <header className="shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#4a7c59] flex items-center justify-center text-sm shadow-md shadow-[#4a7c59]/30">🚐</div>
          <div>
            <p className="text-[#c8e0c0] text-sm font-semibold">Station Finder</p>
            <p className="text-[10px] text-[#3d5c3a]">{navigating ? "● Navigating" : "● Accra Pilot"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {navigating && <button onClick={stopNavigation} className="text-xs text-[#f0c040]/80 border border-[#f0c040]/20 px-3 py-1.5 rounded-full active:scale-95">Stop</button>}
          <button onClick={() => setVoiceOn(v => !v)} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90 ${voiceOn ? "bg-[#4a7c59] text-white" : "text-[#3d5c3a]"}`}>{voiceOn ? "🔊" : "🔇"}</button>
          <button onClick={onSwitch} className="flex items-center gap-1 text-[10px] text-[#5a7a58] border border-[#1e2d1b] bg-[#141f12] px-3 py-1.5 rounded-full active:scale-95 transition-all">⇄ Switch mode</button>
        </div>
      </header>

      <MapPane result={result} userLoc={userLoc} navigating={navigating} height={mapH} />

      <div className="flex-1 flex flex-col rounded-t-3xl bg-[#0f1c0d] mt-2 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,.35)]">
        <div className="mx-auto w-8 h-1 bg-[#1e2d1b] rounded-full mt-2.5 mb-1 shrink-0" />
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {msgs.map((msg) => {
            if (msg.type === "typing") return (
              <div key={msg.id} className="flex gap-2 items-end">
                <div className="w-6 h-6 rounded-full bg-[#4a7c59]/15 flex items-center justify-center text-xs shrink-0">🚐</div>
                <div className="bg-[#141f12] border border-[#1e2d1b] rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-3">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#4a7c59] animate-bounce" style={{ animationDelay: `${i*160}ms`, animationDuration: "0.8s" }} />)}</div>
                </div>
              </div>
            );
            if (msg.from === "user") return (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="bg-[#4a7c59] text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed max-w-[80%]">{msg.text}</div>
                <p className="text-[#2e4030] text-[10px] mt-1 mr-1">{formatTime(msg.timestamp)}</p>
              </div>
            );
            if (msg.type === "chips") return (
              <div key={msg.id} className="flex gap-2 flex-wrap pl-8">
                {msg.chips!.map(c => <button key={c.action} onClick={() => onChip(c.action)} className="text-xs text-[#c8e0c0] border border-[#4a7c59]/40 bg-[#4a7c59]/10 px-4 py-2 rounded-full active:scale-95 transition-all hover:bg-[#4a7c59]/20">{c.label}</button>)}
              </div>
            );
            return (
              <div key={msg.id} className="flex gap-2 items-end max-w-[85%]">
                <div className="w-6 h-6 rounded-full bg-[#4a7c59]/15 flex items-center justify-center text-xs shrink-0 mb-4">🚐</div>
                <div>
                  {msg.type === "text"    && <div className="bg-[#141f12] border border-[#1e2d1b] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-[#c8e0c0] leading-relaxed whitespace-pre-line">{msg.text}</div>}
                  {msg.type === "route"   && msg.result && <RouteCard result={msg.result} />}
                  {msg.type === "navstep" && msg.step   && (
                    <div className="bg-[#4a7c59] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-3 min-w-[200px]">
                      <span className="text-2xl font-black text-white leading-none shrink-0">{msg.step.icon}</span>
                      <div><p className="text-white text-sm font-semibold leading-snug">{msg.step.instruction}</p>{msg.step.distanceM > 0 && <p className="text-white/50 text-xs mt-0.5">{formatDist(msg.step.distanceM)}</p>}</div>
                    </div>
                  )}
                  <p className="text-[#2e4030] text-[10px] mt-1 ml-1">{formatTime(msg.timestamp)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="shrink-0 px-4 pb-safe pb-4 pt-2 flex gap-2 items-end border-t border-[#1a2818]">
          <div className="flex-1 bg-[#141f12] border border-[#1e2d1b] rounded-2xl px-4 py-2.5 focus-within:border-[#4a7c59] transition-colors">
            <textarea ref={inputRef} rows={1} value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={navigating ? "Navigating…" : "Where are you going?"} disabled={processing || navigating}
              className="w-full bg-transparent text-sm text-[#c8e0c0] placeholder-[#3a4f38] outline-none resize-none leading-relaxed disabled:opacity-40" />
          </div>
          <button onClick={() => send(input)} disabled={!input.trim() || processing || navigating}
            className="shrink-0 w-11 h-11 rounded-2xl bg-[#4a7c59] flex items-center justify-center text-white shadow-md shadow-[#4a7c59]/30 disabled:opacity-30 active:scale-90 transition-all">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </div>
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
      if (!ok) { setError(data.error ?? "Couldn't find that place."); setPhase("ready"); return; }
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
    <div className="flex flex-col h-dvh bg-[#0a1508]" suppressHydrationWarning>
      <header className="shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          {(phase === "preview" || isNavigating || phase === "arrived")
            ? <button onClick={reset} className="w-8 h-8 rounded-full bg-[#1a2818] flex items-center justify-center text-[#7da87b] text-sm active:scale-90">←</button>
            : <div className="w-8 h-8 rounded-xl bg-[#4a7c59] flex items-center justify-center text-sm shadow-md shadow-[#4a7c59]/30">🚐</div>}
          <div>
            <p className="text-[#c8e0c0] text-sm font-semibold">Station Finder</p>
            <p className="text-[10px] text-[#3d5c3a]">{isNavigating ? "● Navigating" : "● Accra Pilot"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(phase === "preview" || isNavigating) && (
            <button onClick={() => { setVoiceOn(v => !v); if (!voiceOn && currentStep) speak(currentStep.instruction); else window.speechSynthesis?.cancel(); }}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90 ${voiceOn ? "bg-[#4a7c59] text-white" : "text-[#3d5c3a]"}`}>
              {voiceOn ? "🔊" : "🔇"}
            </button>
          )}
          <button onClick={onSwitch} className="flex items-center gap-1 text-[10px] text-[#5a7a58] border border-[#1e2d1b] bg-[#141f12] px-3 py-1.5 rounded-full active:scale-95 transition-all">⇄ Switch mode</button>
        </div>
      </header>

      <MapPane result={result} userLoc={userLoc} navigating={isNavigating} height={mapH} />

      <div className="flex-1 flex flex-col rounded-t-3xl bg-[#0f1c0d] mt-2 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,.35)]">
        <div className="mx-auto w-8 h-1 bg-[#1e2d1b] rounded-full mt-2.5 mb-1 shrink-0" />
        <div className="flex-1 overflow-y-auto px-5 py-3 gap-3 flex flex-col">

          {(phase === "locating") && <div className="flex-1 flex flex-col items-center justify-center gap-3"><div className="w-7 h-7 rounded-full border-2 border-[#4a7c59] border-t-transparent animate-spin" /><p className="text-[#5a7a58] text-sm">Getting your location…</p></div>}

          {(phase === "denied") && <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center"><p className="text-[#c8e0c0] text-sm font-medium">Location access denied</p><p className="text-[#4a6648] text-xs max-w-[240px] leading-relaxed">Allow location or type your starting point below.</p><button onClick={() => setPhase("ready")} className="text-xs text-[#7da87b] border border-[#2a3826] px-4 py-2 rounded-full active:scale-95">Continue</button></div>}

          {(phase === "ready" || phase === "searching") && (
            <>
              <div className="bg-[#141f12] border border-[#1e2d1b] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1a2718]">
                  <span className="text-base shrink-0">📍</span>
                  <input type="text" value={fromText} onChange={(e) => setFromText(e.target.value)} placeholder={userLoc ? "My location (GPS)" : "Where are you now?"} className="flex-1 bg-transparent text-sm text-[#c8e0c0] placeholder-[#3a4f38] outline-none" />
                  {userLoc && !fromText && <span className="shrink-0 text-[9px] text-[#4a7c59] font-semibold tracking-widest">GPS ●</span>}
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <span className="text-base shrink-0">🏁</span>
                  <input ref={inputRef} type="text" value={destination} onChange={(e) => setDest(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search(destination)} placeholder="Where are you going?" autoFocus className="flex-1 bg-transparent text-sm text-[#c8e0c0] placeholder-[#3a4f38] outline-none" />
                </div>
              </div>
              {error && <p className="text-red-400/80 text-xs px-1">{error}</p>}
              <button onClick={() => search(destination)} disabled={!destination.trim() || phase === "searching"}
                className="w-full py-4 rounded-2xl bg-[#4a7c59] flex items-center justify-center gap-2 text-white font-semibold text-sm shadow-lg shadow-[#4a7c59]/25 disabled:opacity-30 active:scale-[0.98] transition-all">
                {phase === "searching" ? <><div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />Finding route…</> : "Get Directions →"}
              </button>
              <div className="flex gap-2 flex-wrap">{QUICK.map(q => <button key={q} onClick={() => search(q)} className="text-xs text-[#5a7a58] border border-[#1e2d1b] bg-[#0d1a0b] px-3 py-1.5 rounded-full active:scale-95">{q}</button>)}</div>
            </>
          )}

          {(phase === "preview" && result) && (
            <>
              <div className="flex items-center justify-between">
                <div><p className="text-[9px] text-[#4a6648] tracking-widest uppercase">To</p><p className="text-[#c8e0c0] font-semibold text-base capitalize">{destination}</p></div>
                {totalFare !== null && <div className="bg-[#1a2d18] border border-[#2a3826] rounded-xl px-3 py-1.5 text-center"><p className="text-[#4a7c59] font-bold">₵{totalFare.toFixed(2)}</p><p className="text-[9px] text-[#4a6648]">total</p></div>}
              </div>
              <div className="relative pl-11">
                <div className="absolute left-[18px] top-5 h-[calc(100%-20px)] w-px bg-[#2a3826]" />
                <div className="relative mb-5">
                  <div className="absolute -left-11 w-9 h-9 rounded-full bg-[#4a7c59] flex items-center justify-center text-base shadow-md shadow-[#4a7c59]/30">🚶</div>
                  <p className="text-[#c8e0c0] text-sm font-semibold">Walk to {result.boardingStop.name}</p>
                  <p className="text-[#5a7a58] text-xs mt-1 leading-relaxed">{result.boardingStop.description}</p>
                  <p className="text-[#3d5c3a] text-xs mt-1">{formatDist(result.boardingStop.distanceM)} · ~{result.boardingStop.walkingMins} min</p>
                </div>
                {result.trotro && (
                  <div className="relative">
                    <div className="absolute -left-11 w-9 h-9 rounded-full bg-[#1a2d18] border-2 border-[#4a7c59] flex items-center justify-center text-base">🚐</div>
                    <p className="text-[#c8e0c0] text-sm font-semibold">{result.trotro.leg1.from} → {result.trotro.leg1.to}</p>
                    <p className="text-[#5a7a58] text-xs mt-1 leading-relaxed">{result.trotro.leg1.whatToLookFor}</p>
                    <p className="text-[#3d5c3a] text-xs mt-1">₵{result.trotro.leg1.fare.toFixed(2)} · ~{result.trotro.leg1.durationMins} min</p>
                  </div>
                )}
              </div>
              <button onClick={startNavigation} className="w-full py-4 rounded-2xl bg-[#4a7c59] text-white font-semibold text-sm shadow-lg shadow-[#4a7c59]/25 active:scale-[0.98] transition-all">Start Walking →</button>
            </>
          )}

          {(phase === "navigating" && currentStep) && (
            <>
              <div className="bg-[#4a7c59] rounded-2xl p-5 flex items-center gap-4">
                <div className="shrink-0 w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center"><span className="text-4xl font-black text-white leading-none">{currentStep.icon}</span></div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">{currentStep.instruction}</p>
                  {distToNext !== null ? <p className="text-white/60 text-sm mt-1">{formatDist(distToNext)}</p> : <p className="text-white/40 text-xs mt-1">{formatDist(currentStep.distanceM)} total</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 justify-center">
                {Array.from({ length: Math.min(totalSteps, 8) }).map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-300 ${i < stepIdx ? "w-1.5 h-1.5 bg-[#4a7c59]" : i === stepIdx ? "w-3 h-1.5 bg-[#4a7c59]" : "w-1.5 h-1.5 bg-[#2a3826]"}`} />
                ))}
              </div>
              {nextStep && (
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xl text-[#4a6648] shrink-0 w-6 text-center">{nextStep.icon}</span>
                  <div className="flex-1 min-w-0"><p className="text-[9px] text-[#3d5c3a] uppercase tracking-widest">Then</p><p className="text-[#7da87b] text-sm truncate">{nextStep.instruction}</p></div>
                  <span className="text-[#3d5c3a] text-xs shrink-0">{formatDist(nextStep.distanceM)}</span>
                </div>
              )}
            </>
          )}

          {(phase === "boarding" && result?.trotro) && (
            <>
              <div className="bg-[#4a7c59] rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-3"><span className="text-2xl">🚐</span><div><p className="text-white/60 text-xs tracking-widest uppercase">You're here</p><p className="text-white font-bold text-base">{result.boardingStop.name}</p></div></div>
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1.5">Listen for</p>
                  <p className="text-white font-semibold text-sm leading-relaxed">{result.trotro.leg1.whatToLookFor}</p>
                  <p className="text-white/40 text-xs mt-2">₵{result.trotro.leg1.fare.toFixed(2)} · ~{result.trotro.leg1.durationMins} min to {result.trotro.leg1.to}</p>
                </div>
              </div>
              <button onClick={() => setPhase("arrived")} className="w-full py-3.5 rounded-2xl bg-[#1a2d18] border border-[#2a3826] text-[#7da87b] text-sm font-medium active:scale-[0.98] transition-all">I'm on the trotro ✓</button>
            </>
          )}

          {phase === "arrived" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1a2d18] border border-[#2a3826] flex items-center justify-center text-3xl">🎉</div>
              <div><p className="text-[#c8e0c0] font-bold text-lg">On your way!</p><p className="text-[#5a7a58] text-sm mt-1">Heading to {destination}</p></div>
              <button onClick={reset} className="text-xs text-[#7da87b] border border-[#2a3826] px-5 py-2.5 rounded-full active:scale-95">Plan another trip</button>
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
