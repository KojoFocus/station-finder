"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Rank ladder ───────────────────────────────────────────────────────────────

const RANKS = [
  { min: 0,   label: "Fresh Passenger",  emoji: "🚌" },
  { min: 50,  label: "Regular Commuter", emoji: "🎒" },
  { min: 150, label: "Senior Mate",      emoji: "⭐" },
  { min: 300, label: "Trotro Legend",    emoji: "👑" },
] as const;

type RankEntry = (typeof RANKS)[number];

function getCurrentRank(pts: number): RankEntry {
  return [...RANKS].reverse().find((r) => pts >= r.min) ?? RANKS[0];
}
function getNextRank(pts: number): RankEntry | null {
  return RANKS.find((r) => r.min > pts) ?? null;
}

// Stable anonymous device ID — generated once, persisted in localStorage
function getOrCreateSubmitterId(): string {
  const KEY = "mapit_submitter_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase        = "idle" | "locating" | "form" | "submitting" | "success";
type SuccessAction = "created" | "voted" | "verified";
type MapItTab      = "mapit" | "mystops";

interface Submission {
  id:           string;
  stopName:     string;
  routeHeading: string;
  status:       string;
  votes:        number;
  createdAt:    string;
}

const SUCCESS_COPY: Record<SuccessAction, { headline: string; body: string }> = {
  created:  { headline: "+10 Points!",         body: "You are officially putting Accra on the map! 🚀" },
  voted:    { headline: "+10 Points!",         body: "Chale! You just confirmed this stop exists! 🙌" },
  verified: { headline: "Stop Verified! +10!", body: "You helped make this stop official! The community thanks you 🏆" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SUB_BORDER: Record<string, string> = {
  PENDING:  "#f59e0b",
  VERIFIED: "#4a7c59",
  FLAGGED:  "#f87171",
  PROMOTED: "#60a5fa",
};
const SUB_BADGE: Record<string, string> = {
  PENDING:  "bg-[#451a03]/60 text-[#f59e0b] border border-[#92400e]/40",
  VERIFIED: "bg-[#052e16]/60 text-[#4ade80] border border-[#166534]/40",
  FLAGGED:  "bg-[#450a0a]/60 text-[#f87171] border border-[#991b1b]/40",
  PROMOTED: "bg-[#1e3a5f]/60 text-[#60a5fa] border border-[#1d4ed8]/40",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapItPage() {
  const [phase,         setPhase]         = useState<Phase>("idle");
  const [coords,        setCoords]        = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError,      setGpsError]      = useState<string | null>(null);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [stopName,      setStopName]      = useState("");
  const [routes,        setRoutes]        = useState("");
  const [points,        setPoints]        = useState(0);
  const [successAction, setSuccessAction] = useState<SuccessAction>("created");
  const [formVisible,         setFormVisible]         = useState(false);
  const [submitterId,         setSubmitterId]         = useState("");
  const [activeTab,           setActiveTab]           = useState<MapItTab>("mapit");
  const [submissions,         setSubmissions]         = useState<Submission[]>([]);
  const [submissionsLoading,  setSubmissionsLoading]  = useState(false);
  const [submissionsLoaded,   setSubmissionsLoaded]   = useState(false);

  useEffect(() => {
    const pts = parseInt(localStorage.getItem("mapit_points") ?? "0", 10);
    setPoints(isNaN(pts) ? 0 : pts);
    setSubmitterId(getOrCreateSubmitterId());
  }, []);

  useEffect(() => {
    if (phase === "form") {
      requestAnimationFrame(() => setFormVisible(true));
    } else {
      setFormVisible(false);
    }
  }, [phase]);

  // Sync points and load submissions from server
  useEffect(() => {
    if (!submitterId) return;
    setSubmissionsLoading(true);
    fetch(`/api/map-it?submitterId=${encodeURIComponent(submitterId)}`)
      .then((r) => r.json())
      .then((data: { stops?: Submission[]; points?: number }) => {
        if (data.stops) {
          setSubmissions(data.stops);
          const serverPts = data.points ?? 0;
          const localPts  = parseInt(localStorage.getItem("mapit_points") ?? "0", 10);
          const finalPts  = Math.max(serverPts, isNaN(localPts) ? 0 : localPts);
          setPoints(finalPts);
          localStorage.setItem("mapit_points", String(finalPts));
        }
        setSubmissionsLoaded(true);
      })
      .catch(() => setSubmissionsLoaded(true))
      .finally(() => setSubmissionsLoading(false));
  }, [submitterId]);

  const grabGPS = useCallback(() => {
    setGpsError(null);
    setPhase("locating");
    if (!navigator.geolocation) {
      setGpsError("Chale, your browser doesn't support GPS!");
      setPhase("idle");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPhase("form");
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? "Chale, we need your GPS to locate the station!"
            : "GPS is playing hide and seek. Try again?"
        );
        setPhase("idle");
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  }, []);

  const submit = useCallback(async () => {
    if (!stopName.trim() || !coords || !submitterId) return;
    setPhase("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/map-it", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude:    coords.lat,
          longitude:   coords.lng,
          stopName,
          routes,
          submitterId,
        }),
      });

      const data = await res.json() as {
        action?: SuccessAction | "duplicate";
        message?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        setSubmitError(data.error ?? "Something went wrong. Try again.");
        setPhase("form");
        return;
      }

      if (data.action === "duplicate") {
        // Already submitted this exact spot — no points, friendly nudge
        setSubmitError(data.message ?? "You already submitted this stop!");
        setPhase("form");
        return;
      }

      // Real submission — award points
      const action = (data.action as SuccessAction) ?? "created";
      const newPoints = points + 10;
      setPoints(newPoints);
      localStorage.setItem("mapit_points", String(newPoints));
      setSuccessAction(action);
      setPhase("success");
    } catch {
      setSubmitError("Network error. Check your connection and try again.");
      setPhase("form");
    }
  }, [stopName, routes, coords, submitterId, points]);

  const reset = useCallback(() => {
    setPhase("idle");
    setCoords(null);
    setStopName("");
    setRoutes("");
    setGpsError(null);
    setSubmitError(null);
  }, []);

  const rank   = getCurrentRank(points);
  const next   = getNextRank(points);
  const toNext = next ? next.min - points : 0;
  const copy   = SUCCESS_COPY[successAction];

  return (
    <div className="flex flex-col h-dvh bg-canvas" suppressHydrationWarning>

      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-sm shadow-md shadow-accent">
            📍
          </div>
          <div>
            <p className="text-content-primary text-sm font-semibold">Station Finder</p>
            <p className="text-[10px] text-content-muted">● Map It</p>
          </div>
        </div>
        <Link
          href="/"
          className="whitespace-nowrap flex items-center gap-1 text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all shrink-0"
        >
          ← Back
        </Link>
      </header>

      {/* ── Rank strip — amber for reward numbers only ── */}
      <div className="shrink-0 px-4 pt-1 pb-2">
        <div className="bg-surface-card border border-stroke rounded-xl px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{rank.emoji}</span>
            <div>
              <p className="text-[#f59e0b] text-xs font-semibold">{rank.label}</p>
              {next ? (
                <p className="text-content-muted text-[10px]">
                  {toNext} pts to become a {next.label}
                </p>
              ) : (
                <p className="text-content-muted text-[10px]">Maximum rank achieved</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[#f59e0b] font-black text-2xl tabular-nums leading-none">{points}</p>
            <p className="text-content-muted text-[9px] uppercase tracking-widest">pts</p>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="shrink-0 px-4 pb-1 flex gap-1.5">
        {(["mapit", "mystops"] as MapItTab[]).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              activeTab === t
                ? "bg-accent text-white shadow-md shadow-accent-sm"
                : "text-content-secondary border border-stroke bg-surface-card"
            }`}>
            {t === "mapit" ? "📍 Map It" : `My Stops${submissions.length > 0 ? ` (${submissions.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── Bottom sheet ── */}
      <div className="flex-1 flex flex-col rounded-t-3xl bg-raised mt-1 overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,.35)]">
        <div className="mx-auto w-8 h-1 bg-stroke rounded-full mt-2.5 mb-1 shrink-0" />

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

          {/* ── Idle / Locating ── */}
          {activeTab === "mapit" && (phase === "idle" || phase === "locating") && (
            <>
              <div>
                <p className="text-content-primary font-semibold text-base">
                  Standing at a trotro stop?
                </p>
                <p className="text-content-secondary text-sm mt-0.5">
                  Log it in 10 seconds and earn points.
                </p>
              </div>

              {gpsError && (
                <div className="bg-surface-card border border-stroke rounded-2xl px-4 py-3">
                  <p className="text-content-primary/70 text-sm">{gpsError}</p>
                </div>
              )}

              <div className="flex-1 flex flex-col items-center justify-center gap-5 py-4">
                <div
                  className="relative flex items-center justify-center"
                  style={{ width: 200, height: 200 }}
                >
                  {phase === "locating" ? (
                    <>
                      <div className="absolute inset-0 rounded-full border border-accent/30 animate-ping" />
                      <div
                        className="absolute inset-6 rounded-full border border-accent/20 animate-ping"
                        style={{ animationDelay: "250ms" }}
                      />
                      <button
                        disabled
                        className="relative w-40 h-40 rounded-full bg-surface-card border-2 border-accent/40 flex flex-col items-center justify-center gap-3"
                      >
                        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <p className="text-accent text-xs font-medium text-center px-5 leading-snug">
                          Chasing down<br />your GPS…
                        </p>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 rounded-full border border-[#f59e0b]/15 animate-pulse" />
                      <div
                        className="absolute inset-4 rounded-full border border-[#f59e0b]/10 animate-pulse"
                        style={{ animationDelay: "500ms" }}
                      />
                      <button
                        onClick={grabGPS}
                        className="relative w-40 h-40 rounded-full bg-accent flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-accent"
                        style={{ boxShadow: "0 4px 24px rgba(74,124,89,0.35), 0 0 0 1px rgba(245,158,11,0.12)" }}
                      >
                        <span className="text-4xl">📍</span>
                        <p className="text-white text-xs font-semibold text-center px-6 leading-snug">
                          I&apos;m standing at a stop!
                        </p>
                      </button>
                    </>
                  )}
                </div>
                <p className="text-content-disabled text-xs text-center">
                  +10 points per stop ·{" "}
                  {points > 0 ? `${points} pts earned so far` : "free to play"}
                </p>
              </div>
            </>
          )}

          {/* ── Form ── */}
          {activeTab === "mapit" && (phase === "form" || phase === "submitting") && coords && (
            <div
              className={`flex flex-col gap-4 transition-all duration-300 ${
                formVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <div className="flex items-center gap-2.5 bg-surface-card border border-stroke rounded-xl px-4 py-2.5">
                <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                <p className="text-accent text-xs font-medium">GPS locked</p>
                <p className="text-content-muted text-xs ml-auto tabular-nums">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
              </div>

              {submitError && (
                <div className="bg-surface-card border border-stroke rounded-2xl px-4 py-3">
                  <p className="text-content-primary/70 text-sm">{submitError}</p>
                </div>
              )}

              <div className="bg-surface-card border border-stroke rounded-2xl overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3.5 border-b border-stroke-subtle">
                  <span className="text-base shrink-0 mt-0.5">📍</span>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={stopName}
                      onChange={(e) => setStopName(e.target.value)}
                      placeholder="What do locals call this place?"
                      autoFocus
                      className="w-full bg-transparent text-sm text-content-primary placeholder-content-placeholder outline-none"
                    />
                    <p className="text-content-disabled text-[11px] mt-1.5">
                      e.g. Oyarifa Junction, Borga Town
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <span className="text-base shrink-0 mt-0.5">🚐</span>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={routes}
                      onChange={(e) => setRoutes(e.target.value)}
                      placeholder="Where are cars heading & how much?"
                      className="w-full bg-transparent text-sm text-content-primary placeholder-content-placeholder outline-none"
                    />
                    <p className="text-content-disabled text-[11px] mt-1.5">
                      e.g. Madina – 1.50 GHS, Circle – 3 GHS
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={submit}
                disabled={!stopName.trim() || phase === "submitting"}
                className="w-full py-4 rounded-2xl bg-accent flex items-center justify-center gap-2 text-white font-semibold text-sm shadow-lg shadow-accent-sm disabled:opacity-30 active:scale-[0.98] transition-all"
              >
                {phase === "submitting" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Dropping the pin…
                  </>
                ) : (
                  "Drop the Pin! 📍"
                )}
              </button>

              <button
                onClick={reset}
                className="w-full text-center text-content-muted text-sm py-2 active:opacity-60"
              >
                Start over
              </button>
            </div>
          )}

          {/* ── Success ── */}
          {activeTab === "mapit" && phase === "success" && (
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-surface-card border border-stroke rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {successAction === "verified" ? "🏆" : "🎉"}
                  </span>
                  <div>
                    <p className="text-white/60 text-[10px] uppercase tracking-widest">Boom!</p>
                    <p className="text-[#fde68a] font-black text-2xl leading-tight">
                      {copy.headline}
                    </p>
                  </div>
                  <p className="ml-auto text-[#fde68a] font-black text-3xl tabular-nums leading-none">
                    {points}
                  </p>
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{copy.body}</p>
              </div>

              <div className="bg-surface-card border border-stroke rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-content-muted text-[10px] uppercase tracking-widest">Your rank</p>
                  <p className="text-[#f59e0b] font-semibold text-sm mt-0.5">
                    {rank.emoji} {rank.label}
                  </p>
                  {next ? (
                    <p className="text-content-muted text-xs mt-0.5">
                      {toNext} pts to {next.label}
                    </p>
                  ) : (
                    <p className="text-accent text-xs mt-0.5">Maximum rank achieved 🏆</p>
                  )}
                </div>
                <p className="text-[#f59e0b] font-black text-3xl tabular-nums">{points}</p>
              </div>

              <button
                onClick={reset}
                className="w-full py-4 rounded-2xl bg-accent flex items-center justify-center gap-2 text-white font-semibold text-sm shadow-lg shadow-accent-sm active:scale-[0.98] transition-all"
              >
                Add Another Stop 📍
              </button>
              <Link
                href="/"
                className="w-full py-3 rounded-2xl border border-stroke bg-surface-card text-content-secondary text-xs text-center block active:opacity-60"
              >
                Back to Station Finder
              </Link>
            </div>
          )}

          {/* ── My Stops tab ── */}
          {activeTab === "mystops" && (
            <div className="flex flex-col gap-3">
              {submissionsLoading && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface-card border border-stroke rounded-2xl p-4 animate-pulse">
                  <div className="h-4 bg-stroke rounded w-2/3 mb-2" />
                  <div className="h-3 bg-stroke rounded w-1/2 mb-2" />
                  <div className="h-3 bg-stroke rounded w-1/4" />
                </div>
              ))}
              {submissionsLoaded && submissions.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <p className="text-2xl">📍</p>
                  <p className="text-content-primary font-medium text-sm">No stops yet</p>
                  <p className="text-content-muted text-xs max-w-[240px] leading-relaxed">
                    Tap &ldquo;Map It&rdquo; and drop your first pin to see your submissions here.
                  </p>
                  <button onClick={() => setActiveTab("mapit")}
                    className="text-xs text-accent border border-stroke px-4 py-2 rounded-full active:scale-95">
                    Drop a Pin →
                  </button>
                </div>
              )}
              {submissions.map((s) => (
                <div key={s.id}
                  className="bg-surface-card border border-stroke rounded-2xl p-4 flex flex-col gap-2"
                  style={{ borderLeftColor: SUB_BORDER[s.status] ?? "#4a7c59", borderLeftWidth: 3 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-content-primary font-semibold text-sm leading-snug flex-1">{s.stopName}</p>
                    <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${SUB_BADGE[s.status] ?? ""}`}>
                      {s.status}
                    </span>
                  </div>
                  {s.routeHeading && s.routeHeading !== "Not specified" && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs shrink-0">🚐</span>
                      <p className="text-content-muted text-xs leading-relaxed line-clamp-2">{s.routeHeading}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-content-disabled text-[10px]">{s.votes} vote{s.votes !== 1 ? "s" : ""}</span>
                    <span className="w-px h-2.5 bg-stroke" />
                    <span className="text-content-disabled text-[10px]">{timeAgo(s.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
