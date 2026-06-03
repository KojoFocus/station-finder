# 🚐 Station Finder

A conversational transit hub for trotro commuters in Accra, Ghana.
Built with Next.js 15, Tailwind CSS, Prisma, PostgreSQL, and Gemini Flash.

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up your environment
Copy `.env.local` and fill in your values:
```bash
# Get a free PostgreSQL URL from https://neon.tech or https://supabase.com
DATABASE_URL="postgresql://..."

# Get your Gemini key from https://aistudio.google.com/app/apikey
GEMINI_API_KEY="..."
```

### 3. Push the schema and seed the database
```bash
npm run db:generate   # generates the Prisma client
npm run db:push       # creates tables in your database
npm run db:seed       # loads the Aburi–Madina corridor data
```

### 4. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone (or browser).

---

## Project Structure

```
station-finder/
├── app/
│   ├── api/chat/route.ts   ← Chat API endpoint (Gemini wired here)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            ← Main chat UI
├── lib/
│   └── prisma.ts           ← Prisma singleton
├── prisma/
│   ├── schema.prisma       ← DB models: Location, Route, PartnerDriver
│   └── seed.ts             ← Aburi → Oyarifa → Teiman → Madina data
├── public/
│   └── manifest.json       ← PWA manifest
├── .env.local              ← Your secrets (never commit this)
└── ...config files
```

---

## Phase Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| 1 — Local Chat MVP | 🔨 Building | Chat UI + Gemini + DB for Aburi–Madina corridor |
| 2 — Map & GPS | 🔜 Next | Mapbox pins + live location tracking |
| 3 — Intercity | 🔜 Later | Partner driver portal + highway pickups |

---

## Recommended Free Services

- **Database**: [Neon](https://neon.tech) — free PostgreSQL, no credit card
- **Deployment**: [Vercel](https://vercel.com) — free tier, perfect for Next.js
- **AI**: [Google AI Studio](https://aistudio.google.com) — free Gemini Flash quota
