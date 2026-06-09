"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const AdminMap = dynamic(() => import("./AdminMap"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface CrowdsourcedStop {
  id: string;
  stopName: string;
  latitude: number;
  longitude: number;
  routeHeading: string;
  estimatedFare: number;
  submitterId: string;
  votes: number;
  status: string;
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  verified: number;
  flagged: number;
}

interface AnalyticsData {
  total:      number;
  todayTotal: number;
  weekTotal:  number;
  foundTotal: number;
  hitRate:    number;
  topAll:     { destination: string; count: number }[];
  topMissing: { destination: string; count: number }[];
  byDay:      { day: string; count: number }[];
}

interface ReportEntry {
  id:           string;
  destination:  string;
  routeSummary: string;
  reason:       string;
  createdAt:    string;
}

interface UserEntry {
  submitterId: string;
  count: number;
  verified: number;
  pending: number;
  flagged: number;
  totalVotes: number;
  points: number;
  isSpam: boolean;
  lastSubmission: string | null;
}

type FilterTab = "ALL" | "PENDING" | "VERIFIED" | "FLAGGED";
type AdminTab  = "submissions" | "map" | "users" | "reports" | "addstop" | "analytics";

// ── Constants ─────────────────────────────────────────────────────────────────

const ADMIN_TABS: { key: AdminTab; label: string }[] = [
  { key: "submissions", label: "Stops"     },
  { key: "analytics",   label: "Analytics" },
  { key: "map",         label: "Map"       },
  { key: "users",       label: "Users"     },
  { key: "reports",     label: "Reports"   },
  { key: "addstop",     label: "+ Add"     },
];

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL",      label: "All"      },
  { key: "PENDING",  label: "Pending"  },
  { key: "VERIFIED", label: "Verified" },
  { key: "FLAGGED",  label: "Flagged"  },
];

const USER_RANKS = [
  { min: 0,   label: "Fresh Passenger",  emoji: "🚌" },
  { min: 50,  label: "Regular Commuter", emoji: "🎒" },
  { min: 150, label: "Senior Mate",      emoji: "⭐" },
  { min: 300, label: "Trotro Legend",    emoji: "👑" },
];

const STATUS_BADGE: Record<string, string> = {
  PENDING:  "bg-[#451a03]/60  text-reward border border-[#92400e]/40",
  VERIFIED: "bg-[#052e16]/60  text-status-verified border border-[#166534]/40",
  FLAGGED:  "bg-[#450a0a]/60  text-status-danger border border-[#991b1b]/40",
  PROMOTED: "bg-[#1e3a5f]/60  text-[#60a5fa] border border-[#1d4ed8]/40",
};

const STATUS_BORDER: Record<string, string> = {
  PENDING:  "#f59e0b",
  VERIFIED: "#2d9e5c",
  FLAGGED:  "#f87171",
  PROMOTED: "#60a5fa",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSecret(): string {
  return sessionStorage.getItem("admin_secret") ?? "";
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getUserRank(pts: number) {
  return [...USER_RANKS].reverse().find((r) => pts >= r.min) ?? USER_RANKS[0];
}

function extractCorridors(stops: CrowdsourcedStop[]): string[] {
  const words = new Set<string>();
  for (const s of stops) {
    s.routeHeading
      .replace(/\d+([.,]\d+)?\s*(GHS?|₵)/gi, "")
      .split(/[–\-,|·•\/]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 3 && p !== "Not specified")
      .forEach((w) => words.add(w));
  }
  return [...words].sort();
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ICheck  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IFlag   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
const IPin    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const ITrash  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IUndo   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.27"/></svg>;
const IClose  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IMerge  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6"  cy="6"  r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>;

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface-card border border-stroke rounded-xl px-3 py-3 flex-1 min-w-0">
      <p className={`font-black text-2xl tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-content-muted text-[10px] uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function ConfidenceDots({ votes }: { votes: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < Math.min(votes, 5) ? "bg-accent" : "bg-stroke"}`} />
      ))}
      <span className="text-content-muted text-[10px] ml-0.5 tabular-nums">{votes}</span>
    </div>
  );
}

function StopSkeleton() {
  return (
    <div className="bg-surface-card border border-stroke rounded-2xl p-4 animate-pulse">
      <div className="flex justify-between mb-3"><div className="h-4 bg-stroke rounded w-2/3" /><div className="h-4 bg-stroke rounded w-16" /></div>
      <div className="h-3 bg-stroke rounded w-1/2 mb-2" />
      <div className="h-3 bg-stroke rounded w-3/4 mb-4" />
      <div className="flex gap-2 pt-3 border-t border-stroke">
        <div className="h-6 bg-stroke rounded-full w-16" />
        <div className="h-6 bg-stroke rounded-full w-14" />
        <div className="h-6 bg-stroke rounded-full w-20" />
      </div>
    </div>
  );
}

function StopCard({
  stop, selected, onSelect,
  onStatusChange, onDelete, onViewMap, onPromote,
  updating, confirmingDelete, onConfirmDelete, onCancelDelete,
  promoteResult,
}: {
  stop: CrowdsourcedStop;
  selected: boolean;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onViewMap: (stop: CrowdsourcedStop) => void;
  onPromote: (id: string) => void;
  updating: boolean;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  promoteResult?: { location: string; routes: string[]; routesCreated: number; unmatched: number } | null;
}) {
  return (
    <div
      className={`bg-surface-card border rounded-2xl overflow-hidden transition-all ${selected ? "border-accent/60 shadow-md shadow-[#2d9e5c]/10" : "border-stroke"}`}
      style={{ borderLeftColor: STATUS_BORDER[stop.status] ?? "#2d9e5c", borderLeftWidth: 3 }}
    >
      <div className="p-4 flex flex-col gap-2.5">
        {/* Row 1: checkbox + name + badge */}
        <div className="flex items-start gap-2.5">
          <button
            onClick={() => onSelect(stop.id)}
            className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
              selected ? "bg-accent border-accent" : "border-stroke bg-transparent"
            }`}
          >
            {selected && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
          </button>
          <p className="text-content-primary font-semibold text-sm leading-snug flex-1 min-w-0">{stop.stopName}</p>
          <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_BADGE[stop.status] ?? STATUS_BADGE.PENDING}`}>
            {stop.status}
          </span>
        </div>

        {/* Row 2: confidence + coords + time */}
        <div className="flex items-center gap-2.5 flex-wrap pl-6">
          <div className="flex items-center gap-1.5">
            <span className="text-content-muted text-[10px] uppercase tracking-widest">Confidence</span>
            <ConfidenceDots votes={stop.votes} />
          </div>
          <span className="w-px h-3 bg-stroke" />
          <span className="text-content-muted text-[10px] tabular-nums">{stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}</span>
          <span className="w-px h-3 bg-stroke" />
          <span className="text-content-muted text-[10px]">{timeAgo(stop.createdAt)}</span>
        </div>

        {/* Row 3: routes */}
        {stop.routeHeading && stop.routeHeading !== "Not specified" && (
          <div className="flex items-start gap-2 pl-6">
            <span className="text-xs shrink-0 mt-px">🚐</span>
            <p className="text-content-secondary text-xs leading-relaxed line-clamp-2">{stop.routeHeading}</p>
          </div>
        )}

        {/* Promote result toast */}
        {promoteResult && (
          <div className="pl-6 bg-[#1e3a5f]/20 border border-[#1d4ed8]/30 rounded-xl px-3 py-2.5 flex flex-col gap-1">
            <p className="text-[#60a5fa] text-xs font-semibold">✓ Live on Station Finder</p>
            <p className="text-content-secondary text-[11px]">Location: {promoteResult.location}</p>
            {promoteResult.routes.map((r, i) => (
              <p key={i} className="text-content-muted text-[11px]">Route: {r}</p>
            ))}
            {promoteResult.unmatched > 0 && (
              <p className="text-reward text-[10px]">{promoteResult.unmatched} destination{promoteResult.unmatched > 1 ? "s" : ""} not matched to existing stops — add them manually</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-stroke pl-6">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <p className="text-content-primary text-xs flex-1">Delete this stop?</p>
              <button onClick={onConfirmDelete} className="text-[11px] text-status-danger border border-[#991b1b]/40 bg-[#450a0a]/30 px-3 py-1.5 rounded-full active:scale-95">Yes, delete</button>
              <button onClick={onCancelDelete} className="text-[11px] text-content-secondary border border-stroke px-3 py-1.5 rounded-full active:scale-95">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {stop.status === "VERIFIED" && (
                <button onClick={() => onPromote(stop.id)} disabled={updating}
                  className="flex items-center gap-1 text-[11px] text-[#60a5fa] border border-[#1d4ed8]/40 bg-[#1e3a5f]/40 px-3 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition-all font-medium">
                  🚀 Promote to Live
                </button>
              )}
              {stop.status !== "VERIFIED" && stop.status !== "PROMOTED" && (
                <button onClick={() => onStatusChange(stop.id, "VERIFIED")} disabled={updating}
                  className="flex items-center gap-1 text-[11px] text-status-verified border border-[#166534]/40 bg-[#052e16]/40 px-3 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition-all">
                  <ICheck /> Verify
                </button>
              )}
              {stop.status !== "FLAGGED" && stop.status !== "PROMOTED" && (
                <button onClick={() => onStatusChange(stop.id, "FLAGGED")} disabled={updating}
                  className="flex items-center gap-1 text-[11px] text-status-danger border border-[#991b1b]/40 bg-[#450a0a]/30 px-3 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition-all">
                  <IFlag /> Flag
                </button>
              )}
              {stop.status !== "PENDING" && stop.status !== "PROMOTED" && (
                <button onClick={() => onStatusChange(stop.id, "PENDING")} disabled={updating}
                  className="flex items-center gap-1 text-[11px] text-reward border border-[#92400e]/40 bg-[#451a03]/30 px-3 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition-all">
                  <IUndo /> Reset
                </button>
              )}
              <button onClick={() => onViewMap(stop)}
                className="flex items-center gap-1 text-[11px] text-content-secondary border border-stroke px-3 py-1.5 rounded-full active:scale-95 transition-all">
                <IPin /> Map
              </button>
              <button onClick={() => onDelete(stop.id)} disabled={updating}
                className="flex items-center gap-1 ml-auto text-[11px] text-content-disabled border border-stroke px-3 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition-all">
                <ITrash />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MapModal({ stop, onClose }: { stop: CrowdsourcedStop; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const { latitude: lat, longitude: lng } = stop;
  const d   = 0.004;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full bg-raised rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,.5)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-8 h-1 bg-stroke rounded-full mt-3 mb-1" />
        <div className="flex items-start justify-between px-4 pt-2 pb-3">
          <div>
            <p className="text-content-primary font-semibold text-sm">{stop.stopName}</p>
            <p className="text-content-muted text-[11px] tabular-nums mt-0.5">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-card border border-stroke flex items-center justify-center text-content-secondary active:scale-90"><IClose /></button>
        </div>
        <div className="px-4 pb-3 relative" style={{ height: 230 }}>
          {!loaded && (
            <div className="absolute inset-4 rounded-xl bg-surface-card border border-stroke flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-content-secondary text-xs">Loading map…</span>
            </div>
          )}
          <iframe src={src} onLoad={() => setLoaded(true)} className="w-full h-full rounded-xl border border-stroke" style={{ opacity: loaded ? 1 : 0, transition: "opacity .3s" }} />
        </div>
        {stop.routeHeading && stop.routeHeading !== "Not specified" && (
          <div className="px-4 pb-3">
            <div className="bg-surface-card border border-stroke rounded-xl px-3 py-2.5 flex items-start gap-2">
              <span className="text-sm shrink-0">🚐</span>
              <p className="text-content-secondary text-xs leading-relaxed">{stop.routeHeading}</p>
            </div>
          </div>
        )}
        <div className="px-4 pb-8">
          <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
            className="w-full py-3 rounded-xl border border-stroke bg-surface-card text-content-secondary text-xs text-center block active:opacity-60">
            Open in Google Maps ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  // ── Auth
  const [authed,      setAuthed]      = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [authError,   setAuthError]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // ── Stops data
  const [stops,   setStops]   = useState<CrowdsourcedStop[]>([]);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [filter,  setFilter]  = useState<FilterTab>("ALL");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>("submissions");

  // ── Per-card state
  const [updatingId,      setUpdatingId]      = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [mapStop,         setMapStop]         = useState<CrowdsourcedStop | null>(null);
  const [promoteResults,  setPromoteResults]  = useState<Record<string, { location: string; routes: string[]; routesCreated: number; unmatched: number }>>({});

  // ── Multi-select + merge
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [merging,     setMerging]     = useState(false);
  const [mergeMsg,    setMergeMsg]    = useState<string | null>(null);

  // ── Corridor fare update
  const [corridor,     setCorridor]     = useState("");
  const [newFare,      setNewFare]      = useState("");
  const [fareUpdating, setFareUpdating] = useState(false);
  const [fareMsg,      setFareMsg]      = useState<string | null>(null);
  const [showCorridor, setShowCorridor] = useState(false);

  // ── Search
  const [search, setSearch] = useState("");

  // ── Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // ── Users
  const [users,        setUsers]        = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // ── Reports
  const [reports,        setReports]        = useState<ReportEntry[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // ── Analytics
  const [analytics,        setAnalytics]        = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── Add Stop (admin map-it)
  type AddPhase = "idle" | "locating" | "form" | "submitting" | "success";
  const [addPhase,       setAddPhase]       = useState<AddPhase>("idle");
  const [addCoords,      setAddCoords]      = useState<{ lat: number; lng: number } | null>(null);
  const [addStopName,    setAddStopName]    = useState("");
  const [addRoutes,      setAddRoutes]      = useState("");
  const [addGpsError,    setAddGpsError]    = useState<string | null>(null);
  const [addSubmitError, setAddSubmitError] = useState<string | null>(null);
  const [addedStop,      setAddedStop]      = useState<string | null>(null);

  // ── Derived
  const corridors    = extractCorridors(stops);
  const affectedCount = corridor
    ? stops.filter((s) => s.routeHeading.toLowerCase().includes(corridor.toLowerCase())).length
    : 0;
  const displayed = stops
    .filter((s) => filter === "ALL" || s.status === filter)
    .filter((s) => !search.trim() || s.stopName.toLowerCase().includes(search.toLowerCase()) || s.routeHeading.toLowerCase().includes(search.toLowerCase()));
  const totalPages  = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const pageSlice   = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const spamCount   = users.filter((u) => u.isSpam).length;

  function tabCount(tab: FilterTab): number {
    if (!stats) return 0;
    return tab === "ALL" ? stats.total : tab === "PENDING" ? stats.pending : tab === "VERIFIED" ? stats.verified : stats.flagged;
  }

  // ── Fetch stops (always all — filter client-side)
  const fetchStops = useCallback(async (secret: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stops", { headers: { Authorization: `Bearer ${secret}` } });
      if (res.status === 401) { setAuthed(false); sessionStorage.removeItem("admin_secret"); setAuthError("Session expired."); setLoading(false); return; }
      const data = await res.json() as { stops: CrowdsourcedStop[]; stats: Stats };
      setStops(data.stops);
      setStats(data.stats);
    } catch { setError("Failed to load stops."); }
    setLoading(false);
  }, []);

  // ── Fetch users
  const fetchUsers = useCallback(async (secret: string) => {
    setUsersLoading(true);
    try {
      const res  = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${secret}` } });
      const data = await res.json() as { users: UserEntry[] };
      setUsers(data.users ?? []);
    } catch { /* silent */ }
    setUsersLoading(false);
  }, []);

  // ── Fetch analytics
  const fetchAnalytics = useCallback(async (secret: string) => {
    setAnalyticsLoading(true);
    try {
      const res  = await fetch("/api/admin/analytics", { headers: { Authorization: `Bearer ${secret}` } });
      const data = await res.json() as AnalyticsData;
      setAnalytics(data);
    } catch { /* silent */ }
    setAnalyticsLoading(false);
  }, []);

  // ── Fetch reports
  const fetchReports = useCallback(async (secret: string) => {
    setReportsLoading(true);
    try {
      const res  = await fetch("/api/admin/reports", { headers: { Authorization: `Bearer ${secret}` } });
      const data = await res.json() as { reports: ReportEntry[] };
      setReports(data.reports ?? []);
    } catch { /* silent */ }
    setReportsLoading(false);
  }, []);

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem("admin_secret");
    if (saved) { setSecretInput(saved); setAuthed(true); }
  }, []);

  // Load stops when authed
  useEffect(() => {
    if (authed) fetchStops(getSecret() || secretInput);
  }, [authed, fetchStops, secretInput]);

  // Load users when switching to users tab
  useEffect(() => {
    if (activeTab === "users" && authed && users.length === 0) {
      fetchUsers(getSecret());
    }
  }, [activeTab, authed, users.length, fetchUsers]);

  // Load reports when switching to reports tab
  useEffect(() => {
    if (activeTab === "reports" && authed && reports.length === 0) {
      fetchReports(getSecret());
    }
  }, [activeTab, authed, reports.length, fetchReports]);

  // Load analytics when switching to analytics tab
  useEffect(() => {
    if (activeTab === "analytics" && authed && !analytics) {
      fetchAnalytics(getSecret());
    }
  }, [activeTab, authed, analytics, fetchAnalytics]);

  // Clear selection and reset page on filter/search change
  useEffect(() => { setSelectedIds(new Set()); setMergeMsg(null); setPage(1); }, [filter, search]);

  // ── Auth
  const handleLogin = useCallback(async () => {
    if (!secretInput.trim()) return;
    setAuthLoading(true); setAuthError("");
    const res = await fetch("/api/admin/stops", { headers: { Authorization: `Bearer ${secretInput.trim()}` } });
    if (res.status === 401) { setAuthError("Wrong password. Try again."); }
    else { sessionStorage.setItem("admin_secret", secretInput.trim()); setAuthed(true); }
    setAuthLoading(false);
  }, [secretInput]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("admin_secret");
    setAuthed(false); setSecretInput(""); setStops([]); setStats(null); setUsers([]);
  }, []);

  // ── Multi-select
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setMergeMsg(null);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(displayed.length === selectedIds.size ? new Set() : new Set(displayed.map((s) => s.id)));
  }, [displayed, selectedIds.size]);

  // ── Merge
  const handleMerge = useCallback(async () => {
    if (selectedIds.size < 2) return;
    setMerging(true); setMergeMsg(null);
    const ids = [...selectedIds];
    const res  = await fetch("/api/admin/merge", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSecret()}` },
      body:   JSON.stringify({ ids }),
    });
    const data = await res.json() as { stop?: CrowdsourcedStop; merged?: number; error?: string };
    if (res.ok && data.stop) {
      setStops((prev) => {
        const rest = prev.filter((s) => !ids.includes(s.id));
        return [data.stop!, ...rest].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
      setStats((prev) => prev ? { ...prev, total: prev.total - (data.merged ?? 0) } : prev);
      setSelectedIds(new Set());
      setMergeMsg(`✓ Merged ${ids.length} stops into "${data.stop.stopName}"`);
    } else {
      setMergeMsg(`Error: ${data.error ?? "Merge failed"}`);
    }
    setMerging(false);
  }, [selectedIds]);

  // ── Status change (via /api/admin/verify)
  const handleStatusChange = useCallback(async (id: string, status: string) => {
    const prev = stops.find((s) => s.id === id);
    if (!prev) return;
    setStops((all) => all.map((s) => s.id === id ? { ...s, status } : s));
    setStats((st) => st ? {
      total:    st.total,
      pending:  st.pending  + (status === "PENDING"  ? 1 : 0) - (prev.status === "PENDING"  ? 1 : 0),
      verified: st.verified + (status === "VERIFIED" ? 1 : 0) - (prev.status === "VERIFIED" ? 1 : 0),
      flagged:  st.flagged  + (status === "FLAGGED"  ? 1 : 0) - (prev.status === "FLAGGED"  ? 1 : 0),
    } : st);
    setUpdatingId(id);
    const res = await fetch("/api/admin/verify", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSecret()}` },
      body:   JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      setStops((all) => all.map((s) => s.id === id ? { ...s, status: prev.status } : s));
      setStats((st) => st ? {
        total:    st.total,
        pending:  st.pending  + (prev.status === "PENDING"  ? 1 : 0) - (status === "PENDING"  ? 1 : 0),
        verified: st.verified + (prev.status === "VERIFIED" ? 1 : 0) - (status === "VERIFIED" ? 1 : 0),
        flagged:  st.flagged  + (prev.status === "FLAGGED"  ? 1 : 0) - (status === "FLAGGED"  ? 1 : 0),
      } : st);
    }
    setUpdatingId(null);
  }, [stops]);

  // ── Delete
  const handleDelete = useCallback((id: string) => { setConfirmDeleteId(id); }, []);

  const confirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    const id      = confirmDeleteId;
    const deleted = stops.find((s) => s.id === id);
    setConfirmDeleteId(null); setUpdatingId(id);
    setStops((prev) => prev.filter((s) => s.id !== id));
    setStats((st) => st && deleted ? {
      total:    st.total    - 1,
      pending:  st.pending  - (deleted.status === "PENDING"  ? 1 : 0),
      verified: st.verified - (deleted.status === "VERIFIED" ? 1 : 0),
      flagged:  st.flagged  - (deleted.status === "FLAGGED"  ? 1 : 0),
    } : st);
    await fetch(`/api/admin/stops/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getSecret()}` } });
    setUpdatingId(null);
  }, [confirmDeleteId, stops]);

  // ── Promote to live
  const handlePromote = useCallback(async (id: string) => {
    setUpdatingId(id);
    const res  = await fetch("/api/admin/promote", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSecret()}` },
      body:    JSON.stringify({ id }),
    });
    const data = await res.json() as {
      location?: string; routes?: string[]; routesCreated?: number; unmatched?: number; error?: string;
    };
    if (res.ok && data.location) {
      // Update stop status to PROMOTED optimistically
      setStops((all) => all.map((s) => s.id === id ? { ...s, status: "PROMOTED" } : s));
      setStats((st) => st ? { ...st, verified: Math.max(0, st.verified - 1) } : st);
      setPromoteResults((prev) => ({
        ...prev,
        [id]: {
          location:      data.location!,
          routes:        data.routes ?? [],
          routesCreated: data.routesCreated ?? 0,
          unmatched:     data.unmatched ?? 0,
        },
      }));
    } else {
      alert(data.error ?? "Promote failed. Check console.");
    }
    setUpdatingId(null);
  }, []);

  // ── Delete report
  const handleDeleteReport = useCallback(async (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    await fetch("/api/admin/reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSecret()}` },
      body: JSON.stringify({ id }),
    });
  }, []);

  // ── Fare update
  const handleFareUpdate = useCallback(async () => {
    const fare = parseFloat(newFare);
    if (!corridor || isNaN(fare) || fare < 0) return;
    setFareUpdating(true); setFareMsg(null);
    const res  = await fetch("/api/admin/fare-update", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSecret()}` },
      body:   JSON.stringify({ corridor, fare }),
    });
    const data = await res.json() as { updated?: number; fare?: number; error?: string };
    if (res.ok) {
      setFareMsg(`✓ Updated ${data.updated} stop${data.updated !== 1 ? "s" : ""} to ₵${data.fare?.toFixed(2)}`);
      setStops((prev) => prev.map((s) =>
        s.routeHeading.toLowerCase().includes(corridor.toLowerCase()) ? { ...s, estimatedFare: fare } : s
      ));
    } else { setFareMsg(`Error: ${data.error}`); }
    setFareUpdating(false);
  }, [corridor, newFare]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Auth gate
  // ─────────────────────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center px-6" suppressHydrationWarning>
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-sm shadow-md shadow-accent">🚐</div>
            <div><p className="text-content-primary text-sm font-semibold">Station Finder</p><p className="text-[10px] text-content-muted">● Admin</p></div>
          </div>
          <div className="bg-surface-card border border-stroke rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <p className="text-content-primary font-semibold text-base">Admin access</p>
              <p className="text-content-secondary text-sm mt-0.5">Enter your admin password to continue.</p>
            </div>
            {authError && <p className="text-status-danger text-sm">{authError}</p>}
            <input type="password" value={secretInput} onChange={(e) => setSecretInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Password" autoFocus
              className="w-full bg-raised border border-stroke rounded-xl px-4 py-3 text-sm text-content-primary placeholder-content-placeholder outline-none focus:border-accent transition-colors" />
            <button onClick={handleLogin} disabled={!secretInput.trim() || authLoading}
              className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-accent-sm disabled:opacity-30 active:scale-[0.98] transition-all">
              {authLoading ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Checking…</> : "Enter Admin →"}
            </button>
          </div>
          <div className="mt-4 text-center"><Link href="/" className="text-content-muted text-xs active:opacity-60">← Back to app</Link></div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Dashboard
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-canvas flex flex-col" suppressHydrationWarning>

      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-stroke">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-sm shadow-md shadow-accent">🚐</div>
          <div><p className="text-content-primary text-sm font-semibold">Station Finder</p><p className="text-[10px] text-content-muted">● Admin</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="whitespace-nowrap text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all shrink-0">← App</Link>
          <button onClick={handleLogout} className="whitespace-nowrap text-[10px] text-content-secondary border border-stroke bg-surface-card px-2.5 py-1.5 rounded-full active:scale-95 transition-all shrink-0">Log out</button>
        </div>
      </header>

      {/* Tab bar — scrollable for 6 tabs */}
      <div className="shrink-0 px-5 pb-2 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {ADMIN_TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              activeTab === tab.key
                ? "bg-accent text-white shadow-md shadow-accent-sm"
                : "text-content-secondary border border-stroke bg-surface-card"
            }`}>
            {tab.label}
            {tab.key === "users"   && spamCount       > 0 && (
              <span className="ml-1.5 bg-[#f87171]/20 text-status-danger text-[9px] px-1.5 py-px rounded-full">{spamCount}</span>
            )}
            {tab.key === "reports" && reports.length  > 0 && (
              <span className="ml-1.5 bg-[#f59e0b]/20 text-reward text-[9px] px-1.5 py-px rounded-full">{reports.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom sheet */}
      <div className="flex-1 flex flex-col rounded-t-3xl bg-raised overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,.35)]">
        <div className="mx-auto w-8 h-1 bg-stroke rounded-full mt-2.5 mb-2 shrink-0" />

        {/* ── SUBMISSIONS TAB ── */}
        {activeTab === "submissions" && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Stats */}
            <div className="shrink-0 px-4 pb-2 flex gap-2">
              {stats ? (
                <>
                  <StatCard label="Total"    value={stats.total}    color="text-content-primary" />
                  <StatCard label="Pending"  value={stats.pending}  color="text-reward" />
                  <StatCard label="Verified" value={stats.verified} color="text-status-verified" />
                  <StatCard label="Flagged"  value={stats.flagged}  color="text-status-danger" />
                </>
              ) : (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-surface-card border border-stroke rounded-xl px-3 py-3 flex-1 animate-pulse">
                    <div className="h-6 bg-stroke rounded w-8 mb-1" /><div className="h-2 bg-stroke rounded w-12" />
                  </div>
                ))
              )}
            </div>

            {/* Corridor management (collapsible) */}
            <div className="shrink-0 px-4 pb-2">
              <button onClick={() => { setShowCorridor((v) => !v); setFareMsg(null); }}
                className="w-full flex items-center justify-between bg-surface-card border border-stroke rounded-xl px-4 py-2.5 active:opacity-70 transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🚦</span>
                  <span className="text-content-primary text-xs font-medium">Corridor Fare Manager</span>
                </div>
                <span className={`text-content-muted text-xs transition-transform ${showCorridor ? "rotate-180" : ""}`}>▼</span>
              </button>

              {showCorridor && (
                <div className="bg-surface-card border border-stroke border-t-0 rounded-b-xl px-4 pb-4 pt-3 flex flex-col gap-3">
                  <p className="text-content-secondary text-xs">Update fares for all stops on a corridor at once.</p>
                  <div className="flex gap-2">
                    <select value={corridor} onChange={(e) => { setCorridor(e.target.value); setFareMsg(null); }}
                      className="flex-1 bg-raised border border-stroke rounded-xl px-3 py-2.5 text-sm text-content-primary outline-none focus:border-accent transition-colors appearance-none">
                      <option value="">Select corridor…</option>
                      {corridors.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" min="0" step="0.5" value={newFare} onChange={(e) => { setNewFare(e.target.value); setFareMsg(null); }}
                      placeholder="₵ fare" className="w-24 bg-raised border border-stroke rounded-xl px-3 py-2.5 text-sm text-content-primary placeholder-content-placeholder outline-none focus:border-accent transition-colors" />
                  </div>
                  {corridor && (
                    <p className="text-content-muted text-xs">
                      {affectedCount} stop{affectedCount !== 1 ? "s" : ""} will be updated
                    </p>
                  )}
                  {fareMsg && (
                    <p className={`text-xs ${fareMsg.startsWith("✓") ? "text-status-verified" : "text-status-danger"}`}>{fareMsg}</p>
                  )}
                  <button onClick={handleFareUpdate} disabled={!corridor || !newFare || fareUpdating || affectedCount === 0}
                    className="w-full py-2.5 rounded-xl bg-accent text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-accent-sm disabled:opacity-30 active:scale-[0.98] transition-all">
                    {fareUpdating ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Updating…</> : `Apply to ${affectedCount} stop${affectedCount !== 1 ? "s" : ""} →`}
                  </button>
                </div>
              )}
            </div>

            {/* Merge banner */}
            {selectedIds.size >= 2 && (
              <div className="shrink-0 px-4 pb-2">
                <div className="bg-surface-elevated border border-accent/30 rounded-xl px-4 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-content-primary text-xs font-medium">{selectedIds.size} stops selected</p>
                    {mergeMsg && <p className={`text-[10px] mt-0.5 ${mergeMsg.startsWith("✓") ? "text-status-verified" : "text-status-danger"}`}>{mergeMsg}</p>}
                  </div>
                  <button onClick={() => { setSelectedIds(new Set()); setMergeMsg(null); }}
                    className="text-[11px] text-content-secondary border border-stroke px-2.5 py-1.5 rounded-full active:scale-95">Clear</button>
                  <button onClick={handleMerge} disabled={merging}
                    className="flex items-center gap-1.5 text-[11px] text-white bg-accent px-3 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition-all shadow-md shadow-accent-sm">
                    {merging ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <IMerge />}
                    Merge into One
                  </button>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="shrink-0 px-4 pb-2">
              <div className="bg-surface-card border border-stroke rounded-xl px-3 py-2 flex items-center gap-2 focus-within:border-accent transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-content-muted shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stops by name or route…"
                  className="flex-1 bg-transparent text-xs text-content-primary placeholder-content-placeholder outline-none" />
                {search && (
                  <button onClick={() => setSearch("")} className="text-content-muted text-[10px] shrink-0 active:opacity-60">✕</button>
                )}
              </div>
            </div>

            {/* Filter tabs + select-all */}
            <div className="shrink-0 px-4 pb-2 flex items-center gap-2">
              <div className="flex gap-1.5 flex-1 overflow-x-auto">
                {FILTER_TABS.map((tab) => (
                  <button key={tab.key} onClick={() => setFilter(tab.key)}
                    className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                      filter === tab.key ? "bg-accent text-white shadow-md shadow-accent-sm" : "text-content-secondary border border-stroke bg-surface-card"
                    }`}>
                    {tab.label}
                    {stats && <span className={`text-[10px] tabular-nums ${filter === tab.key ? "text-white/60" : "text-content-muted"}`}>{tabCount(tab.key)}</span>}
                  </button>
                ))}
              </div>
              {displayed.length > 0 && (
                <button onClick={selectAll} className="shrink-0 text-[10px] text-content-secondary border border-stroke px-2.5 py-1.5 rounded-full active:scale-95 transition-all whitespace-nowrap">
                  {selectedIds.size === displayed.length ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>

            {/* Stop list */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
              {loading && Array.from({ length: 3 }).map((_, i) => <StopSkeleton key={i} />)}
              {error && !loading && (
                <div className="bg-surface-card border border-stroke rounded-2xl px-4 py-3">
                  <p className="text-status-danger text-sm">{error}</p>
                  <button onClick={() => fetchStops(getSecret())} className="text-content-secondary text-xs mt-2">Retry</button>
                </div>
              )}
              {!loading && !error && displayed.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <p className="text-2xl">📍</p>
                  <p className="text-content-primary font-medium text-sm">No stops here yet</p>
                  <p className="text-content-muted text-xs max-w-[240px] leading-relaxed">
                    {filter === "ALL" ? "Commuter submissions will appear here once people start using Map It." : `No ${filter.toLowerCase()} stops right now.`}
                  </p>
                  {filter === "ALL" && (
                    <Link href="/map-it" className="mt-2 text-accent text-xs border border-stroke px-4 py-2 rounded-full active:opacity-60">Go to Map It →</Link>
                  )}
                </div>
              )}
              {!loading && pageSlice.map((stop) => (
                <StopCard key={stop.id} stop={stop}
                  selected={selectedIds.has(stop.id)} onSelect={toggleSelect}
                  onStatusChange={handleStatusChange} onDelete={handleDelete}
                  onViewMap={setMapStop} onPromote={handlePromote}
                  updating={updatingId === stop.id}
                  confirmingDelete={confirmDeleteId === stop.id}
                  onConfirmDelete={confirmDelete} onCancelDelete={() => setConfirmDeleteId(null)}
                  promoteResult={promoteResults[stop.id] ?? null} />
              ))}
              {!loading && displayed.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-1 py-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="text-xs text-content-secondary border border-stroke px-3 py-1.5 rounded-full disabled:opacity-30 active:scale-95 transition-all">
                    ← Prev
                  </button>
                  <span className="text-xs text-content-muted tabular-nums">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, displayed.length)} of {displayed.length}
                  </span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="text-xs text-content-secondary border border-stroke px-3 py-1.5 rounded-full disabled:opacity-30 active:scale-95 transition-all">
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MAP TAB ── */}
        {activeTab === "map" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Legend */}
            <div className="shrink-0 px-4 pb-3 flex items-center gap-4">
              {[
                { color: "#f59e0b", label: "Pending",  count: stats?.pending  ?? 0 },
                { color: "#2d9e5c", label: "Verified", count: stats?.verified ?? 0 },
                { color: "#f87171", label: "Flagged",  count: stats?.flagged  ?? 0 },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-white/20 shadow-sm" style={{ background: l.color }} />
                  <span className="text-content-secondary text-xs">{l.label}</span>
                  <span className="text-content-muted text-[10px] tabular-nums">({l.count})</span>
                </div>
              ))}
              <span className="ml-auto text-content-muted text-[10px]">{stops.length} total</span>
            </div>

            {/* Map */}
            <div className="flex-1 px-4 pb-4">
              {loading ? (
                <div className="w-full h-full rounded-2xl bg-surface-card border border-stroke flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-content-secondary text-sm">Loading map…</span>
                </div>
              ) : (
                <div className="w-full h-full rounded-2xl overflow-hidden border border-stroke">
                  <AdminMap stops={stops} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {activeTab === "users" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Summary */}
            <div className="shrink-0 px-4 pb-3 flex gap-2">
              <div className="bg-surface-card border border-stroke rounded-xl px-3 py-3 flex-1">
                <p className="text-content-primary font-black text-2xl tabular-nums leading-none">{users.length}</p>
                <p className="text-content-muted text-[10px] uppercase tracking-widest mt-1">Contributors</p>
              </div>
              <div className="bg-surface-card border border-stroke rounded-xl px-3 py-3 flex-1">
                <p className="text-status-verified font-black text-2xl tabular-nums leading-none">{users.filter((u) => !u.isSpam).length}</p>
                <p className="text-content-muted text-[10px] uppercase tracking-widest mt-1">Legit Users</p>
              </div>
              <div className="bg-surface-card border border-stroke rounded-xl px-3 py-3 flex-1">
                <p className="text-status-danger font-black text-2xl tabular-nums leading-none">{spamCount}</p>
                <p className="text-content-muted text-[10px] uppercase tracking-widest mt-1">Spam Flagged</p>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
              {usersLoading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-surface-card border border-stroke rounded-2xl p-4 animate-pulse">
                  <div className="flex gap-3 items-center mb-3">
                    <div className="w-8 h-8 bg-stroke rounded-full" />
                    <div className="flex-1"><div className="h-4 bg-stroke rounded w-1/3 mb-1" /><div className="h-3 bg-stroke rounded w-1/4" /></div>
                    <div className="h-6 bg-stroke rounded-full w-16" />
                  </div>
                  <div className="flex gap-2"><div className="h-5 bg-stroke rounded-full w-14" /><div className="h-5 bg-stroke rounded-full w-14" /><div className="h-5 bg-stroke rounded-full w-14" /></div>
                </div>
              ))}

              {!usersLoading && users.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <p className="text-2xl">🏆</p>
                  <p className="text-content-primary font-medium text-sm">No contributors yet</p>
                  <p className="text-content-muted text-xs">The leaderboard will fill up once commuters start mapping stops.</p>
                </div>
              )}

              {!usersLoading && users.map((user, i) => {
                const rank = getUserRank(user.points);
                return (
                  <div key={user.submitterId}
                    className={`bg-surface-card rounded-2xl overflow-hidden ${user.isSpam ? "border border-[#991b1b]/50" : "border border-stroke"}`}
                    style={user.isSpam ? undefined : { borderLeftColor: i < 3 ? "var(--reward)" : "var(--stroke-default)", borderLeftWidth: i < 3 ? 3 : 1 }}
                  >
                    <div className="p-4 flex flex-col gap-2.5">
                      {/* Row 1: rank + name + points */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                          i === 0 ? "bg-[#f59e0b]/20 text-reward" :
                          i === 1 ? "bg-[#94a3b8]/15 text-[#94a3b8]" :
                          i === 2 ? "bg-[#b45309]/15 text-[#b45309]" :
                          "bg-stroke text-content-muted"
                        }`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-content-primary text-xs font-mono">{user.submitterId.slice(-10)}</p>
                            {user.isSpam && (
                              <span className="bg-[#450a0a]/60 text-status-danger border border-[#991b1b]/40 text-[9px] font-bold px-2 py-px rounded-full uppercase tracking-wide">⚠ Spam</span>
                            )}
                          </div>
                          <p className="text-content-secondary text-[11px] mt-0.5">{rank.emoji} {rank.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-reward font-black text-lg tabular-nums leading-none">{user.points}</p>
                          <p className="text-content-muted text-[9px] uppercase tracking-widest">pts</p>
                        </div>
                      </div>

                      {/* Row 2: breakdown badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-content-primary border border-stroke bg-raised px-2.5 py-1 rounded-full tabular-nums">
                          {user.count} stop{user.count !== 1 ? "s" : ""}
                        </span>
                        {user.verified > 0 && (
                          <span className="text-[11px] text-status-verified border border-[#166534]/40 bg-[#052e16]/40 px-2.5 py-1 rounded-full tabular-nums">
                            {user.verified} verified
                          </span>
                        )}
                        {user.pending > 0 && (
                          <span className="text-[11px] text-reward border border-[#92400e]/40 bg-[#451a03]/30 px-2.5 py-1 rounded-full tabular-nums">
                            {user.pending} pending
                          </span>
                        )}
                        {user.flagged > 0 && (
                          <span className="text-[11px] text-status-danger border border-[#991b1b]/40 bg-[#450a0a]/30 px-2.5 py-1 rounded-full tabular-nums">
                            {user.flagged} flagged
                          </span>
                        )}
                        {user.lastSubmission && (
                          <span className="ml-auto text-content-muted text-[10px]">{timeAgo(user.lastSubmission)}</span>
                        )}
                      </div>

                      {/* Spam warning detail */}
                      {user.isSpam && (
                        <div className="bg-[#450a0a]/30 border border-[#991b1b]/30 rounded-xl px-3 py-2">
                          <p className="text-status-danger text-xs leading-relaxed">
                            Cluster of 5+ stops within 50 m detected — possible coordinate spam. Review their submissions in the Submissions tab.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {activeTab === "analytics" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 pb-2 flex items-center justify-between">
              <p className="text-content-secondary text-xs">Live search data</p>
              <button onClick={() => fetchAnalytics(getSecret())}
                className="text-[10px] text-content-secondary border border-stroke px-2.5 py-1.5 rounded-full active:scale-95">
                Refresh
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
              {analyticsLoading && (
                <div className="flex items-center justify-center py-16 gap-2">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-content-secondary text-sm">Loading…</span>
                </div>
              )}

              {analytics && !analyticsLoading && (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Total Searches",  value: analytics.total,      color: "text-content-primary" },
                      { label: "Today",            value: analytics.todayTotal, color: "text-accent" },
                      { label: "This Week",        value: analytics.weekTotal,  color: "text-accent" },
                      { label: "Hit Rate",         value: `${analytics.hitRate}%`, color: analytics.hitRate >= 50 ? "text-status-verified" : "text-status-danger" },
                    ].map((s) => (
                      <div key={s.label} className="bg-surface-card border border-stroke rounded-xl px-3 py-3">
                        <p className={`font-black text-2xl tabular-nums leading-none ${s.color}`}>{s.value}</p>
                        <p className="text-content-muted text-[10px] uppercase tracking-widest mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Daily chart — simple bar chart */}
                  {analytics.byDay.length > 0 && (
                    <div className="bg-surface-card border border-stroke rounded-2xl p-4">
                      <p className="text-content-secondary text-xs font-medium mb-3">Last 7 Days</p>
                      <div className="flex items-end gap-1.5 h-16">
                        {(() => {
                          const max = Math.max(...analytics.byDay.map((d) => d.count), 1);
                          return analytics.byDay.map((d) => (
                            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full rounded-t-sm bg-accent/70 transition-all"
                                   style={{ height: `${Math.max(4, (d.count / max) * 52)}px` }} />
                              <p className="text-[8px] text-content-disabled">{d.day}</p>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Missing routes — the gold */}
                  <div className="bg-surface-card border border-stroke rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">🚫</span>
                      <p className="text-content-primary text-sm font-semibold">Missing Routes</p>
                      <span className="ml-auto text-[10px] text-content-muted">Add these first</span>
                    </div>
                    {analytics.topMissing.length === 0 ? (
                      <p className="text-content-muted text-xs">No failed searches yet — great!</p>
                    ) : analytics.topMissing.map((r, i) => (
                      <div key={r.destination} className="flex items-center gap-3 py-2 border-b border-stroke last:border-0">
                        <span className="text-content-muted text-xs tabular-nums w-4">{i + 1}</span>
                        <p className="text-content-primary text-sm flex-1 capitalize">{r.destination}</p>
                        <button
                          onClick={() => {
                            const slug = r.destination.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                            const snippet = `  // Add to ALIASES in app/api/directions/route.ts:\n  "${r.destination.toLowerCase()}": "CANONICAL NAME HERE",\n\n  // Or add to seed.ts:\n  { id: "loc-${slug}", name: "${r.destination.charAt(0).toUpperCase() + r.destination.slice(1)}", latitude: 0, longitude: 0, description: "TODO" },`;
                            navigator.clipboard?.writeText(snippet).catch(() => {});
                            alert(`Copied seed snippet for "${r.destination}" — paste into seed.ts or the alias table.`);
                          }}
                          className="text-[10px] text-content-disabled border border-stroke px-2 py-1 rounded-full active:scale-95 hover:text-content-secondary hover:border-accent/40 transition-colors whitespace-nowrap"
                          title="Copy seed snippet to clipboard"
                        >
                          Copy snippet
                        </button>
                        <span className="text-status-danger text-xs tabular-nums font-semibold">{r.count}×</span>
                      </div>
                    ))}
                  </div>

                  {/* Top searched destinations */}
                  <div className="bg-surface-card border border-stroke rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">🔍</span>
                      <p className="text-content-primary text-sm font-semibold">Top Destinations</p>
                    </div>
                    {analytics.topAll.length === 0 ? (
                      <p className="text-content-muted text-xs">No searches yet.</p>
                    ) : analytics.topAll.map((r, i) => (
                      <div key={r.destination} className="flex items-center gap-3 py-2 border-b border-stroke last:border-0">
                        <span className="text-content-muted text-xs tabular-nums w-4">{i + 1}</span>
                        <p className="text-content-primary text-sm flex-1 capitalize">{r.destination}</p>
                        <span className="text-accent text-xs tabular-nums font-semibold">{r.count}×</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!analytics && !analyticsLoading && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <p className="text-2xl">📊</p>
                  <p className="text-content-primary font-medium text-sm">No data yet</p>
                  <p className="text-content-muted text-xs max-w-[240px] leading-relaxed">
                    Analytics will appear once users start searching for routes.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === "reports" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 pb-2 flex items-center justify-between">
              <p className="text-content-secondary text-xs">{reports.length} report{reports.length !== 1 ? "s" : ""} from users</p>
              {reports.length > 0 && (
                <button onClick={() => fetchReports(getSecret())}
                  className="text-[10px] text-content-secondary border border-stroke px-2.5 py-1.5 rounded-full active:scale-95">
                  Refresh
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
              {reportsLoading && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-surface-card border border-stroke rounded-2xl p-4 animate-pulse">
                  <div className="h-4 bg-stroke rounded w-1/2 mb-2" />
                  <div className="h-3 bg-stroke rounded w-3/4 mb-2" />
                  <div className="h-3 bg-stroke rounded w-1/3" />
                </div>
              ))}

              {!reportsLoading && reports.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <p className="text-2xl">✅</p>
                  <p className="text-content-primary font-medium text-sm">No reports yet</p>
                  <p className="text-content-muted text-xs max-w-[240px] leading-relaxed">
                    Users can flag wrong route info from the chat. Reports will appear here.
                  </p>
                </div>
              )}

              {!reportsLoading && reports.map((r) => (
                <div key={r.id} className="bg-surface-card border border-stroke rounded-2xl p-4 flex flex-col gap-2"
                     style={{ borderLeftColor: "#f59e0b", borderLeftWidth: 3 }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-content-primary font-semibold text-sm leading-snug">{r.reason}</p>
                      <p className="text-content-muted text-[10px] mt-0.5">{r.destination}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-content-disabled text-[10px]">{timeAgo(r.createdAt)}</span>
                      <button onClick={() => handleDeleteReport(r.id)}
                        className="text-content-disabled hover:text-status-danger active:scale-90 transition-all">
                        <ITrash />
                      </button>
                    </div>
                  </div>
                  {r.routeSummary && (
                    <p className="text-content-secondary text-xs leading-relaxed bg-raised rounded-xl px-3 py-2">
                      {r.routeSummary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ── ADD STOP TAB ── */}
        {activeTab === "addstop" && (
          <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4 pt-2">

            {(addPhase === "idle" || addPhase === "locating") && (
              <>
                <div>
                  <p className="text-content-primary font-semibold text-base">Add a verified stop</p>
                  <p className="text-content-secondary text-sm mt-0.5">Stand at the stop and tap below — it will be instantly verified.</p>
                </div>
                {addGpsError && (
                  <div className="bg-surface-card border border-stroke rounded-xl px-4 py-3">
                    <p className="text-status-danger text-sm">{addGpsError}</p>
                  </div>
                )}
                <div className="flex-1 flex flex-col items-center justify-center gap-5 py-4">
                  <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
                    {addPhase === "locating" ? (
                      <>
                        <div className="absolute inset-0 rounded-full border border-accent/30 animate-ping" />
                        <button disabled className="relative w-36 h-36 rounded-full bg-surface-card border-2 border-accent/40 flex flex-col items-center justify-center gap-3">
                          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          <p className="text-accent text-xs font-medium text-center px-4 leading-snug">Getting GPS…</p>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setAddGpsError(null); setAddPhase("locating");
                          navigator.geolocation?.getCurrentPosition(
                            (p) => { setAddCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setAddPhase("form"); },
                            () => { setAddGpsError("Couldn't get GPS. Check browser permissions."); setAddPhase("idle"); },
                            { timeout: 15000, enableHighAccuracy: true }
                          );
                        }}
                        className="relative w-36 h-36 rounded-full bg-accent flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-accent">
                        <span className="text-3xl">📍</span>
                        <p className="text-white text-xs font-semibold text-center px-5 leading-snug">I&apos;m at a stop!</p>
                      </button>
                    )}
                  </div>
                  <p className="text-content-disabled text-xs text-center">Stops you add are verified instantly — no votes needed.</p>
                </div>
              </>
            )}

            {(addPhase === "form" || addPhase === "submitting") && addCoords && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5 bg-surface-card border border-stroke rounded-xl px-4 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <p className="text-accent text-xs font-medium">GPS locked</p>
                  <p className="text-content-muted text-xs ml-auto tabular-nums">{addCoords.lat.toFixed(5)}, {addCoords.lng.toFixed(5)}</p>
                </div>
                {addSubmitError && <p className="text-status-danger text-sm">{addSubmitError}</p>}
                <div className="bg-surface-card border border-stroke rounded-2xl overflow-hidden">
                  <div className="flex items-start gap-3 px-4 py-3.5 border-b border-stroke-subtle">
                    <span className="text-base shrink-0 mt-0.5">📍</span>
                    <div className="flex-1 min-w-0">
                      <input type="text" value={addStopName} onChange={(e) => setAddStopName(e.target.value)}
                        placeholder="Stop name (as locals know it)" autoFocus
                        className="w-full bg-transparent text-sm text-content-primary placeholder-content-placeholder outline-none" />
                      <p className="text-content-disabled text-[11px] mt-1.5">e.g. Oyarifa Junction, Borga Town</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <span className="text-base shrink-0 mt-0.5">🚐</span>
                    <div className="flex-1 min-w-0">
                      <input type="text" value={addRoutes} onChange={(e) => setAddRoutes(e.target.value)}
                        placeholder="Routes & fares (optional)"
                        className="w-full bg-transparent text-sm text-content-primary placeholder-content-placeholder outline-none" />
                      <p className="text-content-disabled text-[11px] mt-1.5">e.g. Madina – 1.50 GHS, Circle – 3 GHS</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!addStopName.trim() || !addCoords) return;
                    setAddPhase("submitting"); setAddSubmitError(null);
                    try {
                      const res = await fetch("/api/admin/add-stop", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSecret()}` },
                        body: JSON.stringify({ latitude: addCoords.lat, longitude: addCoords.lng, stopName: addStopName, routes: addRoutes }),
                      });
                      const data = await res.json() as { stop?: { stopName: string }; error?: string };
                      if (!res.ok || !data.stop) { setAddSubmitError(data.error ?? "Failed to add stop."); setAddPhase("form"); return; }
                      setAddedStop(data.stop.stopName);
                      setAddPhase("success");
                      fetchStops(getSecret()); // refresh submissions list
                    } catch { setAddSubmitError("Network error."); setAddPhase("form"); }
                  }}
                  disabled={!addStopName.trim() || addPhase === "submitting"}
                  className="w-full py-4 rounded-2xl bg-accent flex items-center justify-center gap-2 text-white font-semibold text-sm shadow-lg shadow-accent-sm disabled:opacity-30 active:scale-[0.98] transition-all">
                  {addPhase === "submitting"
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
                    : "Add as Verified Stop ✓"}
                </button>
                <button onClick={() => { setAddPhase("idle"); setAddCoords(null); setAddStopName(""); setAddRoutes(""); setAddSubmitError(null); }}
                  className="text-center text-content-muted text-sm py-1 active:opacity-60">
                  Start over
                </button>
              </div>
            )}

            {addPhase === "success" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-stroke flex items-center justify-center text-3xl">✅</div>
                <div>
                  <p className="text-content-primary font-bold text-base">Stop added!</p>
                  <p className="text-content-secondary text-sm mt-1">&ldquo;{addedStop}&rdquo; is now verified and on the map.</p>
                </div>
                <button
                  onClick={() => { setAddPhase("idle"); setAddCoords(null); setAddStopName(""); setAddRoutes(""); setAddedStop(null); }}
                  className="text-xs text-accent border border-stroke px-5 py-2.5 rounded-full active:scale-95">
                  Add another stop
                </button>
                <button onClick={() => setActiveTab("submissions")} className="text-xs text-content-muted active:opacity-60">
                  View all stops →
                </button>
              </div>
            )}
          </div>
        )}
      </div>  {/* end bottom sheet */}

      {/* Map modal (Submissions tab) */}
      {mapStop && <MapModal stop={mapStop} onClose={() => setMapStop(null)} />}
    </div>
  );
}
