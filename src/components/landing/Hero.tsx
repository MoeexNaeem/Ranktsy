'use client'
import { useCallback, useRef } from 'react'
import { useAppStore } from '@/store/app'
import { C } from '@/utils'

function PreviewCard() {
  const bars = [40,55,45,65,50,70,85,75,90,80,95,100]
  const rows = [
    { kw: 'Silver Earrings',   searches: '12,345', ctr: '41%',  pillC: C.forest,      pillBg: 'rgba(28,58,19,0.12)' },
    { kw: 'Gold Necklace',     searches: '8,901',  ctr: '38%',  pillC: C.mutedTeal,   pillBg: 'rgba(105,142,121,0.15)' },
    { kw: 'Pendant Necklace',  searches: '6,543',  ctr: '29%',  pillC: C.mutedYellow, pillBg: 'rgba(159,153,91,0.15)' },
  ]
  return (
    <div style={{
      background: C.snow, borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 4px 40px rgba(28,58,19,0.08), 0 1px 4px rgba(0,0,0,0.04)',
      overflow: 'hidden', transform: 'perspective(1000px) rotateY(-4deg) rotateX(2deg)', maxWidth: 420,
    }}>
      {/* Title bar */}
      <div style={{ background: C.forest, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {[C.pale,'rgba(255,255,255,0.3)','rgba(255,255,255,0.3)'].map((bg,i) => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: bg, display: 'inline-block' }} />
        ))}
        <span style={{ color: 'rgba(252,252,247,0.7)', fontSize: 12, fontFamily:"'IBM Plex Mono',monospace", marginLeft: 8 }}>
          Ranksty — Keyword Analytics
        </span>
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: C.forest, fontFamily:"'IBM Plex Mono',monospace", marginBottom: 8 }}>
          Silver Necklace ⭐
        </p>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { l: 'Avg Searches', v: '35,112', c: C.forest },
            { l: 'Avg Clicks',   v: '24,380', c: C.mutedYellow },
            { l: 'Avg CTR',      v: '56.3%',  c: C.mutedTeal },
          ].map(s => (
            <div key={s.l} style={{ background: C.warmGray, borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: 10, fontFamily:"'IBM Plex Mono',monospace", color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.l}</p>
              <p style={{ fontSize: 18, fontWeight: 500, color: s.c, letterSpacing: '-0.5px' }}>{s.v}</p>
            </div>
          ))}
        </div>
        {/* Bar chart */}
        <div style={{ background: C.warmGray, borderRadius: 8, height: 80, display: 'flex', alignItems: 'flex-end', gap: 3, padding: 8, overflow: 'hidden', marginBottom: 10 }}>
          {bars.map((h,i) => (
            <div key={i} style={{ flex: 1, borderRadius: 2, height: `${h}%`, background: i >= 10 ? C.pale : C.forest, opacity: i >= 10 ? 1 : 0.7 }} />
          ))}
        </div>
        {/* Table */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 4 }}>
            {['Related Keyword','Searches','CTR'].map(h => (
              <span key={h} style={{ fontSize: 9, fontFamily:"'IBM Plex Mono',monospace", color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {rows.map((r,i) => (
            <div key={r.kw} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, padding: '6px 0', borderBottom: i < rows.length-1 ? '1px solid rgba(0,0,0,0.05)' : 'none', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#000' }}>{r.kw}</span>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 500, color: r.pillC, background: r.pillBg }}>{r.searches}</span>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 500, color: C.mutedYellow, background: 'rgba(159,153,91,0.15)' }}>{r.ctr}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  const ref  = useRef<HTMLInputElement>(null)
  const setKw = useAppStore(s => s.setActiveKeyword)
  const addR  = useAppStore(s => s.addRecentSearch)

  const go = useCallback(() => {
    const v = ref.current?.value.trim()
    if (!v || v.length < 2) return
    setKw(v); addR(v)
    document.getElementById('keywords')?.scrollIntoView({ behavior: 'smooth' })
  }, [setKw, addR])

  return (
    <section style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      padding: '120px 48px 80px', background: C.snow,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Blob */}
      <div style={{ position: 'absolute', top: -100, right: -150, width: 700, height: 700, background: C.pale, borderRadius: '50%', opacity: 0.25, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', position: 'relative', zIndex: 1 }}>
        {/* Left */}
        <div className="anim-up">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.pale, color: C.forest, fontSize: 12, fontFamily:"'IBM Plex Mono',monospace", fontWeight: 500, padding: '6px 16px', borderRadius: 999, marginBottom: 24, letterSpacing: '0.015em' }}>
            🌱 Forest &amp; Snow Laboratory
          </span>
          <h1 style={{ fontSize: 'clamp(36px,5vw,52px)', fontWeight: 300, lineHeight: 1.05, letterSpacing: '-1.5px', color: C.forest, marginBottom: 24 }}>
            Grow your Etsy shop with{' '}<strong style={{ fontWeight: 500 }}>data-driven</strong>{' '}insights
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#666', marginBottom: 40, maxWidth: 480 }}>
            Ranksty gives Etsy sellers powerful keyword research, competition analysis, and trend tracking — all in one clean, scientific dashboard.
          </p>
          {/* Search */}
          <div style={{ display: 'flex', background: C.warmGray, borderRadius: 12, overflow: 'hidden', border: '1.5px solid rgba(28,58,19,0.15)', maxWidth: 480, marginBottom: 16 }}>
            <input ref={ref} type="text" defaultValue="silver necklace" onKeyDown={e => e.key==='Enter'&&go()}
              placeholder="Search any Etsy keyword... e.g. silver necklace"
              style={{ background: 'transparent', border: 'none', padding: '14px 20px', fontSize: 15, fontFamily: 'inherit', color: '#000', outline: 'none', flex: 1 }} />
            <button onClick={go}
              style={{ background: C.forest, border: 'none', color: C.snow, padding: '14px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.2s' }}
              onMouseEnter={e=>(e.currentTarget.style.opacity='0.85')}
              onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
              Search →
            </button>
          </div>
          <p style={{ fontSize: 12, color: '#b3b3b3', fontFamily:"'IBM Plex Mono',monospace" }}>
            No credit card required · 14-day free trial · Cancel anytime
          </p>
        </div>

        {/* Right */}
        <div className="anim-up2" style={{ display: 'flex', justifyContent: 'center' }}>
          <PreviewCard />
        </div>
      </div>
    </section>
  )
}
