import type { Config } from "tailwindcss";

// ─────────────────────────────────────────────────────────────────────────────
//  STATION FINDER — TAILWIND SEMANTIC TOKEN MAP
//
//  Every value here is a CSS variable reference.
//  Raw hex values live in app/globals.css only.
//  Change a color once in globals.css → every Tailwind class updates.
//
//  USAGE CHEATSHEET
//  ────────────────
//  Surfaces:    bg-canvas · bg-raised · bg-surface-card · bg-surface-elevated
//  Borders:     border-stroke · border-stroke-subtle · border-stroke-emphasis
//  Text:        text-content-primary · text-content-secondary · text-content-muted
//  Placeholder: placeholder-content-placeholder
//  Accent:      bg-accent · text-accent · border-accent
//               bg-accent-pressed  (tap/active)
//               bg-accent-subtle   (ghost fill)
//  Shadows:     shadow-accent · shadow-accent-sm
//  Reward:      text-reward · bg-reward-subtle
//  Status:      text-status-verified · text-status-pending · text-status-danger
// ─────────────────────────────────────────────────────────────────────────────

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {

      // ── COLORS ─────────────────────────────────────────────────────────────

      colors: {

        // 60% — Neutral canvas
        // bg-canvas · bg-raised
        canvas: "var(--bg-canvas)",
        raised: "var(--bg-raised)",

        // bg-surface-card · bg-surface-elevated · bg-surface-interactive
        surface: {
          card:        "var(--surface-card)",
          elevated:    "var(--surface-elevated)",
          interactive: "var(--surface-interactive)",
        },

        // border-stroke · border-stroke-subtle · border-stroke-emphasis
        stroke: {
          DEFAULT:  "var(--stroke-default)",
          subtle:   "var(--stroke-subtle)",
          emphasis: "var(--stroke-emphasis)",
        },

        // 30% — Typography
        // text-content-primary · text-content-secondary · text-content-muted
        // text-content-disabled · placeholder-content-placeholder
        content: {
          primary:     "var(--text-primary)",
          secondary:   "var(--text-secondary)",
          muted:       "var(--text-muted)",
          disabled:    "var(--text-disabled)",
          placeholder: "var(--text-placeholder)",
        },

        // 10% — Brand accent
        // bg-accent · text-accent · border-accent
        // bg-accent-pressed · bg-accent-subtle
        accent: {
          DEFAULT: "var(--accent-interactive)",
          pressed: "var(--accent-pressed)",
          subtle:  "var(--accent-subtle)",
        },

        // Gamification (amber — separate visual signal from brand green)
        // text-reward · bg-reward-subtle
        reward: {
          DEFAULT: "var(--reward)",
          subtle:  "var(--reward-subtle)",
        },

        // Semantic status (admin badges)
        // text-status-verified · text-status-pending · text-status-danger
        // bg-status-verified · bg-status-pending · bg-status-danger
        status: {
          verified: "var(--status-verified)",
          pending:  "var(--status-pending)",
          danger:   "var(--status-danger)",

          "verified-bg": "var(--status-verified-bg)",
          "pending-bg":  "var(--status-pending-bg)",
          "danger-bg":   "var(--status-danger-bg)",
        },
      },

      // ── BOX SHADOWS ────────────────────────────────────────────────────────
      // shadow-accent · shadow-accent-sm · shadow-card

      boxShadow: {
        "accent":    "0 4px 24px var(--accent-glow)",
        "accent-sm": "0 2px 8px  var(--accent-glow)",
        "card":      "0 4px 16px rgba(0, 0, 0, 0.40)",
        "sheet":     "0 -4px 20px rgba(0, 0, 0, 0.35)",
      },

      // ── LAYOUT ─────────────────────────────────────────────────────────────

      height:    { dvh: "100dvh" },
      minHeight: { dvh: "100dvh" },
    },
  },
  plugins: [],
};

export default config;
