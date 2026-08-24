# Session summary — Rankkw

_What was built/changed in this working session. Grouped by area, newest work last._
_Kept separate from the project's main `SUMMARY.md`._

---

## 1. Security review & hardening (18-point audit)

Reviewed the whole app against an 18-point checklist and fixed the real issues.

- **Central API auth gate** — `src/proxy.ts` (Next 16 renamed `middleware`→`proxy`)
  login-gates every `/api/*` route except a tight `PUBLIC_API` allowlist. Closed the
  biggest hole: AI/Etsy/keyword routes were anonymously callable (could drain paid quota).
  **New public routes MUST be added to `PUBLIC_API`.**
- **Fail-closed secrets** — `JWT_SECRET`, `JWT_REFRESH_SECRET`, token-encryption key now
  throw at boot in production instead of falling back to a public dev string.
- **Rate-limit backstop** — `src/lib/api-guard.ts` (`withApiGuard`) adds a per-user/IP cap
  on the costliest AI routes.
- **XSS** — `src/components/seo/JsonLd.tsx` escapes `<`/`>`/`&` in JSON-LD; the Markdown
  renderer drops `javascript:`/`data:` URLs; added a **CSP** + `Permissions-Policy`.
- **Auth** — generic login error (no user enumeration); OTP uses `crypto.randomInt`;
  reset-password got a per-email attempt cap; reference-image upload mime/size-capped.
- Verified clean: CSRF (SameSite=Lax), SSRF (fixed hosts), CORS (none), IDOR (shop
  access scoped by userId), no committed secrets, no exposed source maps.

## 2. "No footprints" copy cleanup (dashboard)

Genericized user-visible dashboard text that revealed the backend mechanics — "live Etsy
search", "Gemini", "Google Ads" → neutral wording (e.g. "Analyzing…", "real market data").
The **required legal Etsy attribution** in footers/legal pages was left untouched.

## 3. Emojis → icons

Replaced rendered pictographic emojis across the dashboard/admin with the animated
Lordicon (`EmptyState`) + a lightweight inline-SVG `Icon` set (list rows, badges). Kept
semantic glyphs (★ ✓ ⚠) and country flags. ~78 UI sites; the `─`/arrows in code comments
were untouched (not emojis).

## 4. Zafar Ali profile stats

`4.8★ → 5.0★`, `880+ → 1500+`, `$100K+ → $300K+`, `Level 1 → Top Rated`, plus every
matching figure in the page body/meta for consistency.

## 5. Dashboard & UX

- **Keyword Gap** — merged the two inputs into ONE that accepts a keyword **or** a listing
  URL/ID (backend derives the keyword from a pasted listing).
- **Dashboard tool filter** — a search box in the sidebar to find a tool by name.
- **Auth-state flash fixed** — the landing navbar shows a skeleton until `/auth/me`
  resolves, so a logged-in visitor never sees Login/Sign-up flash first.
- **Button loaders** — `src/components/ui/NavButton.tsx` shows a spinner until the next
  page commits; wired to Admin↔Dashboard, Dashboard→Profile, Profile→Dashboard/Admin/Pricing.
  (Not on tool tabs or the Features menu.)
- **Em dashes removed** site-wide (1,203 across 209 files → hyphens).
- **Credit system verified** — all 20 metered tools charge correctly; balance updates live.

## 6. Etsy listing publish ("Send to Etsy")

- `createDraftListing` in `lib/etsy.ts` + `POST /api/etsy/create-listing` + the
  `SendToEtsy` UI on Etsy Listing Pro. Creates a **DRAFT** (never live) in the seller's shop.
- Added the `listings_w` scope to the Etsy OAuth request.
- **Action needed:** there is NO "enable `listings_w`" toggle in Etsy's dev console —
  scopes are granted at OAuth consent from `ETSY_SCOPES`. The real prerequisites are
  (a) the app has **Commercial API access** (already granted), and (b) each seller must
  **reconnect** their shop once so their token carries `listings_w` (tokens minted before
  the scope was added lack write access → the create-listing route returns a 403 with a
  "reconnect" message). NOTE: `listings.updated.*` / `order.*` in Etsy's webhooks/events
  portal are unrelated — those are event subscriptions, not OAuth scopes.

## 7. Uptime & scaling ("site goes down under load")

Diagnosed: running a bare `next start` = 1 process, 1 core, no auto-restart.

- `ecosystem.config.js` — **PM2 cluster** (worker per core), autorestart, OOM-recycle.
- `src/instrumentation.ts` + `src/instrumentation-node.ts` — **crash logging** (prod only;
  Node-only code split out of the Edge bundle).
- `GET /api/health` — DB-ping probe for uptime monitors / nginx.
- Bumped in-memory cache to 5000 entries.
- **`SCALING.md`** — the runbook. **Biggest real bottleneck: the MongoDB tier** — the
  health ping measured **~753 ms**, i.e. a free/shared tier. **Move to ≥ M10.**
- Deploy with: `npm run build && pm2 start ecosystem.config.js && pm2 save && pm2 startup`.

## 8. anime.js brand loader

Added **anime.js v4** (bundled, CSP-safe). A "Rankkw" wordmark draws itself on when the
dashboard mounts, then fills solid and fades. Real font outlines (Segoe UI Bold via
opentype.js), faint ghost layer, cream background, dotted grid + soft glows. Plays **once
per session** (`sessionStorage`); the dashboard mounts only after it finishes (so the
animation is smooth). `DashboardLoader.tsx`.

## 9. Automate Etsy Shop  (HIDDEN — `/automatelisting`)

A batch tool that generates SEO listings from real market data and pushes each to the
shop as a draft, one by one.

- **Engine:** `AutomationRun` model + `POST /api/automation/runs`, `GET .../[id]`,
  `POST .../[id]/step` (resumable, client-driven loop for now — upgrades to a real queue
  when you scale). Orchestrator (`lib/automation/orchestrator.ts`) reuses `buildGrounding`
  + `geminiJSON` + `createDraftListing`.
- **Dedicated AI key:** set `AUTOMATION_GEMINI_API_KEY` — isolates cost (a per-call
  `apiKeys` override was added to `geminiJSON`). Falls back to shared keys.
- **Visual node editor (React Flow):** `AutomateEditor.tsx` — add/connect/configure
  circular nodes on a canvas, a **Shop** node (multi-shop), per-node options
  (title style / tag focus / desc length / price strategy), then **Execute** with live
  per-node status + a results panel. Auto-connect, drag-to-connect, and proximity-connect.
- **⚠️ Key bug fixed — "nodes weren't connecting" — resolved by migrating React Flow
  v12 → v11.** Root cause: `@xyflow/react` **v12**'s node measurement does not fire in
  this Next 16 / React 19 / Turbopack stack, so nodes never get handle bounds and edges
  never render (this also kills proximity-connect and handle-drag). Many `updateNode
  Internals` workarounds were tried and were all fragile. The fix that stuck: switch the
  ONE file that uses React Flow (`AutomateEditor.tsx`) to **`reactflow` v11.11.4**, which
  measures natively on this exact stack — proven by the sibling **Connect GS** project
  (`D:\Connect gs\connect-gs-main`, Next 16 + React 19 + reactflow v11) whose canvas
  connects fine. `npm i reactflow@^11.11.4`; `@xyflow/react` left installed but unused.
  Changes in `AutomateEditor.tsx`:
  - Imports now from `reactflow` + `reactflow/dist/style.css`; `NodeProps<WFData>`.
  - **Proximity-connect rewritten measurement-INDEPENDENT** (Connect GS's technique):
    `closestEdge` computes distances from each node's plain `.position` (via
    `rf.getNodes()` + the live dragged `node.position`), never from measured
    `positionAbsolute`. Drag a node close → dashed orange preview edge → commit on drop.
  - Edges are `animated: true` (v11 renders these as moving dashed lines — the "dotted
    line" look) with `EDGE_STYLE = { stroke: '#7b8496', strokeWidth: 2.5 }` (dark enough
    to see; the old `#c3c8d4` on `#f4f5f8` was near-invisible even when rendered).
  - **Small v11-native measurement net:** a `useEffect` (keyed on `nodes.length`) calls
    v11's `updateNodeDimensions` for any painted node lacking dimensions, retrying a few
    times. No-op once the ResizeObserver has measured; exists only to cover a paused
    observer (hidden/background tab). NOTE: the headless verify pane is permanently
    `visibilityState:hidden`, which pauses BOTH v11 and v12 measurement — this net is what
    let it be verified there; a normal visible tab wouldn't need it.
- **Verified (worst-case hidden pane):** add nodes → 3 edges auto-render with real
  geometry, animated dashes, `#7b8496` stroke, positioned exactly in the gap between each
  pair of node handles.
- **Access:** the page is currently **open (no admin gate)** but hidden (not in nav/
  sitemap, `noindex`); the `/api/automation/*` routes stay owner-gated, so a stranger who
  finds the URL sees only a non-functional canvas. Re-add a gate in
  `app/automatelisting/page.tsx` to lock it down.
- Drafts only, never auto-publishes live (Etsy policy).
- **Not yet:** AI image node (needs a dedicated OpenAI key), saving/listing multiple
  workflows, and a real Redis/BullMQ queue.

## 10. Deploy hygiene

- Fixed the recurring `git pull` conflict on `package-lock.json` → discard it, and switch
  the server to **`npm ci`** (reproducible, never dirties the lockfile).
- **middleware → proxy** migration (Next 16 rename) and the instrumentation Edge-runtime
  split — both cleared the build warnings; build is now green.

## 11. AI-agent readiness (is-agentic / Ora — was 61/100)

- **`public/llms.txt`** — product summary, when-to-use guidance, resource links.
- **`public/openapi.json`** — OpenAPI 3.1 for the public endpoints + the real Etsy OAuth
  scopes (scoped-permissions check).
- **Agent-friendly 404** — real 404 status with recovery links (sitemap, llms.txt, pages).
- **Organization JSON-LD** — added `contactPoint` (support@rankkw.com) + `PostalAddress`.
- **`Vary: Accept`** header (markdown content-negotiation).
- **MCP server** — `src/app/api/mcp/route.ts`, Streamable HTTP / JSON-RPC 2.0 at
  `/api/mcp` (alias `/mcp`). Tools: `etsy_fee_calculator`, `convert_to_usd`,
  `etsy_listing_lookup` (safe/cheap only). Resources: `rankkw://about`, `rankkw://tools`.
  Verified live end-to-end.

---

## Action items for you (outside the code)

1. **Deploy** the latest changes: `git add -A && git commit -m "…" && git push`, then on
   the server `git pull && npm ci && npm run build && pm2 restart rankkw-app`. Hard-refresh
   the browser afterward (cached JS caused the "nodes not connecting" confusion).
2. **MongoDB → ≥ M10** (the ~753 ms ping is the real scaling ceiling).
3. **Run under PM2** (see `SCALING.md`).
4. **Etsy `listings_w` scope** on your Etsy app + reconnect shops (for draft upload).
5. **Env keys:** `AUTOMATION_GEMINI_API_KEY` (+ a dedicated OpenAI key when the image node
   is built). Confirm the JWT/encryption secrets are set (they now fail-closed).
6. **Decisions:** re-gate `/automatelisting` if desired; confirm the business
   `addressCountry` (set to `PK`); decide whether to expose a real keyword tool over MCP.
7. **Rescan** on is-agentic after deploy to see the new score.
