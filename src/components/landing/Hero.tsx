'use client'
import { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

/* Scattered Etsy keyword/niche tags — position (%), variant, parallax depth */
type Tag = { label: string; l: number; t: number; ghost?: boolean; depth: number }
// Positioned to keep a clear center channel (l 20–80) for the headline/subcopy/CTA
const TAGS: Tag[] = [
  // top band (above the content)
  { label: 'wedding gifts',     l: 17, t: 11,               depth: 1.2 },
  { label: 'boho jewelry',      l: 37, t: 8,  ghost: true,  depth: 0.5 },
  { label: 'handmade candles',  l: 59, t: 9,  ghost: true,  depth: 0.6 },
  { label: 'wall art',          l: 76, t: 11,               depth: 1.3 },
  { label: 'digital planner',   l: 89, t: 19, ghost: true,  depth: 0.5 },
  { label: 'vintage poster',    l: 27, t: 16, ghost: true,  depth: 0.6 },
  // left gutter
  { label: 'custom mug',        l: 9,  t: 28,               depth: 1.4 },
  { label: 'earrings',          l: 6,  t: 41,               depth: 1.2 },
  { label: 'stickers',          l: 14, t: 40,               depth: 1.2 },
  { label: 'silver necklace',   l: 5,  t: 55, ghost: true,  depth: 0.5 },
  { label: 'nursery decor',     l: 9,  t: 69, ghost: true,  depth: 0.6 },
  { label: 'leather wallet',    l: 8,  t: 83,               depth: 1.3 },
  { label: 'home decor',        l: 15, t: 93,               depth: 1.2 },
  // right gutter
  { label: 'pet portraits',     l: 86, t: 27,               depth: 1.3 },
  { label: 'wood signs',        l: 84, t: 38, ghost: true,  depth: 0.5 },
  { label: 'resin art',         l: 92, t: 45,               depth: 1.4 },
  { label: 'macramé',           l: 84, t: 57, ghost: true,  depth: 0.6 },
  { label: 'crochet patterns',  l: 89, t: 69,               depth: 1.3 },
  { label: 'phone cases',       l: 91, t: 83, ghost: true,  depth: 0.5 },
  { label: 'gifts for her',     l: 85, t: 93, ghost: true,  depth: 0.6 },
]

function TagCard({ tag, i }: { tag: Tag; i: number }) {
  const solid: React.CSSProperties = {
    background: '#fff', color: C.ink, border: `1px solid ${C.ash}`,
    boxShadow: '0 10px 30px rgba(61,62,59,0.10)',
  }
  const ghost: React.CSSProperties = {
    background: 'rgba(255,255,255,0.5)', color: 'rgba(61,62,59,0.3)',
    border: '1px solid rgba(61,62,59,0.06)',
  }
  // Deterministic (index-based) float timing → no SSR/client hydration mismatch
  const dur = 3.6 + (i % 5) * 0.45
  const delay = ((i * 0.37) % 3).toFixed(2)
  return (
    <div className="float-outer" style={{ position: 'absolute', top: `${tag.t}%`, left: `${tag.l}%`, transform: 'translate(-50%,-50%)' }}>
      <div className="float-parallax" data-depth={tag.depth}>
        <div className="float-inner">
          <span className="float-card" style={{
            ['--dur' as string]: `${dur}s`, ['--delay' as string]: `${delay}s`,
            display: 'inline-block', whiteSpace: 'nowrap', fontFamily: SANS, fontSize: 15, fontWeight: 500,
            padding: '10px 18px', borderRadius: 14, letterSpacing: '-0.01em',
            ...(tag.ghost ? ghost : solid),
          } as React.CSSProperties}>{tag.label}</span>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  const scope = useRef<HTMLElement>(null)
  const toTool = useCallback(() => {
    document.getElementById('keywords')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let onMove: ((e: MouseEvent) => void) | null = null

    const ctx = gsap.context(() => {
      // Entrance via `from` — elements default to visible, so a killed/reverted
      // tween can never leave them stuck hidden.
      gsap.from('.float-inner', {
        opacity: 0, scale: 0.82, duration: 0.7, ease: 'power3.out',
        stagger: { amount: 0.7, from: 'random' },
      })
      gsap.from('.hero-reveal', { opacity: 0, y: 22, duration: 0.8, ease: 'power3.out', stagger: 0.08, delay: 0.1 })

      if (reduce) return

      // Mouse parallax on the dedicated parallax layer (float is CSS on the card,
      // entrance scale is on .float-inner — every transform lives on its own node).
      const par = gsap.utils.toArray<HTMLElement>('.float-parallax')
      onMove = (e: MouseEvent) => {
        const dx = (e.clientX / window.innerWidth - 0.5) * 2
        const dy = (e.clientY / window.innerHeight - 0.5) * 2
        par.forEach((el) => {
          const d = parseFloat(el.dataset.depth || '1')
          gsap.to(el, { x: dx * d * 20, y: dy * d * 20, duration: 1, ease: 'power2.out', overwrite: 'auto' })
        })
      }
      window.addEventListener('mousemove', onMove)
    }, scope)

    return () => {
      if (onMove) window.removeEventListener('mousemove', onMove)
      ctx.revert()
    }
  }, [])

  return (
    <section ref={scope} style={{ background: C.canvas, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '128px 24px 72px' }}>

      {/* Floating tag cloud */}
      <div className="hero-tags" aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 1320, pointerEvents: 'none' }}>
        {TAGS.map((t, i) => <TagCard key={t.label} tag={t} i={i} />)}
      </div>

      {/* Center content */}
      <div style={{ position: 'relative', zIndex: 5, maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <div className="hero-reveal" style={{ marginBottom: 26, display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12, fontFamily: SANS, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.16em', color: C.graphite }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
          Etsy SEO toolkit
        </div>

        <div className="rhero-lockup" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 30, flexWrap: 'wrap' }}>
          <span className="hero-reveal rhide-sm" style={{ fontSize: 'clamp(48px,7vw,86px)', fontWeight: 600, color: C.ink, letterSpacing: '-0.04em', lineHeight: 1 }}>
            R<span style={{ color: C.orange }}>:</span>
          </span>
          <div className="hero-reveal hero-box" style={{ border: `2px dashed ${C.orange}`, borderRadius: 24, padding: '8px 30px', background: 'rgba(245,245,235,0.4)' }}>
            <h1 style={{ fontSize: 'clamp(40px,7vw,86px)', fontWeight: 600, color: C.ink, letterSpacing: '-0.04em', lineHeight: 1.05, margin: 0 }}>
              Find what&apos;s ranking
            </h1>
          </div>
        </div>

        <p className="hero-reveal" style={{ fontSize: 'clamp(16px,1.4vw,19px)', lineHeight: 1.5, color: C.graphite, marginBottom: 34, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          Research the keywords, tags and competition behind top-ranking Etsy listings — real signals from the official Etsy API, in one toolkit.
        </p>

        <div className="hero-reveal" style={{ display: 'inline-flex', alignItems: 'center', gap: 30, justifyContent: 'center', flexWrap: 'wrap', background: C.canvas, borderRadius: 40, padding: '6px 6px 6px 8px' }}>
          <Link href="/register" style={{ background: C.orange, color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 500, padding: '16px 32px', borderRadius: 28, letterSpacing: '-0.01em', transition: 'opacity 0.18s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            Start free
          </Link>
          <button onClick={toTool} style={{ background: 'transparent', border: 'none', color: C.ink, fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 5, textDecorationColor: C.ash, paddingRight: 12 }}>
            Try the keyword tool ↓
          </button>
        </div>
      </div>
    </section>
  )
}
