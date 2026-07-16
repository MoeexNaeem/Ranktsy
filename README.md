# 🌱 Rankkw — Etsy Keyword Research & Analytics

A full-stack Next.js application to help Etsy sellers analyze search trends, optimize listings, and track shop performance — powered by the **official Etsy Open API v3**.

> **Note:** The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.

---

## Tech Stack

| Layer       | Technology                                           |
|-------------|------------------------------------------------------|
| Framework   | Next.js (App Router, Turbopack)                      |
| Language    | TypeScript (strict)                                  |
| Styling     | Tailwind CSS v4 (Seed Design System tokens)          |
| Data fetch  | TanStack React Query v5 (stale-while-revalidate)     |
| State       | Zustand v5 (devtools middleware)                     |
| Charts      | Chart.js 4 + react-chartjs-2                         |
| Database    | MongoDB + Mongoose ODM                               |
| Cache       | 3-layer: In-memory → MongoDB TTL → Next.js fetch     |
| Icons       | Lucide React                                         |
| Data source | Official Etsy Open API v3 (https://openapi.etsy.com) |

---

## Etsy API Integration

This app uses **only** the official [Etsy Open API v3](https://developers.etsy.com/documentation/).

Endpoints used:
- `GET /v3/application/listings/active` — keyword search and trending listings
- `GET /v3/application/shops/{shop_id}` — shop profile
- `GET /v3/application/shops/{shop_id}/listings/active` — shop listings

No scraping, no third-party data proxies, no unofficial methods.

---

## Caching Architecture (3 layers)

```
React Query (client, 30min stale)
  → In-Memory LRU (Node process, 6h TTL, ~0ms)
    → MongoDB TTL Index (persistent, 6h auto-expire)
      → Etsy Open API v3
```

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

### Get an Etsy API Key
1. Register at https://www.etsy.com/developers/register
2. Create an application describing how Rankkw uses the API
3. Copy your API key → paste into `ETSY_API_KEY` in `.env.local`

### MongoDB (Atlas)
1. Create free cluster at mongodb.com/atlas
2. Copy connection string → `MONGODB_URI` in `.env.local`
3. Collections auto-created: `keywordcaches` (TTL 6h), `keywordhistories`

---

## Project Structure

```
src/
├── app/
│   ├── api/keywords/route.ts   ← 3-layer cached keyword API
│   ├── api/trends/route.ts     ← Trend + country data API
│   ├── api/etsy/               ← Etsy proxy routes (search, shop, trending)
│   ├── dashboard/page.tsx      ← Full dashboard page
│   ├── layout.tsx              ← Root layout + Providers
│   └── page.tsx                ← Landing page (ISR 24h)
├── components/
│   ├── charts/                 ← TrendChart, CountryChart, MiniTrend
│   ├── dashboard/              ← Dashboard, KeywordTable, PlatformToggle
│   ├── landing/                ← Navbar, Hero, Sections, KeywordTool
│   └── ui/                     ← Button, Badge, StatCard, Loading
├── hooks/useKeywords.ts        ← React Query hooks
├── lib/
│   ├── db.ts                   ← MongoDB singleton
│   ├── models.ts               ← Mongoose models with TTL indexes
│   ├── cache.ts                ← In-memory LRU cache
│   ├── etsy.ts                 ← Official Etsy API client
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

Add `MONGODB_URI` and `ETSY_API_KEY` in Vercel → Settings → Environment Variables.

---

*Rankkw is not affiliated with Etsy, Inc.*
