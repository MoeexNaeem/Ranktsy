# Rankkw — Project Summary

_Last updated: 2026-08-02_

**Rankkw** (Rankkw.com) is an Etsy SEO & analytics platform that helps Etsy sellers
research keywords, analyze competitors, optimize listings, and grow their shops —
competing with eRank / EtsyHunt. Every figure is **real**, measured from the
official Etsy Open API, Google Ads Keyword Planner, or the seller's own connected
shop. It runs alongside a restyled sibling app, **Ranktsy** (Ranktsy.co, :3001),
with which it shares one keyword database.

---

## The one rule that governs everything: NO FABRICATED DATA

This is the product's whole identity and its path to Etsy Commercial API access.
**Every number shown must be real, from an official API — or absent.** A failed
lookup renders `—`, never a plausible stand-in. If Etsy doesn't publish something,
we don't show it (and say why on `/methodology`). Before adding any metric, ask:
_"what does this show when the data is missing or zero?"_ — if it's a believable
number, that's a bug. Test with a nonsense keyword to flush these out.

---

## Tech Stack

| Area | Choice |
|---|---|
| Framework | **Next.js 16.2.6** (App Router, Turbopack), **React 19** |
| Language | TypeScript (strict) |
| Database | **MongoDB** via Mongoose |
| Auth | JWT (`jose`/`jsonwebtoken`) + bcrypt, email OTP (`nodemailer`) |
| Data sources | **Etsy Open API v3**, **Google Ads API** (Keyword Planner, v24), **Gemini** AI |
| Charts / motion | Chart.js + react-chartjs-2, GSAP, react-intersection-observer |
| Fetching / state | React Query (`@tanstack/react-query`), Zustand |
| Styling | Inline styles + token palette (`src/utils`: `C` chrome, `D` data-viz) + `globals.css`; parchment + orange (#FB5E09) brand |

Dev: `npm run dev` (**:3000**).

---

## Features (dashboard — 33 tools)

**Home** — Overview, My Shop
**Research** — Find Hot Products, Keywords, Listings, Competitors, Trends, Trend
Buzz, Monthly Trends, Top Sellers, Category Report, Competitor Sales, Keyword Gap,
Bulk Keywords, Rank Checker
**Optimize** — Shop Analytics, Tag Optimizer, **Title Generator / Tag Generator /
Description Gen** (AI), Etsy Listing Pro, AI Listing Helper, Listing Audit,
Competitor Tags, Compare Listings, Spell Checker
**Tools** — Fee Calculator, Ads ROI, Category Finder, Seasonal Calendar, Keyword Lists

Public site: hero, animated **Features** section, live keyword tool, dashboard
preview, **Pricing** (5 plans), About/Contact, legal pages.

---

## What the Etsy API does / doesn't give (memorize)

**DOES expose:** active listings (title/tags/price/views/num_favorers/created/
taxonomy), shop record incl. **`transaction_sold_count`** (real lifetime sales),
reviews, sections, taxonomy, and — under shop-owner OAuth — their receipts.

**Does NOT expose (never fake):** search volume (Google only), clicks/CTR (we show
real favs÷views instead), **per-listing sales** (shop-lifetime only → no Sales/
Revenue estimators), search history/seasonality (Etsy returns state, not history),
processing times (fields exist, always null publicly).

Gotchas each silently corrupted a metric: mixed currencies with no FX rate (scope
to the dominant currency), HTML-encoded titles (`decodeEntities`), ~10 req/sec rate
limit (shared `rateGate`, 8/sec).

---

## Key Systems

### Keyword pipeline (`src/lib/keywords.ts`, `src/lib/etsy.ts`)
A cold keyword needs ~33 Etsy calls, so the work is **split into independently
cached stages** requested in parallel — core (~1–2s paint), related (real
competition probed per keyword), near-matches, listings-with-images, reviews,
trends. All Etsy calls funnel through one rate-gated `etsyFetch` (8/sec, 429
retry). Don't merge the stages back — the split took cold search 12.7s → 3.8s.

### Google Ads Keyword Planner (`src/lib/google-ads.ts`)
Real monthly search volume, advertiser competition + 0–100 index, CPC, and
per-country breakdown. **Country filter** (`KEYWORD_GEOS`: US/GB/AU/CA/FR/DE/IN +
Global). "Searchers by Country" is scoped to the filter (specific country → 100%
that country; Global → full breakdown). CPC comes in the Ads **account currency**
(PKR here) with a real → USD toggle (`/api/fx`, cached 12h, null-on-fail). Only
Google data is geo-specific; Etsy metrics are one global marketplace. Metrics
memoized per keyword. API pinned to **v24** (older versions 400/404).

### Shared permanent keyword store — `collectivekeyworddatas` ⭐
The most important cross-app system. Ranktsy's **Bulk Keyword Search** saves each
keyword's **complete package** (stats + enriched related + top listings w/ images +
per-listing reviews + near-matches + trends) **permanently** in the shared
`collectivekeyworddatas` collection (both apps use the same Mongo cluster / `test`
db). A weekly **Saturday cron** (`/api/cron/refresh-collective`) refreshes each one.

**Rankkw's Keyword Search reads this store first** (`src/lib/collective-read.ts`):
a present keyword is served entirely from the DB — every column, listings, images,
reviews, near-matches, trends — with **zero Etsy/Google API calls**. Misses hit the
live APIs and fall back to Rankkw's own 5-hour `keywordcaches`.

### AI generators (Gemini) — Title / Tag / Description
Three "Optimize" tabs (`/api/ai/{title,tag,description}`; prompts in
`src/lib/ai/etsy-prompts.ts`). Synthesized expert Etsy-SEO prompts, **grounded with
real data** (real Google volume/competition + tags the top-50 live listings use) so
KD/volume claims are real, not invented. Structured JSON via `geminiJSON`; results
cached and persisted across tab navigation (React Query). Gemini calls retry on
transient 429/5xx. Also: **Etsy Listing Pro** (full listing + 4 Gemini images), AI
Listing Helper, AI insights, one-click listing optimization. Gemini writes copy /
draws images — it never invents analytics. Key: `Gemini_API_KEY` (billing enabled).

### Snapshots & history (`src/lib/snapshots.ts`)
Etsy returns state, never a series, so daily shop/listing **snapshots** are the only
source of sales-over-time (captured opportunistically on reads + a daily cron).
~400-day TTL via a real Mongo index. Cannot be backfilled.

### Per-user API-usage analytics (admin)
`src/lib/usage.ts` (AsyncLocalStorage via `withUsage`) attributes every Etsy/Google
call to the current user; coalesced `$inc` writes to **`userapiusages`** (one row
per {day, userId}). Admin dashboard (`/admin`) shows today's totals + per-user
breakdown (Etsy/Google calls, searches, cache-hits vs API-hits) + 7-day history.
Daily reset (UTC), ~60-day retention.

---

## Auth & Integrations
- Email/password (bcrypt) + JWT sessions + email OTP verify/reset.
- **Etsy shop connect**: OAuth 2.0 + PKCE (`/api/etsy/oauth/*`).
- **Google Ads**: OAuth refresh token for Keyword Planner (customer `6146631942`, no MCC, OAuth app in Production).
- Admins: emails in `ADMIN_EMAILS` or `role: 'admin'`.

## Pricing (display-only — PayFast checkout pending)
Five plans on the landing page: **Free** Rs 0 · **Starter** Rs 2,999 · **Pro**
Rs 5,999 (Most Popular) · **Business** Rs 11,999 · **Agency** Rs 22,999, plus a
Rs 299 / 3-day trial. Prices in **PKR**. CTAs → `/register?plan=<slug>`.

---

## Architecture landmarks (don't relearn the hard way)
- `src/lib/etsy.ts` — all Etsy calls via one rate-gated `etsyFetch`; helpers:
  `searchEtsyListingsPaged`, `getEtsyShop`, `attachImages`, `getNearMatches`,
  `getListingReviewCount`, `enrichRelatedCompetition`, `dominantCurrencyPrices`.
- Mongo keyword cache keys on the **keyword, not the version** — `isStaleCore()` is
  the only thing retiring old doc shapes; add a probe there for every new field.
- Colours: `C` (chrome — "no green" rule for chrome only) + `D` (data-viz — real
  green/amber/red), both in `src/utils/index.ts`.
- Responsive lives in `globals.css` behind hook classes (`.rgrid-*`, `.rsplit`,
  `.rdash-aside`…). **Never hand-roll `<head>` in `layout.tsx`** — it kills the
  viewport meta and the whole responsive layer.

## Environment variables
`MONGODB_URI`, `ETSY_API_KEY` + `ETSY_SHARED_SECRET`, `Gemini_API_KEY`
(+ optional `GEMINI_MODEL` / `GEMINI_IMAGE_MODEL`), `GOOGLE_ADS_*`
(client id/secret, developer token, customer id, refresh token),
`JWT_SECRET` / `JWT_REFRESH_SECRET`, SMTP (`SMTP_*`, `EMAIL_FROM`),
`ADMIN_EMAILS`, `CRON_SECRET` (guards `/api/cron/*`, fails closed),
`NEXT_PUBLIC_APP_URL`, optional Upstash + reCAPTCHA keys.

## Cron / scheduled
- `/api/cron/snapshot` — daily shop/listing snapshots (Bearer `CRON_SECRET`).
- (Ranktsy) `/api/cron/refresh-collective` — weekly Saturday refresh of the shared store.

---

## Recent changes (this cycle)
- Removed all "Beta" framing; added the 5-plan **Pricing** section (PKR), API
  features dropped from Business/Agency at the user's request.
- Rankkw Keyword Search now reads shared `collectivekeyworddatas` first → **fully
  zero-API for saved keywords** (core, related, listings, images, reviews,
  near-matches, trends).
- Added **per-user API-usage analytics** to the admin dashboard (`userapiusages`).
- Replaced the single "Tag & Title Gen" with **three AI tabs** (Title / Tag /
  Description), grounded in real data, results persisted across navigation; Gemini
  retry-hardened.
- "Searchers by Country" now respects the country filter (+ India added).
- Redesigned the landing **Features** section (per-card accent colours, icon chips,
  hover + entrance animation).

## Open items the USER must do (external — not code)
1. **Etsy app registration** — confirm the app name + website point at
   `https://rankkw.com` and the OAuth callback `https://rankkw.com/api/etsy/oauth/callback`
   is registered (the Commercial API app was declined once — needs an active
   external site + clear API-use description).
2. **Production env** — set `NEXT_PUBLIC_APP_URL=https://rankkw.com`, `CRON_SECRET`,
   and confirm the host actually runs the crons.
3. **Shared DB note** — both apps point `MONGODB_URI` at the same (slow) Mongo
   cluster; if cold-search speed matters, a faster cluster is the only real fix.
4. **PayFast** — wire the pricing CTAs to real checkout once credentials exist.

---

## Repo map (high level)
```
src/
  app/            App Router pages + /api routes (auth, etsy, keywords, ai, admin, cron…)
  components/
    landing/      Public site (Navbar, Hero, Sections, KeywordTool, pricing…)
    dashboard/    DashboardLayout + tabs/ (one per tool) + kit.tsx (UI primitives)
    admin/        AdminDashboard
  lib/            etsy.ts, keywords.ts, google-ads.ts, gemini.ts, trends.ts,
                  collective-read.ts, usage.ts, track.ts, snapshots.ts, models.ts,
                  db.ts, auth/, ai/
  types/          shared TypeScript types
  utils/          C + D colour palettes + formatters
```

_For deeper per-feature history, see the `memory/` files this repo's tooling maintains._
