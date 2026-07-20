# Rankkw — Session Handoff

_Last updated: 2026-07-16. Read this first, then the memory files it points to._

Rankkw is an **Etsy SEO & analytics tool** (Next.js 16, App Router, React 19, MongoDB/Mongoose, TanStack Query, Zustand). It competes with eRank / EtsyHunt. The dashboard has **29 tabs**.

---

## The one rule that governs everything: NO FABRICATED DATA

This is the product's whole identity and its path to Etsy Commercial API access. **Every number shown must be real, measured from an official API — or absent.** A failed lookup renders `—`, never a plausible stand-in. If Etsy doesn't publish something, we don't show it (and say why on `/methodology`).

This rule has been enforced destructively over many sessions — most of the work has been **finding and removing plausible-but-fake numbers**. Before adding any metric, ask: _"what does this show when the data is missing or zero?"_ If the answer is a believable number, it's a bug. Test with an absurd input (a nonsense keyword) to flush these out.

See memory: `no-fabricated-data-rule.md`.

---

## What Etsy's API does / doesn't give you (critical — memorize)

**DOES expose (all used):** active listings (title/tags/price/views/num_favorers/created_timestamp/taxonomy_id), shop record incl. **`transaction_sold_count` (real lifetime sales)**, reviews, sections, taxonomy, and — under the shop-owner's OAuth — their receipts (with `country_iso`, `is_paid`, `is_shipped`).

**Does NOT expose (never fake these):**
- **Search volume** — none at all. Real volume only via Google Ads.
- **Clicks / CTR** — none. "favorites ÷ views" is a real ratio we show instead, labelled as such.
- **Per-listing sales** — sales are shop-lifetime only, so Sales/Revenue Estimators are impossible.
- **Search history / seasonality** — Etsy returns _state, not history_.
- **Processing times** — the fields exist but return null on every public result.

Gotchas that each silently corrupted a metric: **mixed currencies with no FX rate** (scope prices to the dominant currency), **HTML-encoded titles** (`decodeEntities`), **~10 req/sec rate limit** (shared `rateGate`, 8/sec). See `etsy-api-data-quirks.md`.

---

## Architecture landmarks (don't relearn these the hard way)

- **`src/lib/etsy.ts`** — all Etsy API calls funnel through one rate-gated `etsyFetch` with 429 retry. Reusable helpers: `searchEtsyListingsPaged`, `getListingById`, `getEtsyShop`, `dominantCurrencyPrices`, `listingsByMonth`, `getTopSellers` (ranks by REAL sales).
- **Keyword pipeline is split on purpose** — `/api/keywords` (core, ~1–2s paint) + `/related` + `/near-matches` + `/listings`, requested in parallel. Do **not** merge them back; the split took cold search 12.7s → 3.8s. See `keyword-pipeline-staging.md`.
- **Snapshots = our only history.** Etsy has none, so `lib/snapshots.ts` records shop+listing state daily (opportunistically on every read, plus a cron). 400-day TTL, enforced by a real Mongo index. Powers sales velocity, Competitor Sales, and (future) Changes. Can't be backfilled — every un-captured day is lost. See `snapshot-history-architecture.md`.
- **Mongo keyword cache keys on the keyword, NOT the version** — `isStale()` in the route is the only thing retiring old doc shapes. Add a probe there for every new field or stale docs serve forever. See `keyword-tool-cache-versioning.md`.
- **Data colors:** brand palette `C` (orange/charcoal/parchment, "no green" rule for _chrome only_). Data viz uses a separate `D` palette with real green/amber/red. Both in `src/utils/index.ts`.
- **Responsive:** the media queries live in `globals.css` behind hook classes (`.rgrid-4`, `.rsplit`, `.rdash-aside`, etc.). **Never hand-roll `<head>` in `layout.tsx`** — it kills the viewport meta and makes the entire responsive layer dead code (this actually happened). See `viewport-meta-head-trap.md`.

---

## AI: Google Gemini (wired up 2026-07-16)

- Provider: **`src/lib/gemini.ts`**. Model **`gemini-flash-latest`** (an alias — a pinned version like `gemini-2.5-flash` 404s for new keys). `isGeminiConfigured()` gates every call; failures return `null` so callers fall back cleanly.
- **`thinkingConfig.thinkingBudget: 0`** for copy tasks — Flash 2.5 burns thinking tokens that truncate structured JSON. Pass `think: true` only for reasoning tasks.
- Key env var: **`Gemini_API_KEY`** (non-standard casing; `GEMINI_API_KEY` also accepted). Currently a **free-tier key** → low RPM, expect 429s under load (handled by fallback).
- Wired into **AI Listing Helper** (`/api/ai/listing`): Gemini writes titles/tags/description **grounded in the real tags of live Etsy listings**. This stays compliant — Gemini _writes copy_, it never invents analytics.
- The old code targeted Anthropic (no key); `@anthropic-ai/sdk` is still in package.json but unused.

---

## Built this session (all real-data, all verified live)

1. **Keyword Gap Analysis** — new tab (`gap`) + `/api/keywords/gap`. Real tag/title-word adoption across the top-100 listings; paste your listing URL to flag missing high-value tags ("Hidden Keywords"). Features #34 + #39.
2. **Shop Health Score** — `ShopHealthPanel.tsx` on Shop Analytics. 0–100, weighted blend of real shop-record factors, each showing its source number. Labelled "estimate." Feature #23.
3. **Duplicate Tag Checker** — added to Listing Audit (`tagHygieneChecks`): duplicate tags + over-20-char tags. Feature #19.
4. **Long-tail filter** — "Long-tail only" toggle in the keyword table (3+ word phrases). Feature #7.
5. **Gemini integration** (above).

Also fixed: Google Ads was pinned to sunset API **v18** (404s) → now **v20** default with an actionable error.

---

## ▶ NEXT BATCH TO BUILD (the user has approved this)

**Build the Gemini group next — specifically this pair, which the user explicitly asked for:**

> **AI Improvement Suggestions + One-Click Optimization.** These stack directly on the Listing Audit and Keyword Gap already built: **the audit finds the gaps → Gemini writes the fixes.** i.e. feed the real audit findings + the real missing tags from Keyword Gap into Gemini, and have it produce a prioritised, ready-to-paste set of improvements (rewritten title, the exact tags to add, a tightened description). One-Click Optimization is the same flow with an "apply everything" output.

This is the highest-value next step because the hard part (the real analysis) already exists — Gemini just turns it into actions. Keep it compliant: Gemini rewrites _copy_ from _real findings_; it must not invent any numbers.

Other buildable-but-deferred features (need OAuth / snapshot history / infra, so they'd show empty states today): Bulk Listing Audit, Keyword Cannibalization (both need shop OAuth), Competitor Change Tracker (needs days of snapshot history — backend `getListingChanges` already exists), PDF SEO Report, Trend Alerts, Chrome Extension. See the feature-map artifact for the full 50-item breakdown (23 live · 11 Gemini-ready · 9 buildable · 7 blocked-by-fake-data).

---

## Open items the USER must do (external — can't be done in code)

1. **Etsy app registration** still points at the dead `ranktsy.com` — update the app name + website URL to `https://rankkw.com`, and register the OAuth callback `https://rankkw.com/api/etsy/oauth/callback`. Until then Connect-Shop breaks and the Commercial API reviewer lands on a parked page. (The app was **declined once already** — needs an active external site + a clear API-use description; a draft answer is in the Etsy reapplication artifact.)
2. **Google Ads** — needs 5 credentials + Basic-access approval (1–3 days) to light up real search volume/seasonality. Step-by-step guide was produced as an artifact.
3. **Production env** — set `NEXT_PUBLIC_APP_URL=https://rankkw.com` (used in reset/verification emails), `CRON_SECRET` (guards the snapshot cron — fails closed without it), and confirm the host runs the cron (DNS suggested a non-Vercel host; if so the `vercel.json` cron won't fire).

---

## Working state

- Everything below `src/` **typechecks clean, builds clean, zero new lint errors** (18 pre-existing lint errors in untouched files — don't chase them).
- Nothing is committed yet — all session work is in the working tree (`git status` shows it).
- Dev server: `npm run dev` (port 3000). The preview browser tab runs `document.hidden=true`, which **pauses CSS animations/transitions** — screenshots and the mobile drawer look "stuck" but work in a real browser. Verify via computed-style JS checks, not screenshots.
- Etsy API key is real and in `.env.local`, so you can test against live data.
