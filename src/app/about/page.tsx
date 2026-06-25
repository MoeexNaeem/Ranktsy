'use client'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'

const TEAM = [
  {
    name: 'Sarah Chen',
    role: 'Co-founder & CEO',
    bio: 'Former Etsy top-seller turned product builder. Spent 6 years running a 7-figure jewelry shop before starting Ranksty.',
    emoji: '👩‍💻',
    tag: 'Seller → Builder',
  },
  {
    name: 'James Okafor',
    role: 'Co-founder & CTO',
    bio: 'Ex-Google engineer with a passion for data infrastructure and marketplace analytics. Obsessed with making complex data feel simple.',
    emoji: '🧑‍🔬',
    tag: 'Data & Systems',
  },
  {
    name: 'Layla Reyes',
    role: 'Head of Product',
    bio: 'Product lead who spent 4 years at a major e-commerce analytics company. Brings a deep understanding of seller pain points.',
    emoji: '👩‍🎨',
    tag: 'UX & Strategy',
  },
]

const VALUES = [
  {
    icon: '🔍',
    title: 'Radical Transparency',
    desc: 'We show real data — no inflated numbers, no misleading metrics. What you see is what actually happens on Etsy.',
  },
  {
    icon: '🌱',
    title: 'Seller-First',
    desc: 'Every feature is designed for Etsy sellers, not for us. We constantly ask: does this help someone sell more?',
  },
  {
    icon: '⚡',
    title: 'Speed of Insight',
    desc: 'We believe the gap between data and decision should be seconds, not hours. Speed is a feature.',
  },
  {
    icon: '🤝',
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
      <main style={{ background: C.snow, minHeight: '100vh' }}>

        {/* ── Hero Header ── */}
        <div
          style={{
            background: C.charcoal,
            padding: '100px 48px 72px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Grid texture */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,96,8,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,96,8,0.10) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none',
            }}
          />
          {/* Glow accent */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,96,8,0.10) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: C.pale,
                marginBottom: 20,
              }}
            >
              <span style={{ width: 24, height: 1, background: C.orangeFaint, display: 'inline-block' }} />
              Our Story
            </div>
            <h1
              style={{
                fontSize: 'clamp(36px, 5vw, 60px)',
                fontWeight: 300,
                letterSpacing: '-2px',
                color: '#FFFFFF',
                lineHeight: 1.05,
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
                fontSize: 17,
                color: 'rgba(252,252,247,0.65)',
                lineHeight: 1.7,
                maxWidth: 560,
              }}
            >
              Ranksty was born out of frustration. We spent years selling on Etsy, manually tracking keywords in spreadsheets, guessing what buyers were searching for. There had to be a better way.
            </p>
          </div>
        </div>

        {/* ── Stats Strip ── */}
        <div style={{ background: C.orangeFaint, padding: '32px 48px' }}>
          <div
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
                    fontWeight: 300,
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
                    fontFamily: "'IBM Plex Mono', monospace",
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
                  fontFamily: "'IBM Plex Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: C.orange,
                  marginBottom: 16,
                }}
              >
                <span style={{ width: 24, height: 1, background: C.charcoal, display: 'inline-block' }} />
                Our Mission
              </div>
              <h2
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 40px)',
                  fontWeight: 300,
                  letterSpacing: '-1px',
                  color: C.orange,
                  lineHeight: 1.1,
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
                Ranksty puts professional-grade keyword intelligence in the hands of independent creators — the people who make Etsy what it is. We analyze real listing data via the official Etsy Open API so you can focus on what you do best: making great products.
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
        <div style={{ padding: '80px 48px', background: C.warmGray }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: C.orange,
                marginBottom: 16,
              }}
            >
              <span style={{ width: 24, height: 1, background: C.charcoal, display: 'inline-block' }} />
              What we believe
            </div>
            <h2
              style={{
                fontSize: 'clamp(28px, 3.5vw, 40px)',
                fontWeight: 300,
                letterSpacing: '-1px',
                color: C.orange,
                lineHeight: 1.1,
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              {VALUES.map((v) => (
                <div
                  key={v.title}
                  style={{
                    background: C.snow,
                    padding: '40px 36px',
                    cursor: 'default',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      background: C.orangeFaint,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      marginBottom: 20,
                    }}
                  >
                    {v.icon}
                  </div>
                  <h3
                    style={{
                      fontSize: 19,
                      fontWeight: 500,
                      color: C.orange,
                      marginBottom: 12,
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {v.title}
                  </h3>
                  <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7 }}>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Team ── */}
        <div style={{ padding: '80px 48px', background: C.snow }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: C.orange,
                marginBottom: 16,
              }}
            >
              <span style={{ width: 24, height: 1, background: C.charcoal, display: 'inline-block' }} />
              The Team
            </div>
            <h2
              style={{
                fontSize: 'clamp(28px, 3.5vw, 40px)',
                fontWeight: 300,
                letterSpacing: '-1px',
                color: C.orange,
                lineHeight: 1.1,
                marginBottom: 56,
              }}
            >
              The people behind the data
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {TEAM.map((member) => (
                <div
                  key={member.name}
                  style={{
                    background: C.warmGray,
                    padding: '40px 32px',
                    transition: 'transform 0.2s',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      background: C.charcoal,
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      marginBottom: 20,
                    }}
                  >
                    {member.emoji}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      background: C.orangeFaint,
                      color: C.orange,
                      fontSize: 10,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 500,
                      padding: '3px 10px',
                      borderRadius: 999,
                      marginBottom: 14,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {member.tag}
                  </span>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      color: C.orange,
                      marginBottom: 4,
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {member.name}
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: C.charcoalMid,
                      marginBottom: 16,
                    }}
                  >
                    {member.role}
                  </p>
                  <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7 }}>{member.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div
          style={{
            background: C.charcoal,
            padding: '80px 48px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,96,8,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,96,8,0.10) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative' }}>
            <h2
              style={{
                fontSize: 'clamp(28px, 4vw, 44px)',
                fontWeight: 300,
                color: '#FFFFFF',
                letterSpacing: '-1.5px',
                lineHeight: 1.1,
                marginBottom: 16,
              }}
            >
              Ready to grow your Etsy shop?
            </h2>
            <p
              style={{
                fontSize: 16,
                color: 'rgba(252,252,247,0.6)',
                marginBottom: 40,
              }}
            >
              Join Etsy sellers using Ranksty to rank higher and sell more.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href="/register"
                style={{
                  background: C.orangeFaint,
                  border: 'none',
                  color: C.orange,
                  padding: '14px 32px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  display: 'inline-block',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Start for free →
              </a>
              <a
                href="/contact"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(252,252,247,0.3)',
                  color: '#FFFFFF',
                  padding: '14px 32px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  display: 'inline-block',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.snow)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(252,252,247,0.3)')}
              >
                Get in touch
              </a>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </>
  )
}
