'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Reveal } from './Reveal'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

/* The public keyword tool used to run a LIVE Etsy/Google search on every visitor —
   burning real API quota and putting live data on an unauthenticated page. It's now
   a static product showcase: a framed screenshot of the real dashboard, no calls.
   The section keeps id="keywords" so the hero's "Try the keyword tool ↓" still lands
   here. */

// Vibrant-but-brand band behind the screenshot (Ditto-style colour frame).
const BAND = 'linear-gradient(118deg, #FB5E09 0%, #FF7A2E 20%, #F6A93B 40%, #F0907B 60%, #6FBFB6 83%, #1C5D5F 100%)'

function Chip({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span className="kw-chip rhide-sm" style={{
      position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 8,
      background: '#fff', borderRadius: 100, padding: '9px 15px', fontFamily: SANS,
      fontSize: 13, fontWeight: 500, color: C.ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
      boxShadow: '0 14px 34px rgba(61,62,59,0.18)', ...style,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.orange, flex: 'none' }} />
      {label}
    </span>
  )
}

/* Minimal browser chrome so the screenshot reads as a real product shot. */
function Frame({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 24px 60px rgba(0,0,0,0.20)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', background: '#F4F3EE', borderBottom: `1px solid ${C.cardBorder}` }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E5675B' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E9B24B' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#5BB463' }} />
        <span style={{ marginLeft: 12, flex: 1, maxWidth: 320, background: '#fff', border: `1px solid ${C.ash}`, borderRadius: 100, padding: '4px 12px', fontSize: 11.5, fontFamily: SANS, color: C.stone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          rankkw.com/dashboard/keywords
        </span>
      </div>
      <Image src={src} alt={alt} width={1800} height={923} sizes="(max-width: 900px) 92vw, 1160px" style={{ display: 'block', width: '100%', height: 'auto' }} />
    </div>
  )
}

export function KeywordTool() {
  return (
    <section id="keywords" style={{ background: C.canvas, padding: '110px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', position: 'relative' }}>

        {/* Heading */}
        <Reveal>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 46px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.ink, marginBottom: 18 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              Keyword Tool
            </div>
            <h2 style={{ fontSize: 'clamp(34px,4.6vw,56px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.05, marginBottom: 18 }}>
              See the real numbers behind any keyword
            </h2>
            <p style={{ fontSize: 'clamp(16px,1.4vw,18px)', color: C.graphite, lineHeight: 1.55, maxWidth: 560, margin: '0 auto' }}>
              Search volume, competition, KD, 12-month trends and the top-ranking listings —
              measured live from the official Etsy &amp; Google APIs. No estimates, no demo data.
            </p>
          </div>
        </Reveal>

        {/* Colour-framed product shot */}
        <Reveal delay={0.08}>
          <div className="kw-stage" style={{ position: 'relative', borderRadius: 30, padding: 'clamp(16px,3.4vw,44px)', background: BAND, boxShadow: '0 44px 100px rgba(61,62,59,0.22)' }}>
            <Frame src="/DashboardUI.webp" alt="Rankkw keyword research dashboard — search volume, competition, KD and trends" />

            {/* Floating callouts */}
            <Chip label="Real Etsy search volume" style={{ top: 26, left: -14 }} />
            <Chip label="Competition + KD score" style={{ top: '42%', right: -18 }} />
            <Chip label="12-month demand trends" style={{ bottom: 30, left: 30 }} />
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal delay={0.16}>
          <div style={{ textAlign: 'center', marginTop: 'clamp(48px, 7vw, 72px)' }}>
            <Link href="/register" style={{ display: 'inline-block', background: C.orange, color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 500, padding: '15px 30px', borderRadius: 28, letterSpacing: '-0.01em', boxShadow: '0 12px 26px rgba(251,94,9,0.28)', transition: 'opacity 0.18s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Start free — research any keyword →
            </Link>
            <p style={{ fontSize: 13.5, color: C.stone, marginTop: 14, fontFamily: SANS }}>
              Free plan · no card required · real data from your first search
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
