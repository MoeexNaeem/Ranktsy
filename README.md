# 🌱 SeedRank — Etsy Keyword Research & Analytics

A full-stack Next.js 16 application for Etsy sellers — keyword research, search trend analysis, competition tracking, and shop analytics.

---

## Tech Stack

| Layer       | Technology                                           |
|-------------|------------------------------------------------------|
| Framework   | Next.js 16 (App Router, Turbopack)                   |
| Language    | TypeScript (strict, zero errors)                     |
| Styling     | Tailwind CSS v4 (Seed Design System tokens)          |
| Data fetch  | TanStack React Query v5 (stale-while-revalidate)     |
| State       | Zustand v5 (devtools middleware)                     |
| Charts      | Chart.js 4 + react-chartjs-2                         |
| Database    | MongoDB + Mongoose ODM                               |
| Cache       | 3-layer: In-memory → MongoDB TTL → Next.js fetch     |
| Icons       | Lucide React                                         |

---

## Caching Architecture (3 layers)

```
React Query (client, 30min stale)
  → In-Memory LRU (Node process, 6h TTL, ~0ms)
    → MongoDB TTL Index (persistent, 6h auto-expire)
      → Etsy API / demo data generator
```

---

## Performance Patterns Used

- `memo()` — every chart + table row component
- `useMemo()` — chart datasets, sorted rows, stat values
- `useCallback()` — all event handlers (search, sort, tabs)
- `dynamic()` with `ssr:false` — Dashboard lazy-loads Chart.js only when needed
- `forwardRef` — Button component for form integration
- MongoDB TTL indexes — auto-expire keyword cache, no cron needed
- ISR — home page static, revalidated every 24h
- React Query deduplication — parallel requests collapsed automatically
- `placeholderData` — previous results visible while new query fetches

---

## Setup

```bash
# 1. Install
npm install

# 2. Environment
cp .env.local.example .env.local
# Fill in MONGODB_URI and ETSY_API_KEY

# 3. Run
npm run dev          # development
npm run build        # production build
npm run type-check   # TypeScript (zero errors guaranteed)
```

### MongoDB (Atlas)
1. Create free cluster at mongodb.com/atlas
2. Copy connection string → MONGODB_URI in .env.local
3. Collections auto-created: `keywordcaches` (TTL 6h), `keywordhistories`

### Etsy API
1. Apply at developers.etsy.com (free, 1-3 day approval)
2. Set ETSY_API_KEY in .env.local
3. Replace `generateKeywordData()` in `src/lib/etsy.ts` with real API calls

---

## Project Structure

```
src/
├── app/
│   ├── api/keywords/route.ts   ← 3-layer cached keyword API
│   ├── api/trends/route.ts     ← Trend + country data API
│   ├── dashboard/page.tsx      ← Full dashboard page ('use client')
│   ├── layout.tsx              ← Root layout + Providers
│   └── page.tsx                ← Landing page (ISR 24h)
├── components/
│   ├── charts/                 ← TrendChart, CountryChart, MiniTrend (all memo'd)
│   ├── dashboard/              ← Dashboard, KeywordTable, PlatformToggle
│   ├── landing/                ← Navbar, Hero, Sections, KeywordTool
│   └── ui/                     ← Button, Badge, StatCard, Loading
├── hooks/useKeywords.ts        ← React Query hooks
├── lib/
│   ├── db.ts                   ← MongoDB singleton (no hot-reload leaks)
│   ├── models.ts               ← Mongoose models with TTL indexes
│   ├── cache.ts                ← In-memory LRU cache
│   ├── etsy.ts                 ← Data layer (swap for real Etsy API)
│   └── providers.tsx           ← QueryClient config
├── store/app.ts                ← Zustand store
├── types/index.ts              ← All TypeScript interfaces
└── utils/index.ts              ← cn(), formatNumber(), formatPercent()
```

---

## Deploy to Vercel

```bash
npm i -g vercel && vercel --prod
```

Add MONGODB_URI + ETSY_API_KEY in Vercel → Settings → Environment Variables.

---

*Not affiliated with Etsy, Inc.*
