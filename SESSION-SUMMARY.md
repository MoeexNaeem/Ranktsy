# Rankkw — Session work summary

_Everything built/changed in this working session. (Kept separate from the project
`SUMMARY.md` handoff doc so that one isn't overwritten.)_

---

## 1. Landing page — new & redesigned sections

### "We connect sellers" illustration collage — `src/components/landing/ConnectSection.tsx`
- Prolific-style band beneath the Features section: a centred lockup over floating,
  browser-framed illustrations (the 4 SVGs in `src/images`) + a circular seller
  portrait, threaded by a dashed ribbon, with sparkles.
- Desktop = absolute collage; ≤980px = clean stacked card grid.
- Each piece **reveals on scroll** (staggered), with an idle float animation.

### Features section background — `src/components/landing/Sections.tsx` (`FeaturesDecor`)
- Dotted, curvy hand-drawn lines (teal `#1C5D5F` + orange + stone) plus sparkles,
  rings, plus-marks and dots to fill the empty space. Behind the cards (`z-index 0`).

### How it works — redesigned to a colour-chain + scroll scrub
- The 4 steps are one connected chain: numbered circle nodes + connecting pills,
  blended with `mix-blend-mode: multiply` (orange · teal · coral · berry).
- **Scroll-scrubbed pinned reveal**: the section pins (sticky stage in a 220vh
  track) and scroll progress reveals nodes one-by-one (01→02→03→04). Below 1024px
  the pin is off and each step shows an inline colour badge.

### Reviews — `src/components/landing/Reviews.tsx`
- August-style horizontal carousel of colourful cards (stat cards + testimonial
  cards), arrow nav, dotted background.
- ⚠️ The testimonial quotes are **placeholders** — replace with real reviews before
  relying on them (keeps the "no fabricated data" identity).

### FAQ — `src/components/landing/Faq.tsx`
- Accordion of 6 truthful Q&As about real data, shop connect, pricing, etc.

### Removed
- The old **Dashboard preview** section was removed from the homepage.

---

## 2. Navbar — monday.com-style mega-menu — `src/components/landing/Navbar.tsx`
- **Features** and **Resources** open contained, rounded mega-cards (not full-bleed)
  with a Lucide icon set, monochrome by default + single orange accent on hover.
- Polished bar: translucent blur, hover pills, outlined **Log in**, filled **Start free**.
- **Mobile drawer** (hamburger ≤900px) slide-in with the same links + CTAs, wrapped
  in a clipping layer so it never causes horizontal scroll.
- Top links now: **Features · Resources · Pricing · Blog**.

---

## 3. Keyword Tool section — static showcase — `src/components/landing/KeywordTool.tsx`
- Removed the **live Etsy/Google search** that ran on every visitor (was burning API
  quota + exposing live data unauthenticated). Now a **static product showcase**:
  a colour-framed dashboard screenshot + floating feature chips + CTA. No API calls.

---

## 4. Pricing — redesign + dedicated page
- **Cards** (`src/components/landing/plans.tsx`, data in `plans-data.ts`): wide,
  colourful per-plan accents (green/blue/orange/teal/berry), accent top bar, tinted
  check-circles, filled CTA.
- **Single-row scroller** with soft blurred/faded edges, **arrow navigation**, and it
  **opens centred on the "Pro" plan** (two cards each side).
- **`/pricing` page** (`src/app/pricing/page.tsx`): "Find your plan" hero + the card
  scroller + a full **"Compare every feature" table** (all 5 plans). Linked from
  navbar, strip, mega-menu, and the landing section's "Compare all features".
- Removed the 3-day trial callout everywhere.

---

## 5. Dashboard listing table — `src/components/dashboard/keyword/TopListingsTable.tsx`
- Used by **Keywords → Top Listings** and **Listings**.
- Column min-widths and row data sizes were tuned larger (net result after several
  passes: wider columns + bigger row fonts/thumbnail), with the KD-style sort arrows
  (faint up/down chevrons) on every sortable column. Horizontal-scrolls when needed.

---

## 6. Other dashboard features
- **Deep-linking**: `/dashboard?tab=<id>` opens a specific tool (`DashboardLayout.tsx`).
- **Description Gen → 3 versions**: `/api/ai/description` now returns 3 distinct
  descriptions; the tab has a Version 1·2·3 switcher.
- **Gemini image cost & token tracking**:
  - `geminiImage` (`src/lib/gemini.ts`) reads real `usageMetadata`, computes USD cost
    (env-tunable rates), records it via `recordImage` (`src/lib/usage.ts`).
  - Stored per-user/day on `userapiusages` (`imageCalls/imageTokens/imageCostUsd`).
  - **Admin** (`/admin`): image count · tokens · $ spent (totals, per-user, 7-day).
  - **Etsy Listing Pro** shows per-image `$` and a running session total.

---

## 7. Programmatic SEO — tool/feature pages + sitemaps
- **10 tool pages** at their own slugs (`/keyword-research`, `/competitor-analysis`,
  `/trend-analysis`, `/top-sellers`, `/find-hot-products`, `/tag-optimizer`,
  `/etsy-listing-generator`, `/ai-title-tag-generator`, `/listing-audit`,
  `/shop-analytics`). Content in `src/lib/seo/tools.ts`; rendered by
  `src/app/[tool]/page.tsx` (`dynamicParams=false` → unknown slugs 404).
- Each page: hero, What/How/Why sections, feature chips, FAQ, related tools, CTA,
  per-page metadata + canonical + **FAQPage & BreadcrumbList JSON-LD**.
- Mega-menu (desktop + drawer) now links to these pages.
- **Sitemaps** (`src/lib/seo/sitemap.ts` builders; base URL `src/lib/seo/site.ts`):
  - `/sitemap.xml` — **master index (submit this to Google)**
  - `/features-sitemap.xml`, `/pages-sitemap.xml`, `/blogs-sitemap.xml`
  - `/robots.txt` (`src/app/robots.ts`) points at the index.

---

## 8. Blog — programmatic SEO + admin CMS
- **Model**: `Blog` (`src/lib/models.ts`, `IBlog` type). Markdown content; images by
  pasted URL. Helpers in `src/lib/blog.ts` (slugify, reading-time, excerpt).
- **Public**: `/blogs` (list) + `/blogs/[slug]` (post, BlogPosting JSON-LD). Markdown
  rendered by a dependency-free renderer `src/components/blog/Markdown.tsx`
  (styled by `.blogbody` in globals). "Blog" in navbar + drawer.
- **Admin CMS** at `/admin/blogs` (`src/components/admin/BlogsAdmin.tsx`): list +
  create/edit with title→auto-slug, category, tags, cover URL, excerpt, SEO
  title/description, draft↔publish, a Markdown toolbar incl. a **🖼 Insert image**
  (between sections) and a live preview. API: `src/app/api/admin/blogs` +
  `.../[id]` (admin-gated CRUD). Linked from the admin dashboard ("✍ Manage blog").
- `/blogs-sitemap.xml` is DB-backed (published posts) and referenced by the index.
- ⚠️ Needs an admin login to author posts; can't be tested without one.

---

## 9. Technical SEO hardening (this pass)
1. **Perf**: compressed the homepage screenshot **6.4 MB PNG → 55 KB WebP**
   (`public/DashboardUI.webp`), removed the huge PNGs, and served it via `next/image`.
2. **`metadataBase`** added in `src/app/layout.tsx` so canonicals + OG image URLs
   resolve to absolute — plus improved default title/OG/Twitter tags.
3. **Default Open Graph image** — dynamic branded card at
   `src/app/opengraph-image.tsx` (`next/og`), applied site-wide as the fallback.
4. **`next/image`** for the dashboard screenshot (auto WebP/AVIF, lazy, sized).
5. **Homepage JSON-LD** (`src/app/page.tsx`): Organization + WebSite +
   SoftwareApplication (with real PKR pricing; **no fake ratings**).
6. **Footer internal links** (`Sections.tsx`): an "Etsy Tools" column linking all 10
   tool pages, plus Blog/Pricing/Fee Calculator — spreads crawl-equity everywhere.

---

## Notable decisions / caveats
- **No fabricated data** upheld throughout: placeholder reviews are flagged, no fake
  ratings/sales, SEO copy describes only what the product really does.
- Blog editor = **Markdown**, images = **pasted URLs** (per your choice); can add real
  uploads / cloud storage later.
- Gemini image cost is an **estimate** from list price — tune via
  `GEMINI_IMAGE_INPUT_USD_PER_MTOK` / `_OUTPUT_` / `_PER_IMAGE` env vars.
- **To submit to Google**: add `/sitemap.xml` in Search Console (it references the
  features/pages/blogs sub-sitemaps).

---

## Suggested next steps (SEO)
- Comparison pages (`rankkw-vs-erank`, `best-etsy-seo-tools`), a keyword
  programmatic layer (`/etsy-keywords/<kw>`), blog topic clusters, breadcrumb UI,
  GA4/Plausible + Search Console, and a link-worthy data study.
