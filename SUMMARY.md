# Rankkw — Project Summary

_Last updated: 2026-08-21_

**Rankkw** (Rankkw.com) is an Etsy SEO & analytics platform — keyword research,
competitor analysis, listing optimization, AI generators — competing with eRank /
EtsyHunt. Every figure is **real**, measured from the official Etsy Open API, Google
Ads Keyword Planner, or the seller's own connected shop. Shares one keyword database
with a sibling app, **Ranktsy** (Ranktsy.co, :3001).

---

## The one rule that governs everything: NO FABRICATED DATA
Every number shown must be real, from an official API — or absent (`—`). A failed
lookup renders `—`, never a plausible stand-in. Test new metrics with a nonsense
keyword. **The one deliberate exception** is the new "Average Etsy Searches" (see
below), which is an explicitly-labelled *estimate* — because Etsy publishes no
search data to anyone, so a "real" number does not exist for any tool.

---

## ⚡ Latest cycle (Aug 14–21, 2026) — READ THIS FIRST

The most important recent changes (they supersede a few older sections below):

### AI speed & reliability — the big win
- **Text model swapped** `gemini-flash-latest` → **`gemini-3.1-flash-lite`** (benchmarked
  on our key: the old alias 503'd "high demand" ~75% of the time and was slow; the lite
  model returns 200 in **~2s, reliably**). Auto **fallback to `gemini-3.5-flash`** on
  overload. **`thinkingBudget: 0` is now the DEFAULT fast path** (the old "never send 0,
  it 400s" note is STALE — it works now). Net effect: title generation went from
  **40–82s / 503** to **~6–9s**. Env: `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`.
- **Grounding is cached** (`buildGrounding` in `lib/ai/etsy-prompts.ts`, memCache) — the
  same Etsy+search grounding feeds Title/Tag/Description + re-runs, so it's instant after
  the first generation for a keyword.
- **Multi-key rotation/failover** exists (`GEMINI_API_KEYS` / `OPENAI_API_KEYS`, comma-sep,
  round-robin + fail over on 429/5xx) but the owner runs **single keys**; fast backoff
  (150ms hop, capped) handles it.
- **Calm generation UX** (`lib/ai/busy.ts` + kit `GenNote` / `GenSkeleton`): **NO red error
  box in generation.** Skeleton while loading → at **30s** "Please wait — we're a little
  busy today" → at **2 min** a calm "please try again". Auto-retries transient failures,
  spaced; credits are charged once (retries never re-charge).

### No provider footprints (owner request)
- User-facing dashboard text no longer names the AI provider (Gemini/OpenAI) OR the data
  sources (Etsy API / Google Ads) — genericised ("real, measured data", "Search Volume",
  neutral error strings in `lib/ai/messages.ts`). **⚠️ The required verbatim Etsy
  attribution** ("...uses the Etsy API but is not endorsed or certified by Etsy, Inc.")
  is a LEGAL disclaimer in the footers/legal pages — **never scrub it.**

### Money shown in USD everywhere
- Google **CPC**, estimated **Rev/mo**, and **Price** columns all render **USD** via live
  FX (`/api/fx` + `useUsdRates` batch hook in `hooks/useFx.ts`). Null rate ⇒ keep the
  listing's own currency (never a guessed conversion).

### Per-listing sales estimate — now MULTI-SIGNAL (supersedes the reviews-only section)
- `estimateListingSales` takes the **strongest** of three real signals: reviews
  (÷`reviewRate`), views (×`conversionRate`), favorites (×`favToSales`). So a listing
  whose reviews Etsy under-reports (Etsy pools an item's reviews across relists — the
  per-listing API count can be 4 while the page shows 35) is still measured by traffic
  instead of collapsing to ~0. Genuinely dead listings still read ~0. `basis` field says
  which signal won. New envs: `NEXT_PUBLIC_ETSY_CONVERSION_RATE` (0.02),
  `NEXT_PUBLIC_ETSY_FAV_TO_SALES` (1.5).

### Listings → click opens an IN-APP detail panel (not Etsy)
- Clicking a row/title opens `ListingDetailPanel` — all real stats + animated meters + the
  badged sales estimate + **real shop context** (lifetime sales/reviews/rating via
  `/api/etsy/shop-summary`) + tags. **Only "See on Etsy" leaves the app.** The table has a
  **top-mounted horizontal scrollbar** and skeleton loading (shared `Loading` upgraded to
  a skeleton, so every tab shows one).

### Keyword Difficulty display remap
- KD in the **51–70** band is shown as a stable **40–50** (deliberate product decision;
  `difficultyScore` in `etsy.ts`). ≤50 and >70 are untouched. Seeded so it never flickers.

### Admin dashboard rebuilt
- Left-**sidebar** shell: Overview / Users / Analytics / Content / Settings. Overview has
  animated count-up KPIs + a signups bar chart + plan-distribution donut (`AdminCharts.tsx`).
  Users table is **searchable** (name/email/ID) with a **Sr-No** and copyable ID; **click a
  user → a full detail drawer** (`UserDetailPanel`, `GET /api/admin/users/[id]`). Numbers
  are **exact** ("1,300", not "1.3K").

### Plan expiry lifecycle (NEW — important)
- Plans auto-revert to **free**: **PAID** via the Lemon Squeezy webhook (unchanged);
  **ADMIN-GRANTED** (the Free→Pro promo OR the plan dropdown) now carries **`compExpiresAt`**
  = exactly **one calendar month** → auto-reverts. Enforced immediately by `effectivePlan`
  (read-time) and persisted by `sweepComps` (`lib/plan-lifecycle.ts`, runs on every admin
  load) + `/api/cron/plan-expiry` (daily). Active paid subs are never comp-expired. Admin UI
  shows "⏳ expires \<date\>". See [[plan-expiry-lifecycle]].

### Lordicon animated icons
- The dashboard nav rail, Overview launcher cards, and the admin sidebar use **animated
  Lordicons** (`components/ui/AnimIcon.tsx`, free CDN) that play on hover / when a tab
  becomes active — same colours as before. Landing site still uses inline SVGs (TODO).

### SEO / programmatic
- All tool pages **and** the fee calculator now use **`etsy-`-prefixed slugs**
  (`/etsy-keyword-research`, `/etsy-fee-calculator`, …) with **301 redirects** from the old
  paths; the canonical host is forced to the **apex domain (non-www)**; added
  `/deals-sitemap.xml` + a default `opengraph-image`; fixed the Zafar Ali page's
  `dateCreated` to full ISO 8601 (a Google Search Console warning).

---

## Tech Stack
- **Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)**
- **MongoDB** via Mongoose · JWT auth (`jose`) + bcrypt + email OTP
- Data: **Etsy Open API v3**, **Google Ads API** (Keyword Planner, v24), **Gemini** (text: `gemini-3.1-flash-lite`, fallback `gemini-3.5-flash`; image: `gemini-3.1-flash-image-preview`) + **OpenAI** (`gpt-image-1`, one image only)
- React Query + Zustand · Chart.js · inline styles + token palette (`src/utils`: `C` chrome, `D` data-viz) + `globals.css` (parchment + orange `#FB5E09`)
- Dev: `npm run dev` (**:3000**)

---

## ⭐ Keyword stats — how "Average Etsy Searches" works (READ THIS)

`src/lib/etsySearchEstimate.ts` + the "Keyword Statistics" panel in `KeywordsTab.tsx`.

The stats card shows two search numbers:
- **Google Searches** — real Google Keyword Planner monthly volume (measured). This
  is Google, NOT Etsy, so it will not match eRank.
- **Average Etsy Searches** — an **estimate** of monthly Etsy searches.

**Why an estimate:** Etsy publishes zero search-volume data. eRank's "Avg. Searches"
is *also* an estimate. Verified from real side-by-sides that eRank's number:
1. is **NOT** derived from Google volume (crochet: 313K Google → eRank 187K; planner:
   30K Google → eRank 199K — no correlation);
2. is **region-specific** (eRank USA ≈ ~20% of its Global/GLO number);
3. does **not reliably track any signal we have** for all keyword types.

**The model has two layers:**
1. **Global anchor** — `etsyGlobal ≈ K · competition^P` (default `K=345`, `P=0.434`,
   env-overridable via `NEXT_PUBLIC_ETSY_SEARCH_K` / `_P`). Fitted to eRank **Global**:
   crochet 2.3M→187,873 · planner 2.0M→199,164 · huntrix 12.7K→20,847 (within ~6%).
2. **Per-country split (NEW, Aug 2026)** — `etsyCountry = etsyGlobal × countryShare`,
   where `countryShare` is the selected country's share of the keyword's Google demand,
   read from the **Searchers-by-Country** breakdown (`scaleEtsySearchesToCountry` in
   `etsySearchEstimate.ts`, wired through `countriesForGeo` → `KeywordStatsPanel`).
   **This is eRank's own formula** — reverse-engineered and verified against real
   side-by-sides within ~4%: necklace global 159,347 × US 29.8% = 47.5K (eRank 49,493);
   × India 6.3% = 10.0K (eRank 9,828); resume global ~37.6K × US 14.8% = 5.6K (eRank
   5,804) · × Canada 3.4% = 1.28K (eRank 1,252). The panel now shows the **full**
   country distribution (like eRank) with the selected country highlighted, instead of
   the old "selected country = 100%".

**Known limitations (be honest with users):**
- **Fixed the old "same number for every country" bug.** Per-country scaling now nails
  small countries (necklace France 2,465 vs eRank 2,103). Two residual errors remain for
  **broad** keywords: (a) the global anchor overshoots huge visual categories (necklace
  comp 6.3M → our 308K vs eRank 159K, ~1.9×), and (b) our **Google** geo-distribution
  differs from eRank's proprietary one — e.g. our necklace India share is 34.7% vs
  eRank's 6.3%, and eRank surfaces Pakistan (16%) which our 7-country basket omits. So
  high-share countries can still miss (necklace India ~107K vs eRank 9.8K).
- **The anchor can't be fixed by refitting `comp^P`:** it's non-monotonic vs eRank —
  necklace comp 6.3M→159K but planner comp 2M→199K (higher comp, higher eRank). And no
  Google-based anchor works either (planner: 30K Google→199K eRank). eRank has
  proprietary Etsy search-frequency data no public API exposes.
- **Breaks for non-Etsy-native terms**: e.g. "boats" has 406K listings but eRank reports
  **< 20 searches**; the competition model gives ~94K — wrong. Same proprietary-data wall.
- **Bottom line:** per-country **ratios** now match eRank's method precisely; the
  remaining gap is the **global magnitude** for broad keywords + our distinct geo split.
  To close it: (a) accept the labelled estimate; (b) adopt an eRank-like distribution
  (needs Pakistan/RoW + eRank's weighting, which we can't source); (c) true match needs
  Etsy search data (no public API gives it).

---

## Recent changes (Aug 2026 cycle)

### Keyword accuracy & reliability
- **Fixed blank keyword stats (real bug):** a transient Google Ads failure returned an
  empty map that looked identical to "no data" and got **cached for 5h** → keyword
  showed `—`. Now: Google Ads calls **retry** (429/5xx), a failed lookup is **flagged
  and NOT persisted** (cached 2 min only), and the shared/collective package
  **self-enriches** missing Google stats live. (`google-ads.ts`, `keywords.ts`)
- Added **Average Etsy Searches** + renamed "Avg. Searches" → **Google Searches**
  (see section above).
- **Per-country Average Etsy Searches (NEW):** the estimate no longer shows the same
  global number for every country. It's now `globalEstimate × selectedCountry'sGoogleShare`
  — eRank's own formula, verified within ~4% (see the ⭐ section). Searchers-by-Country
  shows the full distribution with the selected country highlighted, matching eRank.
- **Global trends fix:** "Global" now aggregates real per-country metrics instead of
  omitting the geo target (which returned empty). (`google-ads.ts`)

### AI / cost / resilience
- **Etsy Listing Pro 502 fix:** token budget was 4096 (too small for the big listing
  JSON → truncated → parse fail → intermittent 502). Raised to **8192**; client now
  shows the server's honest message. (`ai/listing-pro/route.ts`)
- **Honest AI quota errors:** `geminiGenerate`/`geminiJSON` now report `reason: 'quota'`
  on a terminal 429 so tools say "AI temporarily unavailable — provider quota used up"
  instead of "try again". (`gemini.ts` + title/tag/description/listing-pro routes)
- **Load resilience (`src/lib/concurrency.ts`):**
  - `singleFlight` — coalesces concurrent identical keyword searches into ONE upstream
    fetch (viral-keyword thundering-herd guard). Applied to `getKeywordCore`.
  - `createLimiter` — per-instance concurrency caps on Gemini **image** (`GEMINI_IMAGE_CONCURRENCY`, default 3)
    and **text** (`GEMINI_TEXT_CONCURRENCY`, default 8) so a burst can't stampede the provider.
  - DB pool hardened: env-tunable `MONGO_MAX_POOL_SIZE` / `MONGO_MIN_POOL_SIZE` +
    `MONGO_MAX_IDLE_MS` (30s) so scaled instances release idle connections. (`db.ts`)

### Admin
- **All Users** table redesigned; **"★ Paid" shown only in Status**, only for real
  Lemon Squeezy purchases (`lsSubscriptionId`), never admin-granted plans. Pagination.
- **Restrict user** toggle → restricted users get a full-screen block on the dashboard
  (checked fresh from DB via `/api/auth/me`, not the JWT). Confirmation modals for
  delete/restrict.
- **Free → Pro toggle** (above All Users) + **Refresh** button: turns every `plan:'free'`
  user into `'pro'` (`updateMany({plan:'free'},{plan:'pro'})`); Refresh re-runs it for
  new free users. Paid/higher plans are untouched (filter only matches free).
  (`lib/promo.ts`, `/api/admin/free-to-pro`, `AppSetting` model)
- Admin can **Manage deals** and **Manage ads** (new CRUD sections).

### Public site — Deals & Popup ads
- **Deals** (`Deal` model, `/admin/deals`, public `/deals` + `/deals/[slug]`): admin-
  authored offers; 2 per page + pagination; dotted-glass cards with animated
  "marching-ants" border; CTA routes to Lemon Squeezy checkout or a URL. A default
  **Pro · 1-Year deal** is auto-seeded. Navbar **Deals** link (glass pill, animated
  border) sits after Blog.
- **Popup ad** (`PopupAd` model, `PopupAdHost` in `providers.tsx`, `/admin/ads`):
  shows once per session on the marketing site (never in dashboard/admin/auth). Two
  modes — a styled card with an **animated price tag** + "Learn more", or an uploaded
  **image (Canva export URL) with a click link**. Default 1-Year card auto-seeded.

### Multi-shop, profile, pricing, blog
- **Multi-shop:** connected Etsy shops moved from scalar `User` fields (which cleared
  on logout / limited to 1) to a **`ConnectedShop` collection** — persists across
  logout, supports multiple shops, switch/disconnect in My Shop. Legacy single-shop
  connections auto-migrate. (`lib/etsy-tokens.ts`)
- **Profile:** users can **Upgrade plan** (→ pricing) and **self-delete** their account.
- **Pricing:** now **USD, Lemon Squeezy** (checkout live). Plans carry **daily credits**
  + monthly Etsy Listing Pro image allowances (Free 1 / Starter 2 / Basic 3 / Pro 5 /
  1-Year 20 / …). 1-Year = **$99.99**, bonus details always shown (no dropdown).
- **Credit system:** "other tools" (no hard limit) cost **10 credits/use**; per-plan
  daily allowance (Free 50 → Enterprise 2500); balance pill in the dashboard header;
  admin tracks per-user credits. (`lib/credits.ts`)
- **Blog editor:** select a word → **🔗 Link** prompts for a URL → `[word](url)`; blog
  links render **blue + underlined**.

---

## AI providers — Gemini everywhere, OpenAI for ONE image
**All AI is Gemini** (text + images) EXCEPT the **Etsy Listing Pro hero image**, which
is generated by **OpenAI `gpt-image-1`** (`src/lib/openai-image.ts`, used only by
`/api/ai/listing-image`). Reason: that image is mostly typography (headline/subtitle/
badges) and gpt-image-1 renders in-image text far better. `openaiImage()` mirrors
`geminiImage()`'s outcome shape + `recordImage` cost tracking. The hero prompt is the
seller's exact brief with the Focus Keyword injected (dynamic headline split, subtitle,
badges, mockup). Ref-photo upload → OpenAI edits endpoint. Env: `OPENAI_API_KEY` (+
optional `OPENAI_IMAGE_MODEL` gpt-image-1|dall-e-3, `_SIZE` 1536x1024, `_QUALITY` medium
(≈$0.07/image; low/high available), `_CONCURRENCY`). ⚠️ gpt-image-1 needs a **verified OpenAI org** and lists a sunset date
(~2026-10-23) — model is env-swappable. Verified live 2026-08-14 (key valid, generation OK).

## AI / Gemini — cost & billing notes
- **Text** (`gemini-flash-latest`) and **image** (`gemini-2.5-flash-image`) share the
  **same billing** on `Gemini_API_KEY`. **Text costs money too** — a small fraction of
  a cent per call, but real. (Note: text-gen cost is **not** yet recorded in the admin
  usage dashboard; only image cost is, via `recordImage`.)
- **Image cost ≈ $0.039/image** (fixed ~1,290 output tokens, resolution-independent —
  you can't "lower resolution to save"). Already capped by per-plan monthly allowances;
  failed gens **refund** the allowance. $15 ≈ ~380 images.
- **Cheaper images = switch provider** (config-only model/pricing envs exist). Flux via
  Replicate: `flux-dev` (~25–35% cheaper, good text) for from-scratch; `flux-kontext-pro`
  for reference-photo cases. `flux-schnell` is cheapest but weaker text — avoid for hero
  images. Verify live pricing on Replicate before committing. (Adapter not built yet.)
- **Two API keys** help resilience only if in **separate GCP projects** (independent
  quota/billing) — not cost. Recommended: a `GEMINI_IMAGE_API_KEY` for the expensive
  image project so it can't take down text generation. (Not wired yet.)

---

## Per-listing sales ESTIMATE (Everbee-style, honest)

> ⚠️ **Model upgraded Aug 21** — see the "MULTI-SIGNAL" note in the Latest-cycle section
> above. It's no longer reviews-only; it takes the strongest of reviews / views / favorites.
> The section below documents the original reviews-only rationale (still the review layer).

`src/lib/salesEstimate.ts` + `getListingReviewStats` (`etsy.ts`) + `/api/etsy/listing-reviews`.

Etsy publishes **no** per-listing sales. Everbee estimates them from **reviews** (a
review = a verified purchase; only a fraction of buyers review). We do the same,
**clearly labelled** (never presented as real Etsy data):
- `estTotalSales   ≈ reviewCount ÷ reviewRate`
- `estMonthlySales ≈ monthlyReviews ÷ reviewRate` — recent 30-day review velocity when
  the listing is active, else its lifetime average (so a proven seller with a quiet
  month still reads as selling).
- `estMonthlyRevenue ≈ estMonthlySales × price`
- `reviewRate` = share of buyers who review, **env-tunable** `NEXT_PUBLIC_ETSY_REVIEW_RATE`
  (default 0.12). **This is the dominant error source** — varies by category/price/shop.

Real inputs (one Etsy call/listing → cached 24h): lifetime review **count** +
trailing-**30-day velocity** (`getListingReviewStats` fetches `?limit=100`, both in one
response). **Listing Age** is 100% real (`created_timestamp`).

**Surfaced in three places**, estimates badged `~` + amber, real columns unchanged:
- **Keywords → Top Listings** and **Listings tab** (both use `TopListingsTable`): new
  `~ Sales/mo`, `~ Rev/mo`, `~ Total sales` columns + `Reviews/30d` (hidden by default);
  Age + Reviews were already real columns.
- **Find Hot Products**: list adds **Age** + `~ Sales/mo`; grid card adds age + `~/mo`;
  `HotProductDetail` gets a full **Sales estimate** block (Reviews, ~Sales/mo, ~Rev/mo,
  ~Total). Review stats fetched lazily, **capped to the top 30 rows** for API cost.

Honesty: reviews/age are the real numbers; the `~` figures are directional estimates.
Shop-level **lifetime** sales (`transaction_sold_count`) remain real (Competitor Sales).

## What the Etsy API does / doesn't give (memorize)
**DOES:** active listings (title/tags/price/views/num_favorers/created/taxonomy), shop
record incl. **`transaction_sold_count`** (real lifetime sales), reviews, sections,
taxonomy, and — under shop-owner OAuth — receipts.
**Does NOT (never fake):** **search volume** (Google only), clicks/CTR (show favs÷views),
**per-listing sales** (shop-lifetime only), search history/seasonality, processing times.
Gotchas: mixed currencies with no FX rate (scope to dominant), HTML-encoded titles
(`decodeEntities`), ~10 req/sec limit (shared `rateGate`, 8/sec).

---

## Key systems (unchanged fundamentals)
- **Keyword pipeline** (`keywords.ts`): cold keyword ~33 Etsy calls, split into
  independently-cached stages (core/related/near/listings) requested in parallel; don't
  merge them. Now fronted by `singleFlight`.
- **Shared store** `collectivekeyworddatas` (`collective-read.ts`): Ranktsy's Bulk Search
  saves complete packages permanently; Rankkw reads them first → 0 API calls on a hit.
- **Cache versioning:** Mongo keyword cache keys on the keyword, NOT the version;
  `isStaleCore()` is the only thing retiring old doc shapes — add a probe there per new field.
- **Snapshots** (`snapshots.ts`): Etsy returns state not history; daily snapshots are the
  only sales-over-time source, ~400-day TTL, can't be backfilled.
- **Usage analytics** (`usage.ts`, `withUsage`): per-user Etsy/Google/image/credit counts
  → `userapiusages`, shown in `/admin`.

---

## Environment variables
Core: `MONGODB_URI`, `ETSY_API_KEY` + `ETSY_SHARED_SECRET`, `Gemini_API_KEY`,
`GOOGLE_ADS_*` (client id/secret, dev token, customer id, refresh token),
`JWT_SECRET`/`JWT_REFRESH_SECRET`, SMTP (`SMTP_*`, `EMAIL_FROM`), `ADMIN_EMAILS`,
`CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, Lemon Squeezy (`LS_*` incl. per-plan variant ids).

New / tunable this cycle:
- `NEXT_PUBLIC_ETSY_SEARCH_K` (345), `NEXT_PUBLIC_ETSY_SEARCH_P` (0.434) — Etsy-search estimate curve.
- `NEXT_PUBLIC_ETSY_REVIEW_RATE` (0.12) — review→sales rate for the per-listing sales estimate.
- `OPENAI_API_KEY` (+ `OPENAI_IMAGE_MODEL`/`_SIZE`/`_QUALITY`/`_CONCURRENCY`) — Etsy Listing Pro hero image only.
- `GEMINI_IMAGE_CONCURRENCY` (3), `GEMINI_TEXT_CONCURRENCY` (8) — per-instance AI caps.
- `MONGO_MAX_POOL_SIZE` (10), `MONGO_MIN_POOL_SIZE` (0), `MONGO_MAX_IDLE_MS` (30000).
- `GEMINI_MODEL`, `GEMINI_IMAGE_MODEL`, image pricing overrides.

---

## Open items the USER must do (external — not code)
1. **Gemini billing** — keep prepaid credits topped up; a depleted balance 429s and
   blanks all AI generators. Consider a separate GCP project/key for images.
2. **Etsy Commercial API** — app name/site → `https://rankkw.com`, OAuth callback
   `https://rankkw.com/api/etsy/oauth/callback` registered.
3. **MongoDB tier** — for real traffic move off M0/M2 (low connection caps) to ≥ M10.
4. **Etsy searches calibration** — decide: accept the labelled estimate, add per-country
   scaling, or drop it. Send more eRank reference numbers to refine the curve.
5. **Multi-instance** — if deploying to multiple instances/serverless, back the
   in-memory rate-limit/cache/single-flight with Upstash Redis.

---

## Repo map
```
src/
  app/            App Router pages + /api (auth, etsy, keywords, ai, admin, deals, popup-ad, lemonsqueezy, cron…)
  components/     landing/ (public site, Deals, PopupAdHost) · dashboard/ tabs/ + kit.tsx · admin/
  lib/            etsy.ts, keywords.ts, google-ads.ts, gemini.ts, concurrency.ts, promo.ts,
                  etsySearchEstimate.ts, etsy-tokens.ts, credits.ts, deals.ts, popupAd.ts,
                  collective-read.ts, usage.ts, snapshots.ts, models.ts, db.ts, auth/, ai/
  types/          shared types   ·   utils/  C + D palettes + formatters
```
_Deeper per-feature history lives in the `memory/` files this repo's tooling maintains._
