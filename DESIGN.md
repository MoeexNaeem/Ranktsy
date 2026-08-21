# Rankkw — Design & Architecture

_Last updated: 2026-08-21_

This is the **how it's built** companion to `SUMMARY.md` (the **what's been done**). It
captures the architecture, the load-bearing design decisions, and the invariants that
future changes must respect.

---

## 1. What it is

**Rankkw** is an Etsy SEO & analytics SaaS: keyword research, competitor/listing analysis,
trend tracking, and AI copy/image generators. A logged-in **dashboard** of ~34 tools sits
behind a marketing site (landing, pricing, blog, deals). It competes with eRank / EtsyHunt
/ Everbee. A sibling app, **Ranktsy** (`:3001`), shares one keyword database.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · MongoDB
(Mongoose) · JWT auth (`jose`) + bcrypt + email OTP · React Query + Zustand · inline styles
over a token palette + `globals.css`. External data: Etsy Open API v3, Google Ads Keyword
Planner (v24), Gemini (text + image), OpenAI (one image).

---

## 2. The prime directive: NO FABRICATED DATA

Every number is **real** (from an official API) **or absent** (`—`). A failed lookup renders
`—`, never a plausible stand-in. New metrics are tested with a nonsense keyword to prove they
go blank rather than invent a value.

**The deliberate, LABELLED exceptions** — each an explicit *estimate*, never dressed as a
real Etsy figure, because the real number exists for no tool:

| Estimate | Where | Basis |
|---|---|---|
| Average Etsy Searches | Keyword stats | global anchor `K·comp^P` × country's search-share |
| Keyword Difficulty (KD) | everywhere | supply (log listings) + engagement; **51–70 remapped to 40–50 for display** |
| Per-listing Sales / Revenue / Total | Listings, Hot Products | strongest of reviews÷rate, views×CR, favorites×ratio |

The rule for anything new: if it's modelled, badge it (`~`, amber `D.mid`), keep the inputs
real, and let it read `—`/`~0` when the signals are genuinely absent.

---

## 3. High-level architecture

```
Browser (React 19, React Query cache, Zustand UI state)
   │  fetch /api/*
   ▼
Next.js App Router (route handlers, runtime='nodejs')
   │            │              │                 │
   ▼            ▼              ▼                 ▼
lib/etsy.ts  lib/google-ads  lib/gemini /      lib/*  (credits, quota,
(Etsy v3)    (Keyword Plan.)  openai-image      plans, promo, usage…)
   │            │              │                 │
   └──── shared: cache (memCache), rateGate, singleFlight, createLimiter ────┘
                              │
                              ▼
                        MongoDB (Mongoose models)
```

- **Server-only secrets.** All external APIs are called from route handlers / `lib` (never
  the client). The browser only ever talks to `/api/*`, which also adds caching + rate
  discipline close to the user.
- **Node runtime** on data routes (`export const runtime = 'nodejs'`) — Mongoose + the Etsy
  header signing need it.
- **State split:** server data lives in **React Query** (staleTime/gcTime tuned per feature);
  only UI state (active tab, filters) lives in **Zustand**.

---

## 4. Data layer & resilience (`src/lib`)

The shared primitives in `concurrency.ts` + `cache.ts` are what keep third-party APIs from
being the bottleneck or a cost sink:

- **`memCache`** — in-process LRU with per-key TTL. `CACHE_TTL` is deliberately **under
  Etsy's caching ceilings** (listing content ≤ 6h, other ≤ 24h): KEYWORD 5h, TRENDING 1h,
  SHOP 15m. Cache keys are on the **keyword**, not a version; `isStaleCore()` retires old doc
  shapes (add a probe there when you add a cached field).
- **`rateGate`** — global ~8/sec throttle for Etsy (limit is ~10/sec).
- **`singleFlight`** — coalesces concurrent identical keyword searches into ONE upstream
  fetch (viral-keyword thundering-herd guard). Also used to coalesce Etsy/Google **token
  refreshes** (they rotate single-use refresh tokens — concurrent refreshes would race).
- **`createLimiter`** — per-instance concurrency caps so a burst can't stampede a provider
  (Gemini image / text, OpenAI image).
- **Keyword pipeline** (`keywords.ts`): a cold keyword ≈ 33 Etsy calls, split into
  independently-cached stages (core / related / near / listings) fetched in **parallel** and
  painted progressively — **do not merge them back** (that regressed first-paint 3.8s → 12.7s).
- **Collective store** (`collective-read.ts`): Ranktsy's bulk search writes complete keyword
  packages permanently to `collectivekeyworddatas`; Rankkw reads those **first** → 0 API calls
  on a hit, and self-enriches any missing Google fields live.
- **Snapshots** (`snapshots.ts`): Etsy returns *state*, not history. Daily shop/listing
  snapshots are the ONLY source of sales-over-time; ~400-day TTL; can't be back-filled — a day
  not captured is lost. A daily cron guarantees a row for tracked shops.

**What the Etsy API does / doesn't give** — memorise, because half the "no fabricated data"
bugs come from forgetting: it gives active listings (title/tags/price/views/num_favorers/
created/taxonomy), the shop record incl. real lifetime `transaction_sold_count`, reviews,
sections, taxonomy, and (owner OAuth) receipts. It does **NOT** give search volume (Google
only), clicks/CTR (use favs÷views), **per-listing** sales (shop-lifetime only), search
history, or processing times. Gotchas: mixed currencies with no FX (scope to dominant),
HTML-encoded titles (`decodeEntities`), and `created_timestamp` resets on renewal — use
`original_creation_timestamp` for true age.

---

## 5. AI subsystem (`src/lib/gemini.ts`, `openai-image.ts`, `lib/ai/*`)

**One provider, Gemini, for everything** except the Etsy Listing Pro hero image (OpenAI
`gpt-image-1`, because that image is mostly typography). Design goals: fast, resilient,
honest, and **provider-anonymous to the user**.

- **Model choice is the latency lever.** Text = `gemini-3.1-flash-lite` (fast, reliable),
  with an automatic **fallback model** on overload. Sending **`thinkingBudget: 0`** routes to
  the fast non-thinking path — this is the single biggest speed win (the overloaded path is
  the "thinking" one). `think: true` opts back into reasoning for tasks that need it.
- **Grounding, then generate.** `buildGrounding(keyword)` gathers REAL data (Google demand +
  the tags the top live listings use) and is **cached**; the model is told to work from it and
  "never invent volumes/KD" — this is how AI copy stays inside the no-fabricated-data rule.
- **Never throws.** `geminiGenerate`/`geminiJSON` return `null` on failure so callers fall
  back to a rule-based path; a `meta.reason` (`quota` / `blocked` / `model_retired`) lets the
  UI phrase an honest message.
- **Key + model failover.** Round-robin across configured keys, fast 150ms hop on 429/5xx,
  then the fallback model; a MODEL-level 503 (all keys hit it at once) is what the model
  fallback exists for.
- **Calm client UX** (`lib/ai/busy.ts` + kit `GenNote`/`GenSkeleton`): time-phased, never a
  red box — silent skeleton → 30s "a little busy" → 2 min "please try again"; spaced
  auto-retry; credits charged once.
- **Provider anonymity.** No user-facing string names Gemini/OpenAI/Google/Etsy-API; error
  copy lives in `lib/ai/messages.ts`. The one exception is the **legally-required Etsy
  attribution** in footers — never scrub it.

---

## 6. Auth, plans, credits (`lib/auth`, `plans.ts`, `plan-lifecycle.ts`, `credits.ts`, `quota.ts`)

- **Auth:** JWT access + refresh in **HttpOnly cookies** (not localStorage). `getCurrentUser`
  decodes the access token fast-path; refresh silently re-issues. Admin is **server-gated**
  (`isAdmin`) on every admin route, plus `ADMIN_EMAILS` bootstrap. `restricted` is read fresh
  from the DB (never baked into the JWT) so a block takes effect immediately.
- **`effectivePlan(user)` is the plan truth** used by credits, quotas, and the plan API — NOT
  the raw `user.plan`. It downgrades to `free` when: the LS sub is `expired`; a non-active paid
  sub is past `planRenewsAt` (+1-day grace); **or an admin-granted plan is past `compExpiresAt`.**
- **Two expiry paths** (see `plan-lifecycle.ts`):
  - **PAID (Lemon Squeezy):** the signed webhook is the source of truth — it sets the plan,
    `subscriptionStatus`, and `planRenewsAt`, and flips to `free` on `subscription_expired`.
  - **ADMIN-GRANTED (comp):** the Free→Pro promo and the admin plan dropdown stamp
    **`compExpiresAt` = now + 1 calendar month**. `sweepComps()` persists the revert (runs on
    every admin-list load + a daily cron); active paid subs are always excluded.
- **Credits & quotas:** "other tools" cost 10 credits/use with a per-plan **daily** allowance
  (lazy UTC-day reset, like the classic reset pattern); Etsy Listing Pro images have a per-plan
  **monthly** allowance (consume-then-refund on failure so a failed gen never costs one).

---

## 7. Admin (`components/admin`, `api/admin`)

A **sidebar dashboard** (Overview / Users / Analytics / Content / Settings). Overview =
animated KPI cards + charts (`AdminCharts.tsx`, dependency-free SVG). Users = a searchable
table (name / email / ID, Sr-No, copyable id, **exact** comma-grouped numbers) whose rows open
a full per-user **detail drawer** (`GET /api/admin/users/[id]` → profile, plan/billing, credits,
shops, 14-day usage, recent searches). "★ Paid" marks ONLY a real Lemon Squeezy purchase
(`lsSubscriptionId`), never an admin grant. Per-user API-usage analytics come from the
`userapiusages` collection via `withUsage`.

---

## 8. UI / design system

- **Tokens over CSS files.** `src/utils` exports `C` (chrome palette: parchment/bone neutrals,
  brand orange `#FB5E09`, charcoal) and `D` (data-viz: green/amber/red — the "no green in
  chrome" rule applies to chrome only; data signals use `D`). Per-tool **accent hues** cascade
  through a `--accent` CSS var so a tab recolours on switch.
- **Layout:** inline styles for components; `globals.css` holds resets, animations, responsive
  breakpoints, and the scrollbar styling (incl. the **top-mounted** table scrollbar).
- **Icons:** migrating to **animated Lordicons** (`ui/AnimIcon.tsx`, free CDN) that play on
  hover / active-tab and rest otherwise — same hue as the old inline SVGs (dashboard nav +
  admin done; landing site pending).
- **Money is USD.** CPC, estimated revenue, and price render in USD via live FX
  (`hooks/useFx.ts`), falling back to the listing's own currency when a rate is unknown.
- **Loading = skeletons.** The shared `Loading` renders a KPI-row + block skeleton; AI
  generators use `GenSkeleton` + the phased `GenNote`.

---

## 9. Programmatic SEO & compliance

- **Tool pages** are data-driven from `TOOL_PAGES` (`lib/seo/tools.ts`) → one page per
  **`etsy-`-prefixed slug** (`/etsy-keyword-research`, …) rendered by `app/[tool]/page.tsx`
  with `dynamicParams=false`; each has FAQPage + BreadcrumbList JSON-LD. Old (un-prefixed)
  paths and `www` **301** to the canonical apex.
- **Sitemaps:** submit `/sitemap.xml` (index) → features / pages / blogs / deals sitemaps.
  Default social card at `app/opengraph-image.tsx`.
- **Etsy Commercial-Access compliance** (non-negotiable): the **verbatim attribution** string
  in every footer + legal page; caching under Etsy's TTL ceilings; **no scraping** (only
  `openapi.etsy.com`); public key-only reads (OAuth only for a user's own shop).

---

## 10. Deployment & operations

- `npm run dev` → **:3000**. External schedulers hit the crons (`/api/cron/snapshot`,
  `/api/cron/plan-expiry`) with `Authorization: Bearer $CRON_SECRET`; on Vercel they're wired
  in `vercel.json`. Because `effectivePlan` + on-load sweeps enforce plan expiry at read time,
  correctness does not depend on the cron firing.
- **In-memory** cache / rate-limit / single-flight are per-instance. Multi-instance or
  serverless deployment must back them with **Upstash Redis** (env stubs already present).
- Move MongoDB off M0/M2 (low connection caps) for real traffic; pool sizing is env-tunable
  (`MONGO_MAX_POOL_SIZE`, …).

---

## 11. Invariants (don't break these)

1. **No fabricated data.** Real or `—`. Estimates must be labelled and env-tunable.
2. **`effectivePlan` is the plan truth** for enforcement — never gate on raw `user.plan`.
3. **Keep the verbatim Etsy attribution** in footers/legal pages when scrubbing "footprints".
4. **Don't merge the keyword pipeline stages** — they're split for first-paint latency.
5. **Cache within Etsy's TTL ceilings** (6h listing content / 24h other).
6. **AI writes copy, never analytics** — always grounded in real, measured inputs.
7. **Secrets stay server-side**; the browser only calls `/api/*`.

Deeper per-feature history lives in the tooling's `memory/` files.
