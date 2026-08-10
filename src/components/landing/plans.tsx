'use client'
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { C } from '@/utils'
import { CHECKOUT_PLANS } from '@/lib/plans'
import { startCheckout } from '@/lib/checkout'
import { PLANS, GROUPS, priceOf, noteOf, type Plan, type Cell, type Currency } from './plans-data'
// NOTE: Plan now also carries optional `expandableHeading` / `expandableFootnote`
// fields alongside `expandable` — see plans-data.ts. No separate import needed,
// they come through on the Plan objects themselves.

const MONO = "'General Sans',monospace"

/* ── "Log in to subscribe" prompt for logged-out visitors ─────────────────────
   Tiny local pub/sub: a checkout button calls promptLoginRequired(); the modal
   (mounted once inside PlanScroller) shows itself. */
let loginPromptCb: (() => void) | null = null
function promptLoginRequired() { loginPromptCb?.() }

function LoginRequiredModal() {
  const [open, setOpen] = useState(false)
  useEffect(() => { loginPromptCb = () => setOpen(true); return () => { loginPromptCb = null } }, [])
  if (!open) return null
  const back = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : '/pricing'
  const btn = (bg: string, color: string, border: string): CSSProperties => ({
    display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px 18px', borderRadius: 100,
    fontSize: 15, fontWeight: 600, background: bg, color, border, fontFamily: 'inherit',
  })
  return (
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(20,20,20,0.55)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ background: C.paper, borderRadius: 24, maxWidth: 400, width: '100%', padding: '32px 30px 26px', boxShadow: '0 34px 80px rgba(0,0,0,0.34)', textAlign: 'center', position: 'relative' }}>
        <button onClick={() => setOpen(false)} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: 'none', background: C.bone, color: C.graphite, cursor: 'pointer', fontSize: 16 }}>×</button>
        <span style={{ display: 'inline-grid', placeItems: 'center', width: 52, height: 52, borderRadius: 15, background: C.orangeFaint, marginBottom: 16 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </span>
        <h2 style={{ fontSize: 21, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em', marginBottom: 8 }}>Log in to subscribe</h2>
        <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.6, marginBottom: 22 }}>
          You need a Rankkw account to buy a plan. Log in or create one — it only takes a moment, then you can complete checkout.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href={`/login?redirect=${back}`} style={btn(C.orange, '#fff', `1px solid ${C.orange}`)}>Log in</Link>
          <Link href={`/register?redirect=${back}`} style={btn(C.paper, C.ink, `1px solid ${C.ash}`)}>Create an account</Link>
        </div>
      </div>
    </div>
  )
}

/* Plan CTA: a Lemon Squeezy checkout button for paid plans; a plain link for
   Free (register) and Custom (contact). */
function CheckoutCTA({ p }: { p: Plan }) {
  const [loading, setLoading] = useState(false)
  const a = p.accent
  const style: CSSProperties = {
    display: 'block', width: '100%', textAlign: 'center', textDecoration: 'none',
    padding: '13px 18px', borderRadius: 100, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
    marginBottom: 26, transition: 'opacity 0.18s', background: a, color: '#fff', border: `1px solid ${a}`,
    cursor: 'pointer', fontFamily: 'inherit',
  }
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => { if (!loading) e.currentTarget.style.opacity = '0.88' }
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.opacity = '1' }

  if (!(CHECKOUT_PLANS as string[]).includes(p.slug)) {
    return <Link href={p.href} style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{p.cta}</Link>
  }
  return (
    <button type="button" disabled={loading} style={{ ...style, opacity: loading ? 0.85 : 1, cursor: loading ? 'default' : 'pointer' }}
      onMouseEnter={hoverIn} onMouseLeave={hoverOut}
      onClick={async () => {
        setLoading(true)
        const r = await startCheckout(p.slug)
        // On success we're navigating to checkout — KEEP the spinner. Only stop it
        // if we need a login prompt or the request failed.
        if (r === 'needs_login') { setLoading(false); promptLoginRequired() }
        else if (r === 'error') setLoading(false)
      }}>
      {loading ? <span className="rk-spinner" role="status" aria-label="Loading" /> : p.cta}
    </button>
  )
}

/* Geo pricing (PKR for Pakistan) is PAUSED — show USD to every country for now.
   Flip GEO_PRICING_ENABLED back to true to re-enable it; the /api/geo route and
   the PKR overrides in plans-data are left intact so it's a one-line switch. */
const GEO_PRICING_ENABLED = false

let cachedCurrency: Currency | null = null
export function useCurrency(): Currency {
  const [cur, setCur] = useState<Currency>('USD')
  useEffect(() => {
    if (!GEO_PRICING_ENABLED) return
    if (cachedCurrency) { setCur(cachedCurrency); return }
    let alive = true
    fetch('/api/geo').then(r => r.json()).then((d: { currency?: string }) => {
      cachedCurrency = d.currency === 'PKR' ? 'PKR' : 'USD'
      if (alive) setCur(cachedCurrency)
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return cur
}

/* Small note under the plan grid: "Prices in USD." / "Prices in PKR (Rs)." */
export function PriceNote() {
  const cur = useCurrency()
  return <>Prices in {cur === 'PKR' ? 'PKR (Rs)' : 'USD'}.</>
}

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
   so the parent just needs `display:flex; flex-wrap:wrap; justify-content:center`.
   Plans that define `expandable` (currently Pro · 1-Year) get a small toggle
   arrow beneath the regular feature list that reveals extra bonus bullets. */
export function PlanCard({ p, cur }: { p: Plan; cur: Currency }) {
  const dark = !!p.popular
  const a = p.accent
  const ink = dark ? '#F5F5EB' : C.ink
  const sub = dark ? 'rgba(245,245,235,0.68)' : C.graphite
  const price = priceOf(p, cur)
  const note = noteOf(p, cur)

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

        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 6px', marginBottom: note ? 4 : 8 }}>
          <span style={{ fontSize: 40, fontWeight: 600, color: ink, letterSpacing: '-0.035em', lineHeight: 1 }}>{price}</span>
          <span style={{ fontSize: 14, color: sub }}>/ {p.period}</span>
        </div>
        {note && <p style={{ fontSize: 12.5, fontWeight: 600, color: a, marginBottom: 8 }}>{note}</p>}
        <p style={{ fontSize: 14.5, color: sub, lineHeight: 1.5, marginBottom: 24, minHeight: 42 }}>{p.blurb}</p>

        <CheckoutCTA p={p} />

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {p.features.map(f => (
            <li key={f} style={{ display: 'flex', gap: 11, fontSize: 14.5, color: dark ? 'rgba(245,245,235,0.92)' : C.ink, lineHeight: 1.4 }}>
              <Check color={a} onDark={dark} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* Bonus details — always visible (no toggle) when the plan defines `expandable` */}
        {p.expandable && p.expandable.length > 0 && (
          <div style={{
            marginTop: 18, paddingTop: 16,
            borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : C.hair}`,
          }}>
            <p style={{
              fontSize: 12.5, fontWeight: 700, color: dark ? '#fff' : a, textTransform: 'uppercase',
              letterSpacing: '0.06em', lineHeight: 1.4, marginBottom: 12,
            }}>
              What&apos;s included this year
            </p>
            {p.expandableHeading && (
              <p style={{
                fontSize: 12.5, fontWeight: 700, color: a, textTransform: 'uppercase',
                letterSpacing: '0.04em', lineHeight: 1.4, marginBottom: 12,
              }}>
                {p.expandableHeading}
              </p>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {p.expandable.map(f => (
                <li key={f} style={{ display: 'flex', gap: 11, fontSize: 14, color: dark ? 'rgba(245,245,235,0.92)' : C.ink, lineHeight: 1.4 }}>
                  <Check color={a} onDark={dark} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {p.expandableFootnote && (
              <p style={{ fontSize: 12.5, fontWeight: 600, color: a, marginTop: 14, lineHeight: 1.5 }}>
                {p.expandableFootnote}
              </p>
            )}
          </div>
        )}
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
  const cur = useCurrency()

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
      {/* align-items: flex-start overrides the CSS class's default (stretch),
          which was forcing every card to grow to match the tallest card
          whenever the Pro · 1-Year card's "bonus details" were expanded. */}
      <div ref={track} className="plan-track" style={{ display: 'flex', alignItems: 'flex-start' }}>
        {PLANS.map(p => <PlanCard key={p.name} p={p} cur={cur} />)}
      </div>
      <div className="plan-fade plan-fade-l" aria-hidden />
      <div className="plan-fade plan-fade-r" aria-hidden />
      <Arrow dir="prev" side={6} onClick={() => scroll(-1)} />
      <Arrow dir="next" side={6} onClick={() => scroll(1)} />
      <LoginRequiredModal />
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
  const cur = useCurrency()
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
                <div style={{ fontSize: 12.5, color: C.graphite, marginTop: 2 }}>{priceOf(p, cur)}</div>
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