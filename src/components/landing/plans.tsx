'use client'
import { Fragment, useEffect, useRef } from 'react'
import Link from 'next/link'
import { C } from '@/utils'
import { PLANS, GROUPS, type Plan, type Cell } from './plans-data'

const MONO = "'General Sans',monospace"

/* Filled check-circle tinted with each plan's accent colour. */
export function Check({ color, onDark }: { color: string; onDark?: boolean }) {
  return (
    <span style={{ width: 22, height: 22, flex: 'none', marginTop: 1, borderRadius: '50%', display: 'grid', placeItems: 'center', background: onDark ? 'rgba(255,255,255,0.15)' : `${color}1F` }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={onDark ? '#fff' : color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

/* Colourful, wide plan card. Its own flex sizing (grow to fill, wrap 3-then-2)
   so the parent just needs `display:flex; flex-wrap:wrap; justify-content:center`. */
export function PlanCard({ p }: { p: Plan }) {
  const dark = !!p.popular
  const a = p.accent
  const ink = dark ? '#F5F5EB' : C.ink
  const sub = dark ? 'rgba(245,245,235,0.68)' : C.graphite
  return (
    <div style={{
      flex: '0 0 340px', width: 340,
      position: 'relative', display: 'flex', flexDirection: 'column',
      background: dark ? C.charcoal : C.paper,
      border: dark ? `1px solid ${C.charcoal}` : `1px solid ${C.ash}`,
      borderRadius: 26, overflow: 'hidden',
      boxShadow: dark ? `0 34px 70px -28px ${a}88` : '0 18px 40px -28px rgba(61,62,59,0.25)',
      transform: dark ? 'translateY(-6px)' : 'none',
    }}>
      {/* accent top bar */}
      <div style={{ height: 6, background: a }} />

      <div style={{ padding: dark ? '34px 30px 30px' : '30px 30px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {p.popular && (
          <span style={{ position: 'absolute', top: 16, right: 18, background: a, color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '5px 11px', borderRadius: 100, whiteSpace: 'nowrap' }}>
            Most Popular
          </span>
        )}

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: a }} />
          <h3 style={{ fontSize: 13, fontWeight: 600, color: dark ? '#fff' : a, letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: MONO }}>
            {p.name}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 6px', marginBottom: 8 }}>
          <span style={{ fontSize: 40, fontWeight: 600, color: ink, letterSpacing: '-0.035em', lineHeight: 1 }}>{p.price}</span>
          <span style={{ fontSize: 14, color: sub }}>/ {p.period}</span>
        </div>
        <p style={{ fontSize: 14.5, color: sub, lineHeight: 1.5, marginBottom: 24, minHeight: 42 }}>{p.blurb}</p>

        <Link href={p.href}
          style={{
            display: 'block', textAlign: 'center', textDecoration: 'none',
            padding: '13px 18px', borderRadius: 100, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
            marginBottom: 26, transition: 'opacity 0.18s, background 0.18s, color 0.18s',
            background: a, color: '#fff', border: `1px solid ${a}`,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          {p.cta}
        </Link>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {p.features.map(f => (
            <li key={f} style={{ display: 'flex', gap: 11, fontSize: 14.5, color: dark ? 'rgba(245,245,235,0.92)' : C.ink, lineHeight: 1.4 }}>
              <Check color={a} onDark={dark} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* Circular scroll arrow. */
function Arrow({ dir, onClick, side }: { dir: 'prev' | 'next'; onClick: () => void; side: number }) {
  return (
    <button aria-label={dir === 'prev' ? 'Previous plans' : 'Next plans'} onClick={onClick}
      style={{ position: 'absolute', top: '50%', [dir === 'prev' ? 'left' : 'right']: side, transform: 'translateY(-50%)', zIndex: 5, width: 46, height: 46, borderRadius: '50%', border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 8px 22px rgba(61,62,59,0.14)', transition: 'background 0.15s, border-color 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = C.bone; e.currentTarget.style.borderColor = C.ink }}
      onMouseLeave={e => { e.currentTarget.style.background = C.paper; e.currentTarget.style.borderColor = C.ash }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ transform: dir === 'prev' ? 'rotate(180deg)' : 'none' }}>
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  )
}

/* Single-row, horizontally-scrollable plan cards. Opens centred on the popular
   plan (two cards each side), with arrow navigation and soft faded edges. */
export function PlanScroller({ fade }: { fade: string }) {
  const track = useRef<HTMLDivElement>(null)

  // Centre the "Most Popular" card on mount (Pro in the middle, two on each side).
  // Deferred + retried because layout width can still be 0 on the first tick.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const i = PLANS.findIndex(p => p.popular)
    let tries = 0
    const center = () => {
      const card = el.children[i] as HTMLElement | undefined
      if (card && el.clientWidth > 0 && el.scrollWidth > el.clientWidth) {
        const prev = el.style.scrollBehavior
        el.style.scrollBehavior = 'auto' // jump, don't animate, on first paint
        el.scrollLeft = Math.max(0, card.offsetLeft - (el.clientWidth - card.clientWidth) / 2)
        el.style.scrollBehavior = prev
      } else if (tries++ < 12) {
        setTimeout(center, 100)
      }
    }
    const raf = requestAnimationFrame(center)
    return () => cancelAnimationFrame(raf)
  }, [])

  const step = () => {
    const el = track.current
    const first = el?.firstElementChild as HTMLElement | undefined
    return (first?.clientWidth ?? 340) + 24
  }
  const scroll = (d: number) => track.current?.scrollBy({ left: d * step(), behavior: 'smooth' })

  return (
    <div className="plan-scroll" style={{ ['--fade' as string]: fade }}>
      <div ref={track} className="plan-track">
        {PLANS.map(p => <PlanCard key={p.name} p={p} />)}
      </div>
      <div className="plan-fade plan-fade-l" aria-hidden />
      <div className="plan-fade plan-fade-r" aria-hidden />
      <Arrow dir="prev" side={6} onClick={() => scroll(-1)} />
      <Arrow dir="next" side={6} onClick={() => scroll(1)} />
    </div>
  )
}

/* ─── Compare table (data in ./plans-data) ──────────────────────────────────── */
function CellView({ v }: { v: Cell }) {
  if (v === true) return <Check color="#2E7D46" />
  if (v === false) return <span style={{ color: C.stone, fontSize: 16 }}>—</span>
  return <span style={{ fontSize: 13.5, fontWeight: 500, color: C.ink }}>{v}</span>
}

export function ComparePlans() {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${C.ash}`, borderRadius: 20, background: C.paper }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '20px 22px', minWidth: 240, position: 'sticky', left: 0, background: C.paper, fontSize: 13, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Compare plans
            </th>
            {PLANS.map(p => (
              <th key={p.slug} style={{ padding: '18px 16px', minWidth: 128, textAlign: 'center', background: p.popular ? C.orangeFaint : C.paper, borderBottom: `1px solid ${C.ash}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: C.graphite, marginTop: 2 }}>{p.price}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map(g => (
            <Fragment key={g.group}>
              <tr>
                <td colSpan={PLANS.length + 1} style={{ padding: '18px 22px 8px', fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.08em', background: C.canvas }}>
                  {g.group}
                </td>
              </tr>
              {g.rows.map(r => (
                <tr key={r.label} style={{ borderTop: `1px solid ${C.hair}` }}>
                  <td style={{ padding: '13px 22px', fontSize: 14, color: C.ink, position: 'sticky', left: 0, background: C.paper }}>{r.label}</td>
                  {r.cells.map((v, i) => (
                    <td key={i} style={{ padding: '13px 16px', textAlign: 'center', background: PLANS[i].popular ? 'rgba(251,94,9,0.05)' : 'transparent' }}>
                      <span style={{ display: 'inline-flex', justifyContent: 'center' }}><CellView v={v} /></span>
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
