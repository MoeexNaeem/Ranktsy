'use client'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'

const MONO = "'General Sans', monospace"

// ── What comes straight from the official Etsy Open API v3 (real, unmodified) ──
const OFFICIAL: { field: string; source: string }[] = [
  { field: 'Active listings, titles, descriptions & URLs', source: 'GET /listings/active, /listings/{id}' },
  { field: 'Listing tags', source: 'listing.tags (official)' },
  { field: 'Prices & currency', source: 'listing.price' },
  { field: 'Lifetime views & favorites', source: 'listing.views, listing.num_favorers' },
  { field: 'Product variations / options', source: 'GET /listings/{id}/inventory' },
  { field: 'Total competing listings for a term', source: 'listings/active response count' },
  { field: 'Shop name, active-listing count, admirers', source: 'GET /shops/{id}' },
  { field: 'Shop rating & review count, recent reviews', source: 'GET /shops/{id}, /shops/{id}/reviews' },
  { field: 'Shop sections', source: 'GET /shops/{id}/sections' },
  { field: 'Category taxonomy', source: 'GET /seller-taxonomy/nodes' },
  { field: 'Your own sales, orders & receipts (with your consent)', source: 'GET /shops/{id}/receipts · OAuth' },
]

// ── Metrics we DERIVE — computed FROM the real fields above, never invented ────
// Anything Etsy doesn't publish is absent from the product rather than estimated
// into existence. The list of what's missing is deliberately public: see NOT_SHOWN.
const DERIVED: { metric: string; how: string }[] = [
  { metric: 'Keyword Difficulty (KD)', how: 'A 0–100 estimate combining two real measurements: the true total of competing live listings, and how strongly the incumbents convert views into favorites. Labelled an estimate everywhere it appears.' },
  { metric: 'Favorites per view', how: 'A plain ratio of two real Etsy fields — num_favorers ÷ views — across the listings ranking for a keyword. It is a save rate, not a click-through rate; Etsy exposes no click data.' },
  { metric: 'Listings created per month', how: 'A calendar-month histogram built from each listing’s real creation timestamp. It shows when sellers list, which is not the same as when buyers search — and we say so wherever it appears.' },
  { metric: 'Trend Buzz “heat”', how: 'A 0–100 relative index over real inputs: how many sampled live listings carry a tag, weighted by those listings’ engagement. An index, never a search volume.' },
  { metric: 'Competition Low / Med / High', how: 'A band over the real count of active listings for that exact keyword, from its own live Etsy search.' },
  { metric: 'Sales velocity (units/day)', how: 'Etsy publishes only a lifetime sales total. We snapshot it daily and difference consecutive days. Before two days of history exist we show “tracking started” — never a zero.' },
]

// ── What we DON'T show, because Etsy doesn't publish it ───────────────────────
// Being explicit about the gaps is the point: a missing number is honest, a
// plausible one is not.
const NOT_SHOWN: { metric: string; why: string }[] = [
  { metric: 'Etsy search volume / “avg. searches”', why: 'The Etsy Open API exposes no search-volume data of any kind. We previously derived a figure from listing views; it is gone. Real Google search volume appears instead when Google Ads is connected.' },
  { metric: 'Clicks & click-through rate', why: 'Etsy publishes no click data for listings you don’t own. Any CTR figure would be a guess.' },
  { metric: 'Etsy search seasonality', why: 'No search history exists in the API. We show real Google monthly volume when available, and otherwise when competing listings were created — labelled as seller behaviour, not buyer demand.' },
  { metric: 'Per-listing sales', why: 'Listings expose quantity (stock on hand), never units sold. Sales are published per shop only, so they cannot be attributed to a keyword or a single listing.' },
  { metric: 'Buyer geography for other shops', why: 'Buyer country appears only on your own order receipts, under your own OAuth consent. There is no public equivalent for a competitor.' },
  { metric: 'Shop traffic & visit sources', why: 'No public endpoint exists for page visits or traffic sources.' },
  { metric: 'Processing / dispatch times', why: 'The fields exist in the API but return null on every public search result we have tested. The panel stays hidden rather than showing an empty chart.' },
]

function Badge({ children, tone }: { children: string; tone: 'api' | 'est' }) {
  const s = tone === 'api'
    ? { bg: C.orangeFaint, color: C.orange, br: 'rgba(251,94,9,0.25)' }
    : { bg: 'rgba(61,62,59,0.08)', color: C.ink, br: 'rgba(61,62,59,0.18)' }
  return (
    <span style={{ display: 'inline-block', fontSize: 10.5, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', background: s.bg, color: s.color, border: `1px solid ${s.br}`, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 52 }}>
      <h2 style={{ fontSize: 'clamp(24px,3vw,32px)', fontWeight: 500, letterSpacing: '-0.03em', color: C.ink, marginBottom: 18 }}>{title}</h2>
      {children}
    </section>
  )
}

export default function MethodologyPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: C.paper, minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ background: C.canvas, padding: '150px 40px 56px', borderBottom: `1px solid ${C.ash}` }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.09em', color: C.graphite, marginBottom: 22 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              Transparency
            </div>
            <h1 style={{ fontSize: 'clamp(40px,5.4vw,64px)', fontWeight: 500, letterSpacing: '-0.03em', color: C.ink, lineHeight: 0.98, marginBottom: 18 }}>
              Data &amp; Methodology
            </h1>
            <p style={{ fontSize: 18, color: C.graphite, lineHeight: 1.6, maxWidth: 640 }}>
              Exactly where every number comes from — what is real, unmodified Etsy data, and what we compute as an estimate.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="rpad-sm" style={{ maxWidth: 1000, margin: '0 auto', padding: '64px 40px 96px' }}>
          <p style={{ fontSize: 17, color: C.ink, lineHeight: 1.75, marginBottom: 52, borderLeft: `3px solid ${C.orange}`, paddingLeft: 20 }}>
            Rankkw uses <strong>only</strong> the official <a href="https://developers.etsy.com" target="_blank" rel="noopener noreferrer" style={{ color: C.orange, textDecoration: 'underline', textUnderlineOffset: 3 }}>Etsy Open API v3</a>.
            No scraping, no unofficial endpoints, no third-party data proxies. Some fields are shown exactly as Etsy returns them;
            other figures are <strong>estimates we derive</strong> from that data — and we always label them as such.
          </p>

          <Section title="Straight from the Etsy API">
            <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>
              These fields are returned by the official API and shown unmodified.
            </p>
            <div style={{ border: `1px solid ${C.ash}`, borderRadius: 16, overflow: 'hidden' }}>
              {OFFICIAL.map((r, i) => (
                <div key={r.field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 20px', borderBottom: i < OFFICIAL.length - 1 ? `1px solid ${C.hair}` : 'none', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Badge tone="api">Official API</Badge>
                    <span style={{ fontSize: 15, color: C.ink, fontWeight: 500 }}>{r.field}</span>
                  </div>
                  <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.stone }}>{r.source}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Metrics we compute">
            <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>
              Everything below is calculated <strong>from the real Etsy fields above</strong> — no invented coefficients,
              no modelled curves. Where a figure is an estimate rather than a measurement, it says so in the app itself.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {DERIVED.map(d => (
                <div key={d.metric} style={{ border: `1px solid ${C.ash}`, borderRadius: 16, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9 }}>
                    <Badge tone="est">Computed</Badge>
                    <span style={{ fontSize: 16.5, fontWeight: 500, color: C.ink }}>{d.metric}</span>
                  </div>
                  <p style={{ fontSize: 15, color: C.graphite, lineHeight: 1.6 }}>{d.how}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="What we deliberately don’t show">
            <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>
              Etsy publishes no search volume, no click data and no history. Rather than estimate those into existence,
              Rankkw leaves them out and tells you why. A missing number is honest; a plausible one that happens to be
              wrong is the thing that costs you money.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {NOT_SHOWN.map(d => (
                <div key={d.metric} style={{ border: `1px dashed ${C.ash}`, borderRadius: 16, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9 }}>
                    <Badge tone="est">Not shown</Badge>
                    <span style={{ fontSize: 16.5, fontWeight: 500, color: C.ink }}>{d.metric}</span>
                  </div>
                  <p style={{ fontSize: 15, color: C.graphite, lineHeight: 1.6 }}>{d.why}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Google data (optional)">
            <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.65 }}>
              When a Google Ads account is connected, real Google monthly search volume and country breakdowns come from Google&apos;s
              official Keyword Planner API — attributed to <strong>Google</strong>, never presented as Etsy data. If Google isn&apos;t connected, these fields simply don&apos;t appear.
            </p>
          </Section>

          <Section title="Freshness &amp; caching">
            <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.65 }}>
              To respect Etsy&apos;s API Terms, cached Etsy content is always refreshed well within Etsy&apos;s limits — listing-derived
              data within <strong>5 hours</strong> (Etsy&apos;s ceiling is 6h) and shop data within <strong>15 minutes</strong>. Nothing is stored longer than needed to serve a request quickly.
            </p>
          </Section>

          <Section title="Attribution">
            <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.65 }}>
              The term &ldquo;Etsy&rdquo; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  )
}
