'use client'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'
import { Icon } from '@/components/ui/Icon'

const VALUES = [
  {
    icon: 'search' as const,
    title: 'Radical Transparency',
    desc: 'We show real data — no inflated numbers, no misleading metrics. What you see is what actually happens on Etsy.',
  },
  {
    icon: 'sprout' as const,
    title: 'Seller-First',
    desc: 'Every feature is designed for Etsy sellers, not for us. We constantly ask: does this help someone sell more?',
  },
  {
    icon: 'bolt' as const,
    title: 'Speed of Insight',
    desc: 'We believe the gap between data and decision should be seconds, not hours. Speed is a feature.',
  },
  {
    icon: 'handshake' as const,
    title: 'Independent & Honest',
    desc: 'We\'re not affiliated with Etsy. That independence lets us give you objective, unbiased market intelligence.',
  },
]

const STATS = [
  { number: 'Beta', label: 'Current Stage' },
  { number: '2024', label: 'Founded' },
  { number: '100%', label: 'Etsy API Powered' },
  { number: 'Free', label: 'During Beta' },
]

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: C.paper, minHeight: '100vh' }}>

        {/* ── Hero Header ── */}
        <div
          style={{
            background: C.canvas,
            padding: '150px 40px 72px',
            position: 'relative',
            overflow: 'hidden',
            borderBottom: `1px solid ${C.hair}`,
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: "'General Sans', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: '#6E6E64',
                marginBottom: 22,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              Our Story
            </div>
            <h1
              style={{
                fontSize: 'clamp(40px, 5.4vw, 64px)',
                fontWeight: 500,
                letterSpacing: '-2px',
                color: C.ink,
                lineHeight: 1.04,
                marginBottom: 24,
                maxWidth: 700,
              }}
            >
              Built by sellers,
              <br />
              for sellers.
            </h1>
            <p
              style={{
                fontSize: 18,
                color: '#6E6E64',
                lineHeight: 1.6,
                letterSpacing: '-0.14px',
                maxWidth: 560,
              }}
            >
              Rankkw was born out of frustration. We spent years selling on Etsy, manually tracking keywords in spreadsheets, guessing what buyers were searching for. There had to be a better way.
            </p>
          </div>
        </div>

        {/* ── Stats Strip ── */}
        <div style={{ background: C.orangeFaint, padding: '32px 48px' }}>
          <div
            className="rgrid-4"
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0,
            }}
          >
            {STATS.map((s, i) => (
              <div
                key={s.label}
                style={{
                  textAlign: 'center',
                  padding: '16px 24px',
                  borderRight: i < STATS.length - 1 ? `1px solid rgba(60,60,60,0.15)` : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 'clamp(24px, 3vw, 36px)',
                    fontWeight: 500,
                    color: C.orange,
                    letterSpacing: '-1.5px',
                    marginBottom: 4,
                  }}
                >
                  {s.number}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "'General Sans', monospace",
                    color: C.charcoalMid,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mission ── */}
        <div style={{ padding: '80px 48px', background: C.snow }}>
          <div
            className="rsplit"
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: '1fr 1.4fr',
              gap: 80,
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  fontFamily: "'General Sans', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: C.orange,
                  marginBottom: 16,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
                Our Mission
              </div>
              <h2
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 40px)',
                  fontWeight: 500,
                  letterSpacing: '-1.2px',
                  color: C.ink,
                  lineHeight: 1.08,
                }}
              >
                Level the playing field for every Etsy seller
              </h2>
            </div>
            <div>
              <p
                style={{
                  fontSize: 16,
                  color: '#444',
                  lineHeight: 1.8,
                  marginBottom: 20,
                }}
              >
                Big e-commerce brands have entire data science teams. Independent Etsy sellers have gut instinct and guesswork. We think that's unfair.
              </p>
              <p
                style={{
                  fontSize: 16,
                  color: '#444',
                  lineHeight: 1.8,
                  marginBottom: 20,
                }}
              >
                Rankkw puts professional-grade keyword intelligence in the hands of independent creators — the people who make Etsy what it is. We analyze real listing data via the official Etsy Open API so you can focus on what you do best: making great products.
              </p>
              <p
                style={{
                  fontSize: 16,
                  color: '#444',
                  lineHeight: 1.8,
                }}
              >
                We're a small, independent team. We're not backed by a private equity firm with misaligned incentives. Our business grows when our sellers grow — and that keeps us honest.
              </p>
            </div>
          </div>
        </div>

        {/* ── Values ── */}
        <div style={{ padding: '96px 40px', background: C.bone }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: "'General Sans', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: '#6E6E64',
                marginBottom: 18,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              What we believe
            </div>
            <h2
              style={{
                fontSize: 'clamp(28px, 3.5vw, 40px)',
                fontWeight: 500,
                letterSpacing: '-1.2px',
                color: C.ink,
                lineHeight: 1.08,
                marginBottom: 16,
              }}
            >
              Our values aren't a wall poster
            </h2>
            <p
              style={{
                fontSize: 16,
                color: '#666',
                lineHeight: 1.6,
                maxWidth: 480,
                marginBottom: 56,
              }}
            >
              They show up in every product decision we make.
            </p>
            <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {VALUES.map((v) => (
                <div
                  key={v.title}
                  style={{
                    background: C.paper,
                    border: `1px solid ${C.hairInk}`,
                    borderRadius: 24,
                    padding: '34px 32px',
                    cursor: 'default',
                    transition: 'transform 0.18s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                >
                  <Icon name={v.icon} size={24} color={C.ink} style={{ marginBottom: 18 }} />
                  <h3
                    style={{
                      fontSize: 21,
                      fontWeight: 500,
                      color: C.ink,
                      marginBottom: 10,
                      letterSpacing: '-0.4px',
                    }}
                  >
                    {v.title}
                  </h3>
                  <p style={{ fontSize: 15, color: '#6E6E64', lineHeight: 1.6, letterSpacing: '-0.1px' }}>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Team ── */}
        <div style={{ padding: '96px 40px', background: C.paper }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: "'General Sans', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: '#6E6E64',
                marginBottom: 18,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              The Team
            </div>
            <h2
              style={{
                fontSize: 'clamp(30px, 4vw, 46px)',
                fontWeight: 500,
                letterSpacing: '-1.2px',
                color: C.ink,
                lineHeight: 1.08,
                marginBottom: 40,
                maxWidth: 760,
              }}
            >
              An independent team, building in the open.
            </h2>
            <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, maxWidth: 900 }}>
              <p style={{ fontSize: 16, color: '#6E6E64', lineHeight: 1.7, letterSpacing: '-0.1px' }}>
                Rankkw is built by a small, independent team of Etsy sellers and engineers. We&apos;re not backed by a
                private-equity firm with misaligned incentives, and we&apos;re not affiliated with Etsy — that independence
                is exactly what lets us give you objective, unbiased market intelligence.
              </p>
              <p style={{ fontSize: 16, color: '#6E6E64', lineHeight: 1.7, letterSpacing: '-0.1px' }}>
                We&apos;re in beta and building in the open — shipping improvements every week and reading every piece of
                feedback. Our business grows only when our sellers grow, and that keeps us honest.
              </p>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ background: C.canvas, padding: '40px 40px 96px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ background: C.charcoal, border: `1px solid ${C.hairInk}`, borderRadius: 40, padding: '72px 48px', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 20, fontSize: 11.5, fontFamily: "'General Sans',monospace", fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(252,252,247,0.6)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
                Get started
              </div>
              <h2 style={{ fontSize: 'clamp(32px, 4.4vw, 52px)', fontWeight: 500, color: '#FFFFFF', letterSpacing: '-0.03em', lineHeight: 1.02, marginBottom: 18 }}>
                Ready to grow your Etsy shop?
              </h2>
              <p style={{ fontSize: 18, color: 'rgba(252,252,247,0.6)', marginBottom: 40, letterSpacing: '-0.14px' }}>
                Start using real Etsy data to rank higher and sell more.
              </p>
              <div style={{ display: 'flex', gap: 26, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href="/register" style={{ background: C.orange, color: '#fff', textDecoration: 'none', padding: '15px 32px', borderRadius: 28, fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em', transition: 'opacity 0.18s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                  Start free
                </a>
                <a href="/contact" style={{ color: '#fff', fontSize: 16, fontWeight: 400, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                  Get in touch
                </a>
              </div>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </>
  )
}
