'use client'
import { useCallback } from 'react'
import Link from 'next/link'
import { C } from '@/utils'
import { Entrance, RevealGroup, RevealItem } from './Reveal'

const MONO = "'IBM Plex Mono',monospace"

/* Micro-label with leading dot — Huddle's primary wayfinding device */
function MicroLabel({ children, color = '#3a4444' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.09em', color }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
      {children}
    </span>
  )
}

/* Flat category card — hairline border, no shadow (Huddle project-card) */
function FeedCard({ label, title, tags, fill }: { label: string; title: string; tags: string[]; fill: string }) {
  return (
    <div style={{ background: fill, border: `1px solid ${C.hairInk}`, borderRadius: 8, padding: 22 }}>
      <div style={{ marginBottom: 12 }}><MicroLabel>{label}</MicroLabel></div>
      <p style={{ fontSize: 20, fontWeight: 500, color: C.ink, lineHeight: 1.22, letterSpacing: '-0.4px', marginBottom: 16 }}>{title}</p>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {tags.map(t => (
          <span key={t} style={{ fontSize: 12, fontFamily: MONO, color: C.orange, border: `1px solid ${C.orange}`, padding: '3px 11px', borderRadius: 100, background: 'transparent' }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

export function Hero() {
  const toTool = useCallback(() => {
    document.getElementById('keywords')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <section style={{ background: C.canvas, padding: '150px 40px 96px' }}>
      <div className="rsplit" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.08fr 1fr', gap: 72, alignItems: 'start' }}>

        {/* ── Left: editorial headline ─────────────────────────── */}
        <Entrance style={{ paddingTop: 8 }}>
          <div style={{ marginBottom: 28 }}><MicroLabel color={C.ink}>Etsy SEO Toolkit</MicroLabel></div>

          <h1 style={{ fontSize: 'clamp(42px,5.4vw,64px)', fontWeight: 300, lineHeight: 1.06, letterSpacing: '-1.6px', color: C.ink, marginBottom: 26 }}>
            Grow your Etsy shop with <span style={{ color: C.orange }}>data-driven</span> insights.
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.5, letterSpacing: '-0.14px', color: '#3a4444', marginBottom: 36, maxWidth: 460 }}>
            Keyword research, competition analysis, trend tracking and a fee calculator — the complete Etsy toolkit, built on the official Etsy API.
          </p>

          {/* CTA row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginBottom: 34 }}>
            <Link href="/register" style={{ background: C.orange, color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 500, padding: '15px 30px', borderRadius: 1000, letterSpacing: '-0.01em', transition: 'opacity 0.18s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Start free
            </Link>
            <button onClick={toTool} style={{ background: 'transparent', border: 'none', color: C.ink, fontSize: 16, fontWeight: 400, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 4 }}>
              Try the keyword tool ↓
            </button>
          </div>

          {/* Honest trust row — micro-labels, no invented metrics */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px' }}>
            {['No credit card', 'Free during beta', 'Official Etsy API'].map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontFamily: MONO, color: '#808080' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {t}
              </span>
            ))}
          </div>
        </Entrance>

        {/* ── Right: flat card feed ────────────────────────────── */}
        <RevealGroup style={{ display: 'flex', flexDirection: 'column', gap: 14 }} delayChildren={0.12} stagger={0.1}>
          <RevealItem><FeedCard fill={C.softOrange} label="Keyword Research"
            title="Find low-competition keywords buyers actually search."
            tags={['searches', 'CTR', 'competition']} /></RevealItem>
          <RevealItem><FeedCard fill={C.bone} label="Competition"
            title="See exactly what the top-ranking listings use to win."
            tags={['views', 'favorites', 'tags']} /></RevealItem>
          <RevealItem><FeedCard fill={C.paper} label="Fee Calculator"
            title="Know your profit and break-even before you list."
            tags={['fees', 'margin', 'break-even']} /></RevealItem>
        </RevealGroup>
      </div>
    </section>
  )
}
