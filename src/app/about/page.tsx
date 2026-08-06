import type { Metadata } from 'next'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'
import { Icon, type IconName } from '@/components/ui/Icon'
import { abs } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: 'About Rankkw — Built by Etsy sellers, for sellers',
  description: 'Rankkw is an independent Etsy keyword research and analytics platform built by sellers and engineers — real data from official APIs, never fabricated numbers.',
  alternates: { canonical: abs('/about') },
  openGraph: { title: 'About Rankkw', description: 'Built by independent Etsy sellers, on data you can actually trust.', url: abs('/about'), type: 'website' },
}

const SANS = "'General Sans',sans-serif"

/* August-style value blocks — bold solid colours (white text) alternating with
   soft pastel tiles (ink text), each with an icon chip. */
/* Curated palette used site-wide: orange (brand) + green + blue supporting hues,
   charcoal + parchment/bone neutrals. Bold value blocks cycle through it. */
const VALUES: { icon: IconName; title: string; desc: string; bg: string; fg: string; chip: string; chipIc: string }[] = [
  {
    icon: 'search',
    title: 'Radical Transparency',
    desc: 'We show real data — no inflated numbers, no misleading metrics. What you see is what actually happens on Etsy.',
    bg: C.charcoal, fg: '#fff', chip: 'rgba(255,255,255,0.14)', chipIc: '#fff',
  },
  {
    icon: 'sprout',
    title: 'Seller-First',
    desc: 'Every feature is designed for Etsy sellers, not for us. We constantly ask: does this help someone sell more?',
    bg: '#FCE7D8', fg: C.ink, chip: '#fff', chipIc: '#C2510B',
  },
  {
    icon: 'bolt',
    title: 'Speed of Insight',
    desc: 'We believe the gap between data and decision should be seconds, not hours. Speed is a feature.',
    bg: '#DEEFE4', fg: C.ink, chip: '#fff', chipIc: '#1F7A42',
  },
  {
    icon: 'handshake',
    title: 'Independent & Honest',
    desc: "We're not affiliated with Etsy. That independence lets us give you objective, unbiased market intelligence.",
    bg: C.orange, fg: '#fff', chip: 'rgba(255,255,255,0.16)', chipIc: '#fff',
  },
]

const STATS = [
  { number: 'Live', label: 'Current Stage', bg: '#FCE7D8', fg: '#C2510B' },
  { number: '2024', label: 'Founded', bg: '#DEEFE4', fg: '#1F7A42' },
  { number: '100%', label: 'Etsy API Powered', bg: '#DEE6FF', fg: '#2E44C4' },
  { number: '5', label: 'Pricing Plans', bg: C.bone, fg: C.ink },
]

const tag = (label: string, color: string = C.orange) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.1em', color, marginBottom: 18 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{label}
  </div>
)

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: C.paper, minHeight: '100vh' }}>

        {/* ── Origins — big headline left, story right (August "Origins") ── */}
        <section style={{ background: C.canvas, padding: 'clamp(140px,15vw,170px) 40px 84px', borderBottom: `1px solid ${C.hair}` }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {tag('Our Story')}
            <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 72, alignItems: 'start' }}>
              <h1 style={{ fontSize: 'clamp(38px,5vw,62px)', fontWeight: 600, letterSpacing: '-0.04em', color: C.ink, lineHeight: 1.03, margin: 0 }}>
                Built by sellers, for sellers — on data you can actually trust.
              </h1>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 6 }}>
                <p style={{ fontSize: 17, color: C.graphite, lineHeight: 1.7, margin: 0 }}>
                  Rankkw was born out of frustration. We spent years selling on Etsy, manually tracking keywords in
                  spreadsheets and guessing what buyers were searching for. There had to be a better way.
                </p>
                <p style={{ fontSize: 17, color: C.graphite, lineHeight: 1.7, margin: 0 }}>
                  So we built the tool we wished we&apos;d had — one that reads real listing data from the official Etsy
                  Open API and real demand from Google, and never invents a number to fill a gap.
                </p>
                <p style={{ fontSize: 17, color: C.graphite, lineHeight: 1.7, margin: 0 }}>
                  Today Rankkw puts professional-grade keyword intelligence in the hands of independent creators — the
                  people who make Etsy what it is.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stat cards ── */}
        <section style={{ background: C.paper, padding: '56px 40px' }}>
          <div className="rgrid-4" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 22, padding: '28px 26px' }}>
                <div style={{ fontSize: 'clamp(30px,3.4vw,44px)', fontWeight: 700, color: s.fg, letterSpacing: '-0.04em', lineHeight: 0.98, marginBottom: 8 }}>
                  {s.number}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: SANS, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.75 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Mission ── */}
        <section style={{ padding: '84px 40px', background: C.canvas }}>
          <div className="rsplit" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 72, alignItems: 'center' }}>
            <div>
              {tag('Our Mission')}
              <h2 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.08, margin: 0 }}>
                Level the playing field for every Etsy seller
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <p style={{ fontSize: 16.5, color: C.graphite, lineHeight: 1.75, margin: 0 }}>
                Big e-commerce brands have entire data science teams. Independent Etsy sellers have gut instinct and
                guesswork. We think that&apos;s unfair.
              </p>
              <p style={{ fontSize: 16.5, color: C.graphite, lineHeight: 1.75, margin: 0 }}>
                Rankkw analyzes real listing data via the official Etsy Open API so you can focus on what you do best:
                making great products. We&apos;re a small, independent team — not backed by a private-equity firm with
                misaligned incentives.
              </p>
              <p style={{ fontSize: 16.5, color: C.graphite, lineHeight: 1.75, margin: 0 }}>
                Our business grows only when our sellers grow. That alignment is exactly what keeps us honest.
              </p>
            </div>
          </div>
        </section>

        {/* ── Values — colourful bento blocks ── */}
        <section style={{ padding: '92px 40px', background: C.paper }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {tag('What we believe')}
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.06, marginBottom: 14, maxWidth: 620 }}>
              Our values aren&apos;t a wall poster
            </h2>
            <p style={{ fontSize: 16.5, color: C.graphite, lineHeight: 1.6, maxWidth: 480, marginBottom: 44 }}>
              They show up in every product decision we make.
            </p>
            <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
              {VALUES.map(v => (
                <div key={v.title} style={{ background: v.bg, borderRadius: 26, padding: '34px 34px 36px', color: v.fg, display: 'flex', flexDirection: 'column', minHeight: 210 }}>
                  <span style={{ width: 50, height: 50, borderRadius: 15, background: v.chip, display: 'grid', placeItems: 'center', marginBottom: 22 }}>
                    <Icon name={v.icon} size={24} color={v.chipIc} />
                  </span>
                  <h3 style={{ fontSize: 23, fontWeight: 600, marginBottom: 12, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{v.title}</h3>
                  <p style={{ fontSize: 15.5, lineHeight: 1.6, margin: 0, opacity: v.fg === '#fff' ? 0.92 : 0.82 }}>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How we build — bento impact grid (August "high-impact") ── */}
        <section style={{ padding: '0 40px 92px', background: C.paper }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {tag('How we work')}
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.06, marginBottom: 44, maxWidth: 700 }}>
              An independent team, building in the open
            </h2>
            <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
              {/* wide charcoal block */}
              <div style={{ background: C.charcoal, borderRadius: 28, padding: '40px 40px 42px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 300 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85 }}>Shipping weekly</span>
                <div>
                  <h3 style={{ fontSize: 'clamp(24px,2.6vw,32px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.12, marginBottom: 14 }}>
                    Improvements every week, feedback read every day.
                  </h3>
                  <p style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.9, margin: 0, maxWidth: 520 }}>
                    Rankkw is built by a small team of Etsy sellers and engineers. We&apos;re not affiliated with Etsy —
                    that independence is exactly what lets us give you objective, unbiased market intelligence.
                  </p>
                </div>
              </div>
              {/* stacked right column */}
              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 18 }}>
                <div style={{ background: '#FCE7D8', borderRadius: 28, padding: '30px 30px', color: C.ink, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 'clamp(30px,3.4vw,42px)', fontWeight: 700, color: '#C2510B', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>Zero</div>
                  <p style={{ fontSize: 15, color: C.ink, lineHeight: 1.5, margin: 0, opacity: 0.8 }}>fabricated numbers — a failed lookup shows a dash, never a fake stat.</p>
                </div>
                <div style={{ background: '#2E7D46', borderRadius: 28, padding: '30px 30px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 'clamp(30px,3.4vw,42px)', fontWeight: 700, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>2</div>
                  <p style={{ fontSize: 15, lineHeight: 1.5, margin: 0, opacity: 0.88 }}>live data sources — Etsy Open API + Google Ads Keyword Planner, on every keyword.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA — bold orange block ── */}
        <section style={{ background: C.paper, padding: '0 40px 96px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', background: C.charcoal, borderRadius: 40, padding: 'clamp(60px,7vw,84px) 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(50% 50% at 50% 50%, rgba(251,94,9,0.22), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              {tag('Get started', C.orange)}
              <h2 style={{ fontSize: 'clamp(30px,4.2vw,52px)', fontWeight: 600, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.04, marginBottom: 16 }}>
                Ready to grow your Etsy shop?
              </h2>
              <p style={{ fontSize: 18, color: 'rgba(245,245,235,0.7)', marginBottom: 36, letterSpacing: '-0.01em' }}>
                Start using real Etsy data to rank higher and sell more.
              </p>
              <div style={{ display: 'flex', gap: 22, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href="/register" style={{ background: C.orange, color: '#fff', textDecoration: 'none', padding: '15px 32px', borderRadius: 30, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', boxShadow: '0 14px 30px rgba(251,94,9,0.32)' }}>
                  Start free →
                </a>
                <a href="/contact" style={{ color: '#fff', fontSize: 16, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                  Get in touch
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
