# Rankkw — Session Work Summary (2026-08)

Everything built/changed in this working session, grouped by area. Kept separate
from `SUMMARY.md` (project handoff) and the earlier `SESSION-SUMMARY.md`.

---

## 1. Marketing pages — redesign + SEO

- **Tool/feature pages** (`src/app/[tool]/page.tsx`, data in `src/lib/seo/tools.ts`)
  — redesigned with a colourful bento layout, then constrained to one curated
  palette (orange + green + blue accents, charcoal + parchment neutrals). Added
  two new sections rendered from new data fields: **Overview** (`overview: string[]`)
  and **Use cases** (`useCases: ToolStep[]`) — real, honest copy for all 10 tools.
- **About** (`src/app/about/page.tsx`) and **Contact** — redesigned to the same
  palette. Contact split into a server `page.tsx` (metadata) + `ContactContent.tsx`
  (client form).
- **Landing** `AboutContactTeaser` + `CTA` (`Sections.tsx`) restyled (icon chips,
  arrow-circles, orange glow) to match.

### Server-rendering / metadata
- Converted `about`, `methodology`, `terms`, `privacy`, `refund-policy`,
  `service-policy` to **server components with `metadata`** (a JS hover was moved
  to a CSS `.toc-link` class). Every public page now has title/description/
  canonical/OG and is in the sitemap.
- **Sitemap localhost fix**: `src/lib/seo/site.ts` `siteUrl()` now prefers
  `SITE_URL`, and never emits a localhost origin in production.

---

## 2. Auth & account security

- **Signup validation**: live email-availability check (`/api/auth/check-email`),
  strong-password rules (8+, uppercase, number, special char) with a live
  checklist + red/green borders, confirm-match. (A breached-password / HIBP check
  was added and later **removed** per request.)
- **Rate limiting** on every auth endpoint (`src/lib/auth/rateLimit.ts`): login,
  register, forgot-password, reset-password, verify-otp, check-email.
- **Admin** page has a server-side guard (redirects non-admins); `/api/admin/*`
  already verify the signed JWT.
- **Show/hide password** eye toggles on every password field.
- **Captcha auto-reset**: a failed signup remounts the reCAPTCHA (no page reload).
- **Email-domain policy** (`src/lib/auth/schemas.ts`): allow any real email, block
  known **disposable** providers (`isAllowedEmailDomain`).
- **Welcome email removed** — only OTP/reset emails send now.
- Session is in **HttpOnly cookies** (`sr_access`/`sr_refresh`); no token in
  localStorage.

### Social login (Google + Microsoft)
- Full OAuth code flow: `src/lib/auth/oauth.ts`, `/api/auth/oauth/[provider]` +
  `/callback`. "Continue with Google/Microsoft" buttons appear only when the
  provider's env is set. `User` model: `password` optional + `authProvider`;
  find-or-create + link-by-email; new signups honour the email-domain policy.

### Auth UI
- **Back-to-home** button + a decorative on-palette backdrop (dotted grid, colour
  blobs, dashed rings, sparkles) behind the form card.

---

## 3. Email (Resend)

- `src/lib/auth/email.ts` sends via **Resend** from `support@rankkw.com` when
  `RESEND_API_KEY` is set (SMTP fallback otherwise). Emails use the real
  `website_logo.png` on a light header; links use `siteUrl()`.
- Domain `rankkw.com` verified in Resend (DKIM/SPF) — required for sending.

---

## 4. Infrastructure fixes

- **Cloudflare 403 / Googlebot**: diagnosed that Cloudflare's challenge (Under
  Attack / Bot Fight Mode) was 403-ing Googlebot; fixed in the CF dashboard.
- **Etsy "Connect your shop"**: `src/lib/etsy-oauth.ts` `getAppOrigin()` now
  prefers `SITE_URL`, so the OAuth `redirect_uri` is `https://rankkw.com/...`
  (matching the registered callback) instead of a baked localhost.
- **Trustpilot** one-time verification `<meta>` added via `layout.tsx` metadata.

---

## 5. Pricing (9 plans, USD)

- `src/components/landing/plans-data.ts`: **Free, Starter $0.99, Basic $2.99,
  Pro $6.99, Pro · 1-Year $89.99/yr, Business $19.99, Agency $39.99,
  Enterprise $49.99, Custom (from $49.99, 50 imgs +$10/20)**. `GROUPS` compare
  matrix stays aligned (9 cells/row). Homepage JSON-LD AggregateOffer updated.
- **Geo pricing** (PKR for Pakistan) built via `/api/geo` + `useCurrency`, then
  **paused** (`GEO_PRICING_ENABLED = false` → USD everywhere) — code/data left
  intact for a one-line re-enable.

---

## 6. Lemon Squeezy payments (LIVE)

- Config: `src/lib/plans.ts` (`PlanSlug`, `PLAN_LABELS`, `CHECKOUT_PLANS`,
  `variantIdFor`/`planForVariant`, `effectivePlan`).
- `src/lib/lemonsqueezy.ts` — `createCheckoutUrl` (POST /v1/checkouts, attaches
  `custom.user_id`+`plan`) and `verifyWebhookSignature`.
- `POST /api/lemonsqueezy/checkout` (auth'd) → full **hosted checkout page**
  (not the overlay). `POST /api/lemonsqueezy/webhook` — signature-verified; sets
  `user.plan` on subscribe/renew, downgrades to free on expiry. **Source of truth.**
- `User` model: `plan` (real slugs), `lsSubscriptionId/lsCustomerId/lsVariantId/
  subscriptionStatus/planRenewsAt`.
- Client: pricing-card CTAs → checkout (`src/lib/checkout.ts`), **spinner** holds
  through redirect, **"Log in to subscribe" modal** for logged-out visitors.

---

## 7. Plan limits enforcement + upgrade UX

- `src/lib/planLimits.ts` — per-plan limits (searches/day, Listing-Pro images/mo,
  audits/day, competitors).
- `src/lib/quota.ts` — `consumeDailySearch`, `consumeMonthlyImage` (+refund),
  reads the **effective** plan fresh from the DB. Counters on the User doc reset
  on UTC day/month.
- Enforced on **keyword search** (daily) and **Listing-Pro images** (monthly) →
  HTTP **402 `plan_limit`**.
- **Upgrade modal** (`UpgradeModal.tsx`) opened globally via `src/lib/upgrade.ts`
  (pub/sub + axios interceptor). Dashboard shows a **plan badge** (from `/api/plan`)
  + an **Upgrade** button.
- `effectivePlan()` safety net: a lapsed paid sub (past `renews_at`, non-active)
  is treated as **free** even if the webhook was missed.

---

## 8. Dashboard & tools polish

- **Etsy Listing Pro**: now **one full-resolution image** (removed 4-image grid +
  720p downscale + crop); image prompt rewritten to the "premium Etsy hero" spec;
  **cost/"Spent" UI removed** from the tool (stays in admin only).
- **Icons**: removed the coloured background chips on the tool-header icon and the
  Overview launcher tiles; enlarged the header icon ~35%.
- **Overview**: replaced the Chart.js "Buzzing" bars with a clean on-brand
  heat-bar list.
- **Find Hot Products** — rows ~40% larger, plus expansion: **2 new sorts**
  (Fastest Growing = favorite velocity, Most Engaging), **3 new columns** (Shop,
  Eng %, Favs/day), and **CSV export**. Real signals only — no fabricated sales.
- **Blog editor**: paste from Word/Docs is now cleaned (nbsp, smart quotes, tabs,
  trailing whitespace, collapsed blank lines) so spacing/alignment survives.
- **Admin users table**: bigger/clearer names + emails, row hover, professional
  colour accents (plan dot, Admin chip, verified check, **subscription-status
  pill**), plus new **Status** column and **images-this-month** tracking.
- **FAQ**: replaced with 20 new Q&As + **FAQPage JSON-LD**.

---

## ⚠️ Action items (do these on the server / dashboards)

1. **Deploy env** — set `NEXT_PUBLIC_APP_URL=https://rankkw.com` and **remove**
   `NODE_ENV=development` (it makes auth cookies non-Secure + ships a dev build),
   then redeploy. This is what makes "Connect your shop" work.
2. **Lemon Squeezy** — update the **Pro 1-Year** variant price to **$89.99** in the
   LS dashboard (the site shows $89.99, but LS is what actually charges). Ensure
   all LS env vars are set in production too.
3. **Rotate secrets** shared in chat — especially `JWT_SECRET`/`JWT_REFRESH_SECRET`
   (make them different), plus MongoDB password, SMTP password, Etsy secret,
   Resend + Lemon Squeezy keys.

## Still pending (feature requests not yet built)

- **#5** Server+client **pagination** on every tool.
- **#6** Better, more detailed **AI analysis** + presentation.
- Wire **audits/day** and **competitors** limits into their tabs (config exists).
- Optional: enrich Find Hot Products with per-listing **reviews/rating/country**
  (needs extra per-listing lookups).
- Re-enable **PKR geo pricing** if/when a PKR gateway is added.
