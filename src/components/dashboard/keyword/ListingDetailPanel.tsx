'use client'
/**
 * In-app listing detail drawer — opens when a listing row/title is clicked (the
 * ONLY link out to Etsy is the explicit "See on Etsy" button). Shows every real
 * per-listing metric plus visual meters, and the clearly-badged sales ESTIMATE.
 */
import { useEffect, useState } from 'react'
import { C, D, formatNumber } from '@/utils'
import { useFx } from '@/hooks/useFx'
import { MONO } from '../kit'
import type { EtsyListing, ListingReviewStats } from '@/types'
import type { ListingSalesEstimate } from '@/lib/salesEstimate'
import type { ShopSummary } from '@/app/api/etsy/shop-summary/route'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: '₨', INR: '₹', JPY: '¥' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? `${c} ` : '$')

export interface DetailRow {
  l: EtsyListing; rank: number; ageDays: number | null; dailyViews: number | null
  fpv: number | null; favsPerDay: number | null; price: number
}

function Stat({ label, value, accent = C.ink, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div style={{ background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 12, padding: '12px 14px' }}>
      <p style={{ fontSize: 10.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: accent, fontFamily: MONO, letterSpacing: '-0.01em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: C.stone, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

// Animated meter: fills to `pct` of the track on mount. `marker` draws a benchmark tick.
function Meter({ pct, color, marker }: { pct: number; color: string; marker?: number }) {
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(Math.max(0, Math.min(100, pct))), 60); return () => clearTimeout(t) }, [pct])
  return (
    <div style={{ position: 'relative', height: 10, background: C.bone, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 999, transition: 'width 0.8s cubic-bezier(.2,.7,.2,1)' }} />
      {marker != null && <span style={{ position: 'absolute', top: -2, bottom: -2, left: `${Math.min(100, marker)}%`, width: 2, background: C.graphite, opacity: 0.5 }} />}
    </div>
  )
}

function Group({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontFamily: MONO, fontWeight: 600, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</p>
        {right}
      </div>
      {children}
    </div>
  )
}

export function ListingDetailPanel({ row, reviewStats, estimate, onClose }: {
  row: DetailRow | null
  reviewStats?: ListingReviewStats | null
  estimate?: ListingSalesEstimate | null
  onClose: () => void
}) {
  const open = !!row
  const [copied, setCopied] = useState(false)
  const [shop, setShop] = useState<ShopSummary | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Real shop-level context (lifetime sales, reviews, rating, age) — fetched once
  // per opened listing. Reset + fetch inside a nested async fn to avoid a
  // synchronous setState in the effect body.
  useEffect(() => {
    const name = row?.l.shop_name
    if (!name) return
    let alive = true
    const run = async () => {
      setShop(null)
      try {
        const r = await fetch(`/api/etsy/shop-summary?shop=${encodeURIComponent(name)}`)
        const j = await r.json().catch(() => null)
        if (alive && r.ok && j?.success) setShop(j.data)
      } catch { /* leave shop null — the panel just omits the shop block */ }
    }
    run()
    return () => { alive = false }
  }, [row])

  const l = row?.l
  const cur = l?.price.currency_code
  // Estimated revenue shown in USD when a live rate is available (else local).
  const usdRate = useFx(cur).data?.rate ?? (cur && cur.toUpperCase() === 'USD' ? 1 : null)
  const revLocal = estimate?.estMonthlyRevenue ?? null
  const revUsd = revLocal != null && usdRate != null ? Math.round(revLocal * usdRate) : null
  const priceUsd = row && usdRate != null ? row.price * usdRate : null
  const views = l?.views ?? 0
  const favs = l?.num_favorers ?? 0
  const fpv = row?.fpv ?? null
  // Views vs favorites, drawn relative to the larger of the two.
  const maxVF = Math.max(views, favs, 1)

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,14,0.45)', zIndex: 300, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s' }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(500px, 96vw)', background: C.paper, zIndex: 301,
        boxShadow: '-20px 0 60px rgba(0,0,0,0.22)', transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.32s cubic-bezier(.2,.7,.2,1)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.ash}`, flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Listing detail {row ? `· #${row.rank}` : ''}</span>
          <button onClick={onClose} aria-label="Close" style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: C.ink, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '20px 22px 44px', flex: 1 }}>
          {l && row && (
            <>
              {/* Header */}
              <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                {l.images?.[0]?.url_75x75
                  ? <img src={l.images[0].url_75x75} alt="" style={{ width: 84, height: 84, borderRadius: 14, objectFit: 'cover', flexShrink: 0, background: C.bone }} />
                  : <div style={{ width: 84, height: 84, borderRadius: 14, background: C.bone, flexShrink: 0 }} />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.title}</p>
                  <p style={{ fontSize: 13, color: C.stone, marginTop: 4 }}>{l.shop_name}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: C.orange, fontFamily: MONO }}>{priceUsd != null ? `$${priceUsd.toFixed(2)}` : `${sym(cur)}${row.price.toFixed(2)}`}</span>
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 600, color: '#fff', background: C.orange, borderRadius: 100, padding: '9px 18px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  See on Etsy ↗
                </a>
              </div>

              {/* Real stats */}
              <Group title="Performance (real, measured data)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <Stat label="Views" value={formatNumber(views)} accent="#2E6DB4" />
                  <Stat label="Hearts" value={formatNumber(favs)} accent={D.hard} />
                  <Stat label="Favs / view" value={fpv != null ? `${fpv.toFixed(1)}%` : '—'} accent={fpv != null && fpv >= 4 ? D.good : C.ink} />
                  <Stat label="Age (days)" value={row.ageDays != null ? formatNumber(row.ageDays) : '—'} />
                  <Stat label="Views / day" value={row.dailyViews != null ? row.dailyViews.toFixed(1) : '—'} accent="#2E6DB4" />
                  <Stat label="Favs / day" value={row.favsPerDay != null ? row.favsPerDay.toFixed(2) : '—'} accent={D.hard} />
                  <Stat label="Reviews" value={reviewStats?.count != null ? formatNumber(reviewStats.count) : '—'} accent={D.good} sub="this listing (API)" />
                  <Stat label="Reviews / 30d" value={reviewStats?.last30d != null ? formatNumber(reviewStats.last30d) : '—'} accent={D.good} />
                  <Stat label="Qty" value={l.quantity != null ? formatNumber(l.quantity) : '—'} />
                  <Stat label="Tags" value={`${l.tags?.length ?? 0}/13`} />
                  <Stat label="Ships (days)" value={l.processing_min != null && l.processing_max != null ? `${l.processing_min}–${l.processing_max}` : (l.processing_min ?? l.processing_max ?? '—').toString()} />
                  <Stat label="Currency" value={cur ?? 'USD'} />
                </div>
              </Group>

              {/* Real shop-level context — reframes a low per-listing review count. */}
              {shop && (
                <Group title="Shop · real lifetime totals" right={<a href={shop.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: C.orange, textDecoration: 'none' }}>Visit shop ↗</a>}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    <Stat label="Shop sales" value={shop.sales != null ? formatNumber(shop.sales) : '—'} accent={D.good} />
                    <Stat label="Shop reviews" value={formatNumber(shop.reviewCount)} accent={D.good} />
                    <Stat label="Rating" value={shop.reviewAverage > 0 ? `${shop.reviewAverage.toFixed(1)}★` : '—'} accent="#B7791F" />
                    <Stat label="Active listings" value={formatNumber(shop.activeListings)} />
                    <Stat label="Since" value={shop.yearOpened != null ? String(shop.yearOpened) : '—'} />
                  </div>
                  <p style={{ fontSize: 11, color: C.stone, marginTop: 10, lineHeight: 1.5 }}>
                    Real, measured totals across ALL of this shop&apos;s listings — how established the seller is (not this one listing).
                  </p>
                </Group>
              )}

              {/* Visual: views vs favorites + engagement meter */}
              <Group title="Engagement">
                <div style={{ background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: C.graphite, width: 74 }}>Views</span>
                    <div style={{ flex: 1 }}><Meter pct={(views / maxVF) * 100} color="#2E6DB4" /></div>
                    <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.ink, width: 54, textAlign: 'right' }}>{formatNumber(views)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: C.graphite, width: 74 }}>Favorites</span>
                    <div style={{ flex: 1 }}><Meter pct={(favs / maxVF) * 100} color={D.hard} /></div>
                    <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.ink, width: 54, textAlign: 'right' }}>{formatNumber(favs)}</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${C.hair}`, paddingTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: C.graphite }}>Favs-per-view {fpv != null ? `(${fpv.toFixed(1)}%)` : ''}</span>
                      <span style={{ fontSize: 11, color: C.stone, fontFamily: MONO }}>4% = strong ▏</span>
                    </div>
                    {/* Scale 0–8%; benchmark tick at 4%. */}
                    <Meter pct={fpv != null ? (fpv / 8) * 100 : 0} color={fpv != null && fpv >= 4 ? D.good : D.mid} marker={50} />
                  </div>
                </div>
              </Group>

              {/* Sales estimate — clearly badged */}
              <Group title="Sales estimate" right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {estimate?.basis && <span style={{ fontSize: 9.5, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em' }}>via {estimate.basis}</span>}
                  <span style={{ fontSize: 9.5, fontFamily: MONO, fontWeight: 700, color: D.mid, background: 'rgba(224,160,40,0.14)', padding: '2px 8px', borderRadius: 100, letterSpacing: '0.05em' }}>~ ESTIMATE</span>
                </span>
              }>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <Stat label="~ Sales / mo" value={estimate?.estMonthlySales != null ? `~${formatNumber(estimate.estMonthlySales)}` : '—'} accent={D.mid} />
                  <Stat label="~ Rev / mo" value={revUsd != null ? `~$${formatNumber(revUsd)}` : (revLocal != null ? `~${sym(cur)}${formatNumber(revLocal)}` : '—')} accent={D.mid} />
                  <Stat label="~ Total sales" value={estimate?.estTotalSales != null ? `~${formatNumber(estimate.estTotalSales)}` : '—'} accent={D.mid} />
                </div>
                <p style={{ fontSize: 11, color: C.stone, marginTop: 10, lineHeight: 1.55 }}>
                  Etsy publishes no per-listing sales, so these are <strong style={{ color: D.mid }}>estimates</strong> modelled from the strongest real signal this listing has — its reviews, its views (× conversion rate), or its favorites{estimate?.monthlyIsAverage ? ', with monthly amortised over the listing&apos;s real age' : ''}. Treat as directional, not exact.
                </p>
                <p style={{ fontSize: 11, color: C.stone, marginTop: 6, lineHeight: 1.55 }}>
                  Etsy&apos;s product page can show more reviews than the per-listing API (it pools an item&apos;s reviews across the seller&apos;s relisted &amp; variant listings), which is why we also model from views &amp; favorites — so an under-reviewed but well-visited listing isn&apos;t undercounted.
                </p>
              </Group>

              {/* Tags */}
              <Group title={`Tags (${l.tags?.length ?? 0})`} right={(l.tags?.length ?? 0) > 0 ? (
                <button onClick={() => { navigator.clipboard?.writeText((l.tags ?? []).join(', ')); setCopied(true); setTimeout(() => setCopied(false), 1400) }}
                  style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 600, color: copied ? D.good : C.orange, background: copied ? D.goodBg : C.orangeFaint, border: `1px solid ${copied ? D.good : C.orange}`, borderRadius: 100, padding: '4px 12px', cursor: 'pointer' }}>
                  {copied ? '✓ Copied' : 'Copy all'}
                </button>) : undefined}>
                {(l.tags?.length ?? 0) > 0 ? (
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {(l.tags ?? []).map(t => (
                      <span key={t} onClick={() => navigator.clipboard?.writeText(t)} title="Click to copy"
                        style={{ fontSize: 12, fontFamily: MONO, color: C.ink, background: C.canvas, border: `1px solid ${C.ash}`, padding: '5px 11px', borderRadius: 100, cursor: 'pointer' }}>{t}</span>
                    ))}
                  </div>
                ) : <span style={{ fontSize: 12.5, color: C.stone }}>This listing has no tags.</span>}
              </Group>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
