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
interface AlternateRoute { legs: TrotroLeg[]; totalMins: number; totalFare: number; }
interface StationOption {
  boardingStop: { name: string; lat: number; lng: number; description: string; distanceM: number; walkingMins: number };
  legs: TrotroLeg[];
  trotroToTerminal: { legs: TrotroLeg[]; totalMins: number; totalFare: number } | null;
  estimatedWaitMins: number;
  totalMins: number;
  totalFare: number;
  trafficNote: string | null;
}
interface DirectionsResult {
  routeFound: boolean;
  isIntercity: boolean;
  aiGuidance: string | null;
  alternateTrotro: AlternateRoute | null;
  stationOptions: StationOption[];
  destCoords:   { lat: number; lng: number };
  boardingStop: { name: string; lat: number; lng: number; description: string; distanceM: number; walkingMins: number };
  alightingStop: { name: string; lat: number; lng: number } | null;
  finalWalk: { distanceM: number; walkingMins: number } | null;
  walkingGeoJSON: object | null;
  steps: NavStep[];
  trotro: { legs: TrotroLeg[]; totalMins: number; alternateNote: string | null } | null;
}
type MsgType = "text" | "typing" | "route" | "navstep" | "chips" | "stations";
interface Msg {
  id: string; from: "bot" | "user"; type: MsgType; text?: string;
  timestamp: Date; result?: DirectionsResult; step?: NavStep;
  chips?: { label: string; action: string }[];
  fare?: number | null;
  stationOptions?: StationOption[];
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

function fareRange(fare: number): string {
  const lo = Math.floor(fare * 0.85);
  const hi = Math.ceil(fare * 1.2);
  if (lo === hi) return `~₵${lo}`;
  return `~₵${lo}–${hi}`;
}

function timeContext(): string | null {
  const h = new Date().getHours();
  if (h >= 6  && h < 9)  return "🚦 Rush hour — expect longer waits and full trotros.";
  if (h >= 16 && h < 20) return "🚦 Evening rush — trotros fill up fast right now.";
  if (h >= 21 || h < 5)  return "🌙 Late night — trotros may be infrequent. Confirm before heading out.";
  return null;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function vibrate() { try { navigator.vibrate?.(8); } catch { /* not supported */ } }


// ─── Markdown renderer ────────────────────────────────────────────────────────
// Parses **bold** and *italic* into React elements; leaves everything else as-is.
function renderText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} className="font-semibold text-content-primary">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*"))
      return <em key={i} className="not-italic text-content-secondary">{p.slice(1, -1)}</em>;
    return p;
  });
}

// ─── MapPane ──────────────────────────────────────────────────────────────────

function MapPane({ result, userLoc, navigating, height, expanded, mini, onToggleExpand }: {
  result: DirectionsResult | null;
  userLoc: { lat: number; lng: number } | null;
  navigating: boolean;
  height: string;
  expanded: boolean;
  mini: boolean;
  onToggleExpand: () => void;
}) {
  const map = (
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
        expanded={expanded}
      />
    </Suspense>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0d1a0b]">
        {map}
        <button
          onClick={onToggleExpand}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-[#0d1a0b]/80 border border-stroke backdrop-blur-sm flex items-center justify-center text-content-primary active:scale-90 transition-all shadow-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 overflow-hidden relative"
      style={{
        height: mini ? 0 : height,
        paddingLeft:  mini ? 0 : '1rem',
        paddingRight: mini ? 0 : '1rem',
        paddingTop:   mini ? 0 : '0.25rem',
        transition: 'height 580ms cubic-bezier(0.4,0,0.2,1), padding 580ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {map}
      {!mini && (
        <button
          onClick={onToggleExpand}
          className="absolute top-3.5 right-6 z-10 w-8 h-8 rounded-full bg-black/50 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 active:scale-90 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── RouteCard ────────────────────────────────────────────────────────────────

function RouteCard({ result, fare }: { result: DirectionsResult; fare: number | null }) {
  const [expanded, setExpanded] = useState(false);

  const legs        = result.trotro?.legs ?? [];
  const isIntercity = legs[0]?.transitType === "Intercity Bus";
  const destName    = legs.at(-1)?.to ?? "Destination";
  const totalFare   = fare ?? 0;
  const rideMins    = legs.reduce((s, l) => s + l.durationMins, 0);
  const totalMins   = isIntercity ? rideMins : (result.boardingStop.walkingMins + rideMins + (result.finalWalk?.walkingMins ?? 0));
  const rushHour    = (() => { const h = new Date().getHours(); return (h >= 6 && h < 9) || (h >= 16 && h < 20); })();

  return (
    <div className="rounded-2xl border border-stroke bg-surface-card w-full overflow-hidden">

      {/* Header: FROM → TO */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-stroke">
        <div className="flex-1 min-w-0">
          <p className="text-content-primary font-bold text-[15px] leading-tight truncate">
            {isIntercity ? result.boardingStop.name : result.boardingStop.name}
          </p>
          <p className="text-content-muted text-xs mt-0.5">→ {destName}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-accent font-black text-xl tabular-nums">{totalFare > 0 ? fareRange(totalFare) : "—"}</p>
          <p className="text-content-muted text-[11px]">~{totalMins} min</p>
        </div>
      </div>

      {/* Key info */}
      <div className="px-4 py-3.5">
        <p className="text-content-secondary text-[13px] leading-relaxed">
          {legs[0]?.whatToLookFor}
        </p>

        {!isIntercity && (
          <p className="text-content-muted text-xs mt-2">
            🚶 {formatDist(result.boardingStop.distanceM)} walk · {result.boardingStop.walkingMins} min from you
          </p>
        )}

        {rushHour && (
          <p className="text-[#f0c040]/80 text-xs mt-2">⏰ Fares may be higher during rush hour</p>
        )}
      </div>

      {/* Expandable breakdown — only for multi-leg or intercity */}
      {legs.length > 1 && (
        <div className="border-t border-stroke">
          <button onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 active:opacity-60">
            <p className="text-content-disabled text-[10px] uppercase tracking-widest">
              {legs.length} legs · tap to {expanded ? "collapse" : "expand"}
            </p>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={`text-content-disabled transition-transform ${expanded ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {expanded && (
            <div className="px-4 pb-3 space-y-2">
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <p className="text-content-primary text-[12px] flex-1 truncate">{leg.from} → {leg.to}</p>
                  <p className="text-content-muted text-[11px] shrink-0">~{leg.durationMins} min</p>
                  <p className="text-content-primary text-[12px] font-semibold shrink-0 tabular-nums">₵{leg.fare.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── StationsCard ─────────────────────────────────────────────────────────────

function StationsCard({ options, onSelect }: {
  options: StationOption[];
  onSelect: (opt: StationOption) => void;
}) {
  const [idx, setIdx] = useState(0);
  const opt = options[idx];
  const isIntercity = opt.legs[0]?.transitType === "Intercity Bus";
  const busLeg = opt.legs[0];
  const busHrs = busLeg ? Math.round(busLeg.durationMins / 60 * 10) / 10 : 0;
  const hasT = isIntercity && opt.trotroToTerminal && opt.trotroToTerminal.legs.length > 0;

  return (
    <div className="rounded-2xl border border-stroke bg-surface-card w-full overflow-hidden">
      {/* Dot indicator + recommended badge */}
      {options.length > 1 && (
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <div className="flex items-center gap-2">
            <p className="text-content-disabled text-[10px]">{idx + 1} of {options.length}</p>
            {idx === 0 && (
              <span className="text-[9px] font-semibold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Recommended
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {options.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-accent" : "bg-stroke"}`} />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-4">
        {/* Station name */}
        <p className="text-content-primary font-bold text-base leading-snug">{opt.boardingStop.name}</p>

        {/* Fare + time stats */}
        <div className="flex items-center gap-4 mt-3">
          <div>
            <p className="text-content-disabled text-[9px] uppercase tracking-widest">Total fare</p>
            <p className="text-content-primary font-bold text-lg tabular-nums">{fareRange(opt.totalFare)}</p>
          </div>
          <div className="w-px h-8 bg-stroke" />
          <div>
            <p className="text-content-disabled text-[9px] uppercase tracking-widest">{isIntercity ? "Bus time" : "Journey"}</p>
            <p className="text-content-primary font-bold text-lg">
              {isIntercity ? `~${busHrs} hr${busHrs !== 1 ? "s" : ""}` : `~${opt.totalMins} min`}
            </p>
          </div>
          <div className="w-px h-8 bg-stroke" />
          <div>
            <p className="text-content-disabled text-[9px] uppercase tracking-widest">{isIntercity ? "Terminal" : "Walk"}</p>
            <p className="text-content-primary font-bold text-lg">
              {isIntercity ? formatDist(opt.boardingStop.distanceM) : `${opt.boardingStop.walkingMins} min`}
            </p>
          </div>
        </div>

        {/* Intercity two-part journey breakdown */}
        {isIntercity && (
          <div className="mt-3 space-y-2">
            {hasT ? (
              <div className="bg-surface-elevated rounded-xl px-3 py-2.5">
                <p className="text-content-disabled text-[9px] uppercase tracking-widest mb-1.5">🚐 Trotro to terminal</p>
                {opt.trotroToTerminal!.legs.map((leg, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-content-secondary text-[11px] leading-snug">
                        <span className="font-medium">{leg.from} → {leg.to}</span>
                        <span className="text-content-muted"> · ~{leg.durationMins} min · {fareRange(leg.fare)}</span>
                      </p>
                      <p className="text-content-muted text-[10px] leading-snug mt-0.5">{leg.whatToLookFor}</p>
                    </div>
                  </div>
                ))}
                <p className="text-content-muted text-[10px] mt-1.5">
                  ~{opt.trotroToTerminal!.totalMins} min · {fareRange(opt.trotroToTerminal!.totalFare)}
                </p>
              </div>
            ) : (
              <div className="bg-surface-elevated rounded-xl px-3 py-2">
                <p className="text-content-muted text-[11px]">📍 {formatDist(opt.boardingStop.distanceM)} from your location</p>
              </div>
            )}
            <div className="bg-surface-elevated rounded-xl px-3 py-2.5">
              <p className="text-content-disabled text-[9px] uppercase tracking-widest mb-1">🚌 Intercity bus</p>
              <p className="text-content-secondary text-[11px] leading-snug">{busLeg?.whatToLookFor}</p>
              <p className="text-content-muted text-[10px] mt-1">{fareRange(busLeg?.fare ?? 0)} · ~{busHrs} hr{busHrs !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )}

        {/* Traffic note */}
        {opt.trafficNote && (
          <p className="text-[#f0c040]/80 text-xs mt-3">⚠ {opt.trafficNote}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4">
        <button onClick={() => onSelect(opt)}
          className="flex-1 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold active:scale-95 transition-all">
          Use this →
        </button>
        {options.length > 1 && (
          <button onClick={() => setIdx((idx + 1) % options.length)}
            className="px-4 py-2.5 rounded-xl border border-stroke text-content-secondary text-xs active:scale-95 transition-all">
            Next
          </button>
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
    ...(result.trotro?.legs ?? []).map((l, i) =>
      `${i === 0 ? "Trotro" : "Transfer"}: ${l.from} → ${l.to} (₵${l.fare.toFixed(2)})`
    ),
  ].join(" | ");

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
  const [deviceId,        setDeviceId]       = useState<string>("");
  const [mapMini,         setMapMini]        = useState(false);
  const [showMiniBtn,     setShowMiniBtn]    = useState(false);
  const [pendingClarification, setPendingClarification] = useState<{ destination: string; origin?: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt,   setInstallPrompt]  = useState<any>(null);
  const [showInstall,     setShowInstall]    = useState(false);
  const [starred,         setStarred]        = useState<{ origin: string; destination: string }[]>([]);
  const [containerH,      setContainerH]     = useState<string | null>(null);
  const [searchStatus,    setSearchStatus]   = useState<string | null>(null);
  const [mapExpanded,     setMapExpanded]    = useState(false);
  const [lang,            setLang]           = useState<"en" | "tw">("en");
  const [homePlace,       setHomePlace]      = useState<{ name: string } | null>(null);
  const [workPlace,       setWorkPlace]      = useState<{ name: string } | null>(null);
  const [welcomeKey,      setWelcomeKey]     = useState(0);
  const [suggestions,     setSuggestions]    = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isOffline,       setIsOffline]      = useState(false);
  const [routeFeedback,   setRouteFeedback]  = useState<Record<string, "up" | "down">>({});

  // ── Refs ───────────────────────────────────────────────────────────────────
  const bottomRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const resultRef    = useRef<DirectionsResult | null>(null);
  const stepIdxRef   = useRef(0);
  const voiceOnRef   = useRef(false);
  const langRef      = useRef<"en" | "tw">("en");
  const translationCache = useRef(new Map<string, string>());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef   = useRef<any>(null);
  const lastSearchRef        = useRef<{ destination: string; fromAddress?: string; coords?: { lat: number; lng: number } } | null>(null);
  const searchStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => { resultRef.current  = result;  }, [result]);
  useEffect(() => { stepIdxRef.current = stepIdx; }, [stepIdx]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { langRef.current    = lang;    }, [lang]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Auto-collapse map 3 seconds after app opens
  useEffect(() => {
    const t = setTimeout(() => {
      setMapMini(true);
      setTimeout(() => setShowMiniBtn(true), 480);
    }, 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-expand map when navigating starts
  useEffect(() => {
    if (navigating) { setMapMini(false); setShowMiniBtn(false); }
  }, [navigating]);

  // ── Device ID + recent search history ────────────────────────────────────
  useEffect(() => {
    const KEY = "sf_device_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    setDeviceId(id);
    fetch(`/api/history?id=${encodeURIComponent(id)}`).catch(() => {});
    // Load starred routes from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem("sf_starred") ?? "[]");
      if (Array.isArray(saved)) setStarred(saved);
    } catch { /* ignore */ }
    // Load home/work/lang
    try {
      const h = localStorage.getItem("sf_home"); if (h) setHomePlace(JSON.parse(h));
      const w = localStorage.getItem("sf_work"); if (w) setWorkPlace(JSON.parse(w));
      const l = localStorage.getItem("sf_lang") as "en" | "tw" | null; if (l) setLang(l);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Boot: deep link + speech detection ────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const dest = new URLSearchParams(window.location.search).get("to");
    if (dest?.trim()) {
      setDeepLinkDest(dest.trim());
      window.history.replaceState({}, "", window.location.pathname);
    }
    setHasSpeech("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

    // Capture PWA install prompt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ── Offline detection ─────────────────────────────────────────────────────
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const on  = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Android keyboard: shrink container to visual viewport height ──────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vv = (window as any).visualViewport as (EventTarget & { height: number }) | null;
    if (!vv) return;
    const update = () => setContainerH(`${vv.height}px`);
    vv.addEventListener("resize", update);
    update();
    return () => vv.removeEventListener("resize", update);
  }, []);

  // ── Message helpers ────────────────────────────────────────────────────────
  const addMsg      = useCallback((m: Omit<Msg, "id" | "timestamp">) =>
    setMsgs(p => [...p, { id: uid(), timestamp: new Date(), ...m }]), []);
  const removeTyping = useCallback(() =>
    setMsgs(p => p.filter(m => m.type !== "typing")), []);

  // ── Twi translation (Gemini, session-cached) ──────────────────────────────
  const translateText = useCallback(async (text: string): Promise<string> => {
    if (langRef.current !== "tw") return text;
    const cached = translationCache.current.get(text);
    if (cached) return cached;
    try {
      const r = await fetch("/api/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (r.ok) {
        const { translated } = await r.json() as { translated: string };
        translationCache.current.set(text, translated);
        return translated;
      }
    } catch { /* use original */ }
    return text;
  }, []);

  // ── botSay: sequential bot messages with natural typing pauses ────────────
  const botSay = useCallback(async (...msgs: Omit<Msg, "id" | "timestamp" | "from">[]) => {
    // Translate text messages if Twi mode is on
    const toSend = langRef.current === "tw"
      ? await Promise.all(msgs.map(async (m) =>
          m.type === "text" && m.text ? { ...m, text: await translateText(m.text) } : m))
      : msgs;

    for (const m of toSend) {
      if (m.type === "text") {
        setMsgs(p => [...p, { id: uid(), from: "bot", type: "typing", timestamp: new Date() } as Msg]);
        const ms = Math.min(2000, 700 + ((m.text?.length ?? 0) * 22));
        await new Promise<void>(r => setTimeout(r, ms));
        setMsgs(p => p.filter(x => x.type !== "typing"));
      } else {
        await new Promise<void>(r => setTimeout(r, 120));
      }
      setMsgs(p => [...p, { id: uid(), from: "bot", timestamp: new Date(), ...m } as Msg]);
      if (m.type !== "chips") await new Promise<void>(r => setTimeout(r, 420));
    }
  }, [translateText]);

  // ── Clear chat — resets session and triggers fresh welcome ────────────────
  const clearChat = useCallback(() => {
    sessionStorage.removeItem("sf_msgs");
    setMsgs([]);
    setResult(null);
    setProcessing(false);
    setNavigating(false);
    setKnownOrigin(null);
    setPendingDest(null);
    setStepIdx(0);
    setWelcomeKey(k => k + 1);
  }, []);

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

  // ── On mount / after clear: restore session or show welcome ─────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Bump this string any time the session message format changes — clears stale sessions.
    const SESSION_VERSION = "v4";
    if (sessionStorage.getItem("sf_session_ver") !== SESSION_VERSION) {
      sessionStorage.removeItem("sf_msgs");
      sessionStorage.setItem("sf_session_ver", SESSION_VERSION);
    }
    const saved = welcomeKey === 0 ? sessionStorage.getItem("sf_msgs") : null;
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

    const EXAMPLE_CHIPS = [
      { label: "Madina", action: "dest:Madina" },
      { label: "Circle", action: "dest:Circle" },
      { label: "Kaneshie", action: "dest:Kaneshie" },
      { label: "Legon", action: "dest:Legon" },
    ];

    const askManually = () => {
      botSay(
        { type: "text", text: "Akwaaba! Where are you going?" },
        { type: "chips", chips: EXAMPLE_CHIPS },
      );
    };

    const onGpsDenied = () => {
      setMsgs(p => p.filter(m => m.text !== "📍 Getting your location…"));
      botSay(
        { type: "text", text: "Location is off. Turn it on in your settings, or just tell me where you are and I'll work from there." },
        { type: "chips", chips: [
          { label: "📍 Try again", action: "retry_gps" },
          { label: "I'll type my location", action: "dismiss" },
        ]},
      );
    };

    if (!navigator.geolocation) { askManually(); return; }

    addMsg({ from: "bot", type: "text", text: "📍 Getting your location…" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setMsgs(p => p.filter(m => m.text !== "📍 Getting your location…"));
        botSay(
          { type: "text", text: "📍 Got your location. Where are you heading?" },
          { type: "chips", chips: EXAMPLE_CHIPS },
        );
      },
      (err) => {
        if (err.code === 1) { onGpsDenied(); }
        else {
          setMsgs(p => p.filter(m => m.text !== "📍 Getting your location…"));
          askManually();
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeKey]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const search = useCallback(async (destination: string, fromAddress?: string, coords?: { lat: number; lng: number }) => {
    lastSearchRef.current = { destination, fromAddress, coords };
    setProcessing(true);
    setSearchStatus("Checking trotro routes…");
    if (searchStatusTimerRef.current) clearTimeout(searchStatusTimerRef.current);
    searchStatusTimerRef.current = setTimeout(() => setSearchStatus("Almost there…"), 3000);
    setTimeout(() => addMsg({ from: "bot", type: "typing" }), 200);
    const body: Record<string, unknown> = { destination };
    if (fromAddress)  body.fromAddress = fromAddress;
    else if (coords)  { body.userLat = coords.lat; body.userLng = coords.lng; }
    else              { body.userLat = 5.6863; body.userLng = -0.1488; }
    try {
      const { ok, data } = await fetchDirections(body);
      removeTyping();
      if (searchStatusTimerRef.current) { clearTimeout(searchStatusTimerRef.current); searchStatusTimerRef.current = null; }
      setSearchStatus(null);
      if (!ok) {
        await botSay(
          { type: "text", text: `Hmm, I couldn't place **${destination}** on the map.` },
          { type: "text", text: "Try a nearby landmark or area — like *Madina*, *Circle*, or *Tema*." },
        );
        setProcessing(false); return;
      }

      if (!data.routeFound) {
        if (data.aiGuidance) {
          await botSay(
            { type: "text", text: data.aiGuidance },
            { type: "text", text: "I don't have that route in my database yet — always confirm the fare at the terminal." },
          );
        } else {
          await botSay(
            { type: "text", text: `I don't have a verified route to **${destination}** yet.` },
            { type: "text", text: `Nearest stop to you is **${data.boardingStop.name}** — head there and ask around.` },
          );
        }
        setProcessing(false); return;
      }

      // ── Intercity: Station Intelligence — recommend best terminal with reasoning ─
      if (data.isIntercity) {
        const opts = data.stationOptions ?? [];
        if (opts.length > 0) {
          const best = opts[0]; // sorted by totalFare → totalMins
          const busHrs = Math.round((best.legs[0]?.durationMins ?? 0) / 60 * 10) / 10;

          let summary: string;
          if (opts.length === 1) {
            summary = `**${best.boardingStop.name}** is your stop for **${destination}**.${best.trotroToTerminal ? " I've mapped out how to get there from where you are." : ""}`;
          } else {
            const nearest = [...opts].sort((a, b) => a.boardingStop.distanceM - b.boardingStop.distanceM)[0];
            const nearestIsBest = nearest.boardingStop.name === best.boardingStop.name;

            if (!nearestIsBest) {
              const fareDiff = nearest.totalFare - best.totalFare;
              const timeDiff = nearest.totalMins - best.totalMins;
              const why = fareDiff > 5
                ? `you'd pay ~₵${Math.round(fareDiff)} more`
                : timeDiff > 10
                  ? `it adds ~${Math.round(timeDiff)} min to your total journey`
                  : "it's not the best fit for this route";
              summary = `${opts.length} terminals serve **${destination}** from Accra. I'd go with **${best.boardingStop.name}** — **${nearest.boardingStop.name}** is closer to you but ${why}. Swipe through to compare.`;
            } else {
              summary = `${opts.length} terminals serve **${destination}** from Accra. **${best.boardingStop.name}** is the one — ${fareRange(best.totalFare)} all-in, ~${busHrs} hr${busHrs !== 1 ? "s" : ""} on the bus. Compare all options below.`;
            }
          }

          await botSay({ type: "text", text: summary });
          addMsg({ from: "bot", type: "stations", stationOptions: opts });
        } else if (data.aiGuidance) {
          await botSay({ type: "text", text: data.aiGuidance });
        }
        setProcessing(false); return;
      }

      // ── Local: show station options then route card ───────────────────────────
      if (data.stationOptions && data.stationOptions.length > 1) {
        setMsgs(p => [...p, { id: uid(), from: "bot", type: "typing", timestamp: new Date() } as Msg]);
        await new Promise<void>(r => setTimeout(r, 600));
        setMsgs(p => p.filter(x => x.type !== "typing"));
        addMsg({ from: "bot", type: "stations", stationOptions: data.stationOptions });
        await new Promise<void>(r => setTimeout(r, 350));
      }

      // Brief pause so route card doesn't snap in instantly after typing dots
      setMsgs(p => [...p, { id: uid(), from: "bot", type: "typing", timestamp: new Date() } as Msg]);
      await new Promise<void>(r => setTimeout(r, 700));
      setMsgs(p => p.filter(x => x.type !== "typing"));

      setResult(data);
      const fare = data.trotro?.legs?.reduce((s, l) => s + l.fare, 0) ?? null;
      addMsg({ from: "bot", type: "route", result: data, fare });
      try { localStorage.setItem("sf_last_route", JSON.stringify({ result: data, fare, destination })); } catch { /* storage full */ }

      // Show install prompt after first successful route (once only)
      if (installPrompt && !localStorage.getItem("sf_install_dismissed")) {
        setShowInstall(true);
      }

      // Save to history (fire-and-forget)
      if (deviceId) {
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, origin: data.boardingStop.name, destination }),
        }).catch(() => {});
      }

      // Follow-up messages after route card
      if (!fromAddress && data.boardingStop.distanceM > 2000) {
        await botSay(
          { type: "text", text: "Your starting point looks a bit far — your GPS might be slightly off." },
          { type: "text", text: `You can also tell me where you are: *From Teiman to ${destination}*` },
        );
      } else {
        const extras: Omit<Msg, "id" | "timestamp" | "from">[] = [];
        const rushCtx = timeContext();
        if (rushCtx) extras.push({ type: "text", text: rushCtx });
        if (data.boardingStop.walkingMins > 10) {
          extras.push({ type: "text", text: `Heads up — it's about a ${data.boardingStop.walkingMins}-min walk to that stop. 🚶` });
        }
        extras.push({ type: "chips", chips: [
          { label: "Start Navigation →", action: "start_nav" },
        ]});
        await botSay(...extras);
      }
    } catch {
      removeTyping();
      if (searchStatusTimerRef.current) { clearTimeout(searchStatusTimerRef.current); searchStatusTimerRef.current = null; }
      setSearchStatus(null);
      if (!navigator.onLine) {
        const cached = (() => { try { return JSON.parse(localStorage.getItem("sf_last_route") ?? "null"); } catch { return null; } })();
        if (cached?.result) {
          setResult(cached.result);
          addMsg({ from: "bot", type: "route", result: cached.result, fare: cached.fare });
          await botSay({ type: "text", text: `📶 Offline — showing your last saved route to **${cached.destination}**.` });
        } else {
          await botSay(
            { type: "text", text: "📶 No connection right now, and no saved route yet." },
            { type: "text", text: "Once you travel a route, it'll be saved here for offline use." },
          );
        }
      } else {
        await botSay(
          { type: "text", text: "Couldn't reach the server — check your connection and try again." },
          { type: "chips", chips: [{ label: "Retry →", action: "retry_last" }] },
        );
      }
    }
    setProcessing(false);
  }, [addMsg, removeTyping, botSay, deviceId, homePlace, workPlace]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || processing) return;
    addMsg({ from: "user", type: "text", text: t });
    setInput("");
    setSuggestions([]); setShowSuggestions(false);
    if (inputRef.current) inputRef.current.style.height = "auto";

    if (navigating) {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
      setNavigating(false);
    }

    // ── Respond to a clarification question (e.g. "Did you mean Koforidua?") ─
    if (pendingClarification) {
      const affirm = /^(yes|yeah|yep|yh|yea|right|correct|exactly|ok|okay|sure|ja)/i.test(t);
      const stored = pendingClarification;
      setPendingClarification(null);
      if (affirm) {
        if (userLoc)          await search(stored.destination, undefined, userLoc);
        else if (stored.origin) await search(stored.destination, stored.origin);
        else if (knownOrigin)   await search(stored.destination, knownOrigin);
        else { setPendingDest(stored.destination); await botSay({ type: "text", text: "Where are you coming from?" }); }
        return;
      }
      // Not affirming — fall through and treat as fresh input
    }

    // "Take me home / to work" shortcuts
    if (/\b(take me home|go home|i want to go home|head home)\b/i.test(t) && homePlace) {
      if (userLoc) { await search(homePlace.name, undefined, userLoc); return; }
      if (knownOrigin) { await search(homePlace.name, knownOrigin); return; }
      setPendingDest(homePlace.name); await botSay({ type: "text", text: "Where are you coming from?" }); return;
    }
    if (/\b(take me to work|go to work|i want to go to work|head to work)\b/i.test(t) && workPlace) {
      if (userLoc) { await search(workPlace.name, undefined, userLoc); return; }
      if (knownOrigin) { await search(workPlace.name, knownOrigin); return; }
      setPendingDest(workPlace.name); await botSay({ type: "text", text: "Where are you coming from?" }); return;
    }

    // If we're waiting for the user to supply their origin
    if (pendingDest) {
      setPendingDest(null);
      await search(pendingDest, t);
      return;
    }

    // ── Gemini intent extraction (2.5 s timeout → regex fallback) ──────────
    const msgHistory = msgs
      .filter((m) => m.type === "text" && m.text)
      .slice(-8)
      .map((m) => ({ role: m.from === "user" ? "user" : "assistant", text: m.text! }));

    const gemini = await Promise.race([
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t, history: msgHistory }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ intent: string; origin: string | null; destination: string | null; locatedAt: string | null; clarificationQuestion: string | null }>) : null))
        .catch(() => null),
      new Promise<null>((res) => setTimeout(() => res(null), 2500)),
    ]);

    // ── If Gemini is asking for clarification, surface it ─────────────────
    if (gemini?.clarificationQuestion) {
      if (gemini.destination) {
        setPendingClarification({ destination: gemini.destination, origin: gemini.origin ?? undefined });
      }
      await botSay({ type: "text", text: gemini.clarificationQuestion });
      setProcessing(false);
      return;
    }

    // Merge with regex fallback
    const regexParsed = parseInput(t);
    const destination = gemini?.destination ?? regexParsed.destination;
    const fromAddress = gemini?.origin      ?? regexParsed.fromAddress;
    const locatedAt   = gemini?.locatedAt   ?? regexParsed.locatedAt;

    // Pure location update — user told us where they are
    if ((gemini?.intent === "location_update" || (!destination && locatedAt))) {
      const place = locatedAt ?? t;
      setKnownOrigin(place);
      await botSay({ type: "text", text: `Got it — you're at **${place}**. Where to?` });
      return;
    }

    // Non-travel intent (greeting, question, etc.)
    if (gemini?.intent === "other" && !destination) {
      await botSay({ type: "text", text: "What's your destination? Say something like *Madina* or *Takoradi* and I'll sort you out." });
      return;
    }

    if (!destination) return;

    if (fromAddress)      await search(destination, fromAddress);
    else if (userLoc)     await search(destination, undefined, userLoc);
    else if (knownOrigin) await search(destination, knownOrigin);
    else {
      setPendingDest(destination);
      await botSay(
        { type: "text", text: "Where are you right now?" },
        { type: "text", text: "Just the area — like *Madina* or *Circle*." },
      );
    }
  }, [addMsg, botSay, pendingDest, pendingClarification, processing, navigating, watchId, search, userLoc, knownOrigin, msgs, homePlace, workPlace]);

  // ── Deep link trigger (after send is defined) ─────────────────────────────
  useEffect(() => {
    if (!deepLinkDest || msgs.length === 0 || processing) return;
    const t = setTimeout(() => { send(deepLinkDest); setDeepLinkDest(null); }, 500);
    return () => clearTimeout(t);
  }, [deepLinkDest, msgs.length, processing, send]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const startNavigation = useCallback(async () => {
    if (!resultRef.current?.steps.length) return;
    setNavigating(true); setStepIdx(0);
    const first = resultRef.current.steps[0];
    await botSay({ type: "text", text: "Let's go 🚶" });
    addMsg({ from: "bot", type: "navstep", step: first });
    if (voiceOnRef.current) speak(first.instruction);
    const id = navigator.geolocation.watchPosition((p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      setUserLoc(pos);
      const res = resultRef.current; const idx = stepIdxRef.current;
      if (!res) return;
      if (haversineM(pos, { lat: res.boardingStop.lat, lng: res.boardingStop.lng }) < 25) {
        setNavigating(false); navigator.geolocation.clearWatch(id); setWatchId(null);
        const leg = res.trotro?.legs[0];
        botSay(
          { type: "text", text: `You're at **${res.boardingStop.name}**! 🚐` },
          ...(leg ? [{ type: "text" as const, text: `${leg.whatToLookFor}\n\n${fareRange(leg.fare)} · ~${leg.durationMins} min to **${leg.to}**` }] : [{ type: "text" as const, text: "Board here." }]),
        );
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
  }, [botSay, addMsg]);

  const toggleStar = useCallback((origin: string, destination: string) => {
    setStarred((prev) => {
      const exists = prev.some((s) => s.origin === origin && s.destination === destination);
      const next = exists
        ? prev.filter((s) => !(s.origin === origin && s.destination === destination))
        : [{ origin, destination }, ...prev].slice(0, 5);
      localStorage.setItem("sf_starred", JSON.stringify(next));
      return next;
    });
  }, []);

  const stopNavigation = useCallback(() => {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); setWatchId(null); }
    setNavigating(false);
    botSay({ type: "text", text: "Stopped. Where next?" });
  }, [watchId, botSay]);

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
    vibrate();
    if (action.startsWith("dest:"))      { send(action.slice(5)); return; }
    if (action === "retry_last")         { const l = lastSearchRef.current; if (l) search(l.destination, l.fromAddress, l.coords); return; }
    if (action === "dismiss") {
      const dest = lastSearchRef.current?.destination;
      botSay({
        type: "text",
        text: dest
          ? `No problem — when you get to the terminal, ask the station master for the next bus to **${dest}**. They'll point you to the right bay.`
          : "No problem — check with the station master when you arrive and they'll direct you.",
      });
      return;
    }
    if (action.startsWith("trotro_to:")) {
      const terminal = action.slice(10);
      if (userLoc)      search(terminal, undefined, userLoc);
      else if (knownOrigin) search(terminal, knownOrigin);
      else { setPendingDest(terminal); botSay({ type: "text", text: "Where are you coming from?" }); }
      return;
    }
    if (action === "go_home")            { if (homePlace) send(homePlace.name); return; }
    if (action === "go_work")            { if (workPlace) send(workPlace.name); return; }
    if (action.startsWith("save_home:")) {
      const place = { name: action.slice(10) };
      setHomePlace(place); localStorage.setItem("sf_home", JSON.stringify(place));
      botSay({ type: "text", text: `🏠 Saved **${place.name}** as Home. Just say "take me home" next time.` }); return;
    }
    if (action.startsWith("save_work:")) {
      const place = { name: action.slice(10) };
      setWorkPlace(place); localStorage.setItem("sf_work", JSON.stringify(place));
      botSay({ type: "text", text: `💼 Saved **${place.name}** as Work. Say "take me to work" anytime.` }); return;
    }
    if (action === "start_nav") startNavigation();
    if (action === "map_it")   router.push("/map-it");
    if (action === "retry_gps") {
      navigator.geolocation?.getCurrentPosition(
        (p) => {
          setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
          botSay({ type: "text", text: "📍 Got your location. Where are you heading?" });
        },
        () => botSay({
          type: "text",
          text: "Still off. Go to your phone settings and allow location for this browser, or just tell me where you are.",
        }),
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
    if (action === "share_wa") {
      const r = resultRef.current;
      if (!r) return;
      const waLegs = r.trotro?.legs ?? [];
      const fare   = waLegs.length ? waLegs.reduce((s, l) => s + l.fare, 0).toFixed(2) : null;
      const text = [
        `🚐 *Station Finder Route*`, ``,
        `🚶 Walk to *${r.boardingStop.name}* (~${r.boardingStop.walkingMins} min)`,
        `📍 ${r.boardingStop.description}`,
        waLegs[0] ? `` : null,
        waLegs[0] ? `🚐 Board: *${waLegs[0].whatToLookFor}*` : null,
        waLegs[0] ? `➡️ ${waLegs[0].from} → ${waLegs[waLegs.length - 1].to}` : null,
        fare      ? `💰 Fare: *~₵${fare}* (estimate)` : null,
        ``, `Find yours 👉 https://stationfinder.vercel.app`,
      ].filter((l) => l !== null).join("\n");
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  }, [startNavigation, router, search, send, homePlace, workPlace, botSay]);

  // ── Map height ─────────────────────────────────────────────────────────────
  const mapH = navigating ? "48vh" : result ? "38vh" : "32vh";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-canvas" style={{ height: containerH ?? "100dvh" }} suppressHydrationWarning>

      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-sm shrink-0">🚐</div>
          <p className="text-content-primary text-sm font-semibold leading-none">
            Station Finder <span className="text-[10px] text-content-muted font-normal">{navigating ? "● Navigating" : "● Accra Pilot"}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {navigating && (
            <button onClick={stopNavigation}
              className="whitespace-nowrap text-[10px] text-[#f0c040]/80 border border-[#f0c040]/20 px-2.5 py-1.5 rounded-full active:scale-95">
              Stop
            </button>
          )}
          {/* Twi toggle */}
          <button
            onClick={() => {
              const next = lang === "en" ? "tw" : "en";
              setLang(next);
              localStorage.setItem("sf_lang", next);
              translationCache.current.clear();
              botSay({ type: "text", text: next === "tw" ? "Twi mode yɛ so. Mɛkasa Twi." : "Back to English." });
            }}
            className={`whitespace-nowrap text-[10px] px-2.5 py-1.5 rounded-full border active:scale-95 transition-all ${lang === "tw" ? "bg-accent/20 text-accent border-accent/40" : "text-content-muted border-stroke"}`}
          >
            {lang === "tw" ? "TW" : "EN"}
          </button>
          <button onClick={() => setVoiceOn(v => !v)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all active:scale-90 shrink-0 ${voiceOn ? "bg-accent text-white" : "text-content-muted"}`}>
            {voiceOn ? "🔊" : "🔇"}
          </button>
          {!navigating && (
            <>
              <button onClick={clearChat}
                className="whitespace-nowrap text-[10px] text-content-muted border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all">
                ✕ Clear
              </button>
              <Link href="/map-it"
                className="whitespace-nowrap flex items-center gap-1 text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all">
                📍 Map It
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Map */}
      <MapPane result={result} userLoc={userLoc} navigating={navigating} height={mapH} expanded={mapExpanded} mini={mapMini} onToggleExpand={() => setMapExpanded(v => !v)} />

      {/* Mini map thumbnail — snaps into top-right corner when map collapses */}
      <button
        onClick={() => { setMapMini(false); setShowMiniBtn(false); }}
        aria-label="Expand map"
        className="fixed z-40 w-14 h-14 rounded-2xl bg-surface-card border border-stroke shadow-xl flex flex-col items-center justify-center gap-0.5 active:scale-90"
        style={{
          top: '56px', left: '50%',
          transform: showMiniBtn ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0)',
          opacity: showMiniBtn ? 1 : 0,
          transformOrigin: 'top center',
          transition: showMiniBtn
            ? 'transform 380ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms'
            : 'transform 200ms ease-in, opacity 150ms',
          pointerEvents: showMiniBtn ? 'auto' : 'none',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none"/>
        </svg>
        <span className="text-[8px] text-content-secondary font-medium uppercase tracking-wide">Map</span>
      </button>

      {/* Chat sheet */}
      <div className="flex-1 flex flex-col rounded-t-3xl bg-raised mt-2 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,.35)] relative">
        <div className="mx-auto w-8 h-1 bg-stroke rounded-full mt-2.5 mb-1 shrink-0" />

        {/* Offline banner */}
        {isOffline && (
          <div className="shrink-0 mx-4 mb-2 bg-surface-card border border-stroke rounded-xl px-4 py-2.5 flex items-center gap-2.5">
            <span className="text-sm">📶</span>
            <p className="text-content-secondary text-xs flex-1">You're offline — showing last saved route</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Welcome back card — shown on fresh chat when shortcuts exist */}
          {msgs.filter(m => m.from === "user").length === 0 && (starred.length > 0 || homePlace || workPlace) && (
            <div className="flex flex-col gap-3">
              <p className="text-content-secondary text-sm font-medium">Akwaaba back 👋</p>

              {/* Home / Work quick shortcuts */}
              {(homePlace || workPlace) && (
                <div className="flex gap-2">
                  {homePlace && (
                    <button onClick={() => onChip("go_home")} disabled={processing}
                      className="flex-1 flex items-center gap-2 bg-surface-card border border-stroke rounded-2xl px-4 py-3 active:opacity-60 disabled:opacity-40 transition-opacity">
                      <span className="text-base">🏠</span>
                      <div className="text-left min-w-0">
                        <p className="text-content-primary text-xs font-semibold leading-tight">Home</p>
                        <p className="text-content-muted text-[10px] truncate">{homePlace.name}</p>
                      </div>
                    </button>
                  )}
                  {workPlace && (
                    <button onClick={() => onChip("go_work")} disabled={processing}
                      className="flex-1 flex items-center gap-2 bg-surface-card border border-stroke rounded-2xl px-4 py-3 active:opacity-60 disabled:opacity-40 transition-opacity">
                      <span className="text-base">💼</span>
                      <div className="text-left min-w-0">
                        <p className="text-content-primary text-xs font-semibold leading-tight">Work</p>
                        <p className="text-content-muted text-[10px] truncate">{workPlace.name}</p>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Starred routes */}
              {starred.length > 0 && (
                <div className="bg-surface-card border border-stroke rounded-2xl px-4 py-3 flex flex-col gap-2">
                  <p className="text-content-disabled text-[9px] uppercase tracking-widest">★ Saved routes</p>
                  {starred.map((s, i) => (
                    <button key={i}
                      onClick={() => send(`From ${s.origin} to ${s.destination}`)}
                      disabled={processing}
                      className="text-left text-xs text-content-primary active:opacity-60 disabled:opacity-40"
                    >
                      {s.origin.split(" ")[0]} → {s.destination.charAt(0).toUpperCase() + s.destination.slice(1)}
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}

          {msgs.map((msg) => {
            if (msg.type === "typing") return (
              <div key={msg.id} className="flex gap-2.5 items-end">
                <div className="w-7 h-7 rounded-full bg-surface-elevated border border-stroke flex items-center justify-center text-xs shrink-0">🚐</div>
                <div className="bg-surface-card border border-stroke rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-card">
                  {searchStatus ? (
                    <p className="text-content-secondary text-[12px] leading-none">{searchStatus}</p>
                  ) : (
                    <div className="flex gap-1.5 items-center h-3.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-content-muted animate-bounce"
                             style={{ animationDelay: `${i * 180}ms`, animationDuration: "0.9s" }} />
                      ))}
                    </div>
                  )}
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
                      {renderText(msg.text ?? "")}
                    </div>
                  )}
                  {msg.type === "route" && msg.result && (() => {
                    const r = msg.result!;
                    const legs = r.trotro?.legs ?? [];
                    const destLabel = legs[legs.length - 1]?.to ?? "destination";
                    const isS = starred.some(s => s.origin === r.boardingStop.name && s.destination === destLabel);
                    const feedback = routeFeedback[msg.id];
                    return (
                      <>
                        <RouteCard result={r} fare={msg.fare ?? null} />
                        <div className="flex items-center gap-3 mt-1.5 ml-1 flex-wrap">
                          {/* Thumbs */}
                          <div className="flex items-center gap-1.5">
                            {(["up","down"] as const).map(dir => (
                              <button key={dir}
                                onClick={() => {
                                  vibrate();
                                  setRouteFeedback(p => ({ ...p, [msg.id]: dir }));
                                  fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ destination: destLabel, boardingStop: r.boardingStop.name, helpful: dir === "up" }) }).catch(() => {});
                                }}
                                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                                  feedback === dir ? (dir === "up" ? "bg-accent/20 text-accent border-accent/40" : "bg-[#991b1b]/20 text-status-danger border-[#991b1b]/40") : "text-content-disabled border-stroke"
                                }`}>
                                {dir === "up" ? "👍" : "👎"}
                              </button>
                            ))}
                            {feedback && <span className="text-content-muted text-[10px]">{feedback === "up" ? "Thanks!" : "Got it — we'll improve."}</span>}
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            <button onClick={() => { vibrate(); onChip("share_wa"); }}
                              className="text-[10px] text-content-disabled hover:text-content-muted active:opacity-60 transition-colors">
                              📤 Share
                            </button>
                            <span className="text-content-disabled text-[10px]">·</span>
                            <button onClick={() => toggleStar(r.boardingStop.name, destLabel)}
                              className={`text-[10px] active:opacity-60 transition-colors ${isS ? "text-[#f59e0b]" : "text-content-disabled hover:text-content-muted"}`}>
                              {isS ? "★ Saved" : "☆ Save"}
                            </button>
                            <span className="text-content-disabled text-[10px]">·</span>
                            <button onClick={() => setReportingResult(r)}
                              className="text-[10px] text-content-disabled hover:text-content-muted active:opacity-60 transition-colors">
                              ⚠ Report
                            </button>
                            <span className="text-content-disabled text-[10px]">·</span>
                            <button onClick={() => { setMsgs(p => p.filter(m => m.id !== msg.id)); setResult(null); }}
                              className="text-[10px] text-content-disabled hover:text-content-muted active:opacity-60 transition-colors">
                              ✕
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  {msg.type === "stations" && msg.stationOptions && (
                    <StationsCard
                      options={msg.stationOptions}
                      onSelect={(opt) => {
                        const isIntercity = opt.legs[0]?.transitType === "Intercity Bus";
                        if (isIntercity) {
                          const dest = lastSearchRef.current?.destination ?? "your destination";
                          const busLeg = opt.legs[0];
                          const hrs = Math.round(busLeg.durationMins / 60 * 10) / 10;
                          const t = opt.trotroToTerminal;

                          if (t && t.legs.length > 0) {
                            const firstLeg = t.legs[0];
                            botSay(
                              { type: "text", text: `Right. Here's your plan for **${dest}**:` },
                              { type: "text", text: `🚐 *Getting to the terminal:* ${firstLeg.whatToLookFor}${t.legs.length > 1 ? ` — change at ${t.legs.at(-1)?.from}` : ""}. About ${t.totalMins} min, ${fareRange(t.totalFare)}.` },
                              { type: "text", text: `🚌 *At ${opt.boardingStop.name}:* ${busLeg.whatToLookFor} — ~${hrs} hr${hrs !== 1 ? "s" : ""}, ${fareRange(busLeg.fare)}.` },
                            );
                          } else {
                            botSay(
                              { type: "text", text: `You're close to **${opt.boardingStop.name}**. Here's what to do:` },
                              { type: "text", text: busLeg.whatToLookFor },
                            );
                          }
                        } else {
                          const dest = lastSearchRef.current?.destination;
                          if (dest) search(dest, opt.boardingStop.name);
                        }
                      }}
                    />
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

        {/* Autocomplete suggestions — absolute overlay floating above the input bar */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bottom-[80px] left-4 right-4 z-20 bg-surface-card border border-stroke rounded-2xl shadow-2xl overflow-hidden">
            {suggestions.map((name) => (
              <button key={name} onMouseDown={(e) => { e.preventDefault(); send(name); setSuggestions([]); setShowSuggestions(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-stroke last:border-0 active:bg-surface-elevated transition-colors text-left">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-content-muted shrink-0">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <span className="text-content-primary text-[13px]">{name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="shrink-0 px-4 pb-safe pb-5 pt-3 flex gap-3 items-end border-t border-stroke">
          <div className="flex-1 bg-surface-card border border-stroke rounded-2xl px-4 py-3 focus-within:border-accent transition-colors">
            <textarea ref={inputRef} rows={1} value={input}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
                // Autocomplete
                if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
                if (val.trim().length >= 2) {
                  suggestTimerRef.current = setTimeout(async () => {
                    try {
                      const r = await fetch(`/api/locations?q=${encodeURIComponent(val.trim())}`);
                      if (r.ok) {
                        const { locations } = await r.json() as { locations: { name: string }[] };
                        setSuggestions(locations.map(l => l.name));
                        setShowSuggestions(locations.length > 0);
                      }
                    } catch { /* ignore */ }
                  }, 280);
                } else {
                  setSuggestions([]); setShowSuggestions(false);
                }
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
            className="shrink-0 w-11 h-11 rounded-full bg-accent flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        </div>
      </div>

      {reportingResult && <ReportModal result={reportingResult} onClose={() => setReportingResult(null)} />}

      {/* PWA install banner */}
      {showInstall && installPrompt && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-surface-card border border-accent/30 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-xl">
          <span className="text-2xl shrink-0">🚐</span>
          <div className="flex-1 min-w-0">
            <p className="text-content-primary text-xs font-semibold">Add to Home Screen</p>
            <p className="text-content-muted text-[10px]">Faster access — works like an app</p>
          </div>
          <button
            onClick={() => { installPrompt.prompt(); setShowInstall(false); localStorage.setItem("sf_install_dismissed", "1"); }}
            className="shrink-0 text-xs text-white bg-accent px-3 py-1.5 rounded-full font-semibold active:scale-95"
          >
            Install
          </button>
          <button
            onClick={() => { setShowInstall(false); localStorage.setItem("sf_install_dismissed", "1"); }}
            className="shrink-0 text-content-muted text-xs active:opacity-60"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
