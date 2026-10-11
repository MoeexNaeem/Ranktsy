'use client'
/**
 * Find Hot Products, browse mode: the product database.
 *
 * eHunt-style research table over every listing Rankkw tracks: search by words,
 * listing id/URL or shop URL, filter by category, price, sales, revenue,
 * favorites, reviews, product type, Etsy labels and release time, and sort by
 * 7-day gains. Gains are MEASURED from our own daily tracking. Sales are measured
 * from stock drops when we saw them (green), otherwise a review-based estimate
 * (amber, "~"); totals and revenue are always estimates. Never a number we
 * cannot back.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import axios from 'axios'
import { Icon } from '@/components/ui/Icon'
import { C, D, ACCENT, withAlpha, formatNumber } from '@/utils'
import { SearchBar, Card, SectionTitle, ErrorBox, Loading, EmptyState, Pagination, MONO } from '../kit'
import { SaveButtons } from './SaveButtons'
import { useSaved, useToggleSaved } from './useSaved'
import type { ApiResponse, DbProduct, DbProductsResponse, HotProduct } from '@/types'

const HUE = ACCENT.rose

const SORTS: { id: string; label: string }[] = [
  { id: 'sales7', label: '7-day sales' },
  { id: 'bought', label: 'Bought in 24h (Etsy)' },
  { id: 'rev7', label: '7-day revenue' },
  { id: 'f7', label: '7-day favorites' },
  { id: 'r7', label: '7-day reviews' },
  { id: 'v7', label: '7-day views' },
  { id: 'sales30', label: '30-day sales' },
  { id: 'hot', label: 'Hot Score' },
  { id: 'newest', label: 'Newest listed' },
  { id: 'favs', label: 'Total favorites' },
  { id: 'reviews', label: 'Total reviews' },
  { id: 'views', label: 'Total views' },
  { id: 'price_low', label: 'Price: low to high' },
  { id: 'price_high', label: 'Price: high to low' },
]
const RELEASE = [{ id: '30', label: '30 Days' }, { id: '180', label: '180 Days' }, { id: '365', label: '1 Year' }, { id: '', label: 'All Time' }]
const TYPES = [{ id: 'handmade', label: 'Handmade' }, { id: 'vintage', label: 'Vintage' }, { id: 'physical', label: 'Physical' }, { id: 'digital', label: 'Digital' }, { id: 'personal', label: 'Personalizable' }]
const LABELS = [
  { id: 'bestseller', label: 'Bestseller' }, { id: 'pick', label: "Etsy's Pick" },
  { id: 'popular', label: 'Popular now' }, { id: 'starseller', label: 'Star Seller' },
]

/** One range dropdown: rows of [label, field, presets]. Values are "min~max". */
interface RangeRow { label: string; field: string; presets: [number, number | null][] }
const RANGES: { id: string; label: string; rows: RangeRow[] }[] = [
  { id: 'price', label: 'Price (USD)', rows: [{ label: 'Price', field: 'priceUsd', presets: [[0, 10], [10, 30], [30, 100], [100, null]] }] },
  { id: 'sales', label: 'Sales', rows: [
    { label: '7-day sales', field: 'sales7', presets: [[0, 10], [11, 30], [31, 200], [201, null]] },
    { label: 'Total sales', field: 'salesTotal', presets: [[0, 100], [101, 1000], [1001, 10000], [10001, null]] },
  ] },
  { id: 'revenue', label: 'Revenue', rows: [
    { label: '7-day revenue', field: 'rev7', presets: [[0, 100], [101, 300], [301, 2000], [2001, null]] },
  ] },
  { id: 'favs', label: 'Favorites', rows: [
    { label: '7-day favorites', field: 'f7', presets: [[0, 10], [11, 50], [51, 200], [201, null]] },
    { label: 'Total favorites', field: 'favs', presets: [[0, 100], [101, 1000], [1001, 10000], [10001, null]] },
  ] },
  { id: 'reviews', label: 'Reviews', rows: [
    { label: '7-day reviews', field: 'r7', presets: [[0, 5], [6, 20], [21, 100], [101, null]] },
    { label: 'Total reviews', field: 'reviews', presets: [[0, 50], [51, 500], [501, 5000], [5001, null]] },
  ] },
]

interface Filters {
  q: string; ex: string; batch: string; cat: string; ship: string; type: string[]; labels: string[]
  freeShip: boolean; onSale: boolean; release: string; from: string; to: string
  rng: Record<string, string>
}
const EMPTY: Filters = { q: '', ex: '', batch: '', cat: '', ship: '', type: [], labels: [], freeShip: false, onSale: false, release: '', from: '', to: '', rng: {} }

const ctrl: React.CSSProperties = { background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 10, padding: '8px 12px', fontSize: 13.5, fontFamily: 'inherit', color: C.ink, outline: 'none' }
const lbl: React.CSSProperties = { fontSize: 11, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 74 }
const pill = (on: boolean): React.CSSProperties => ({ fontSize: 13, fontFamily: 'inherit', padding: '6px 13px', borderRadius: 100, cursor: 'pointer', background: on ? withAlpha(HUE, 0.12) : 'transparent', color: on ? HUE : C.graphite, border: `1px solid ${on ? HUE : C.ash}` })
const money = (n: number) => (n >= 1000 ? `$${formatNumber(n)}` : `$${Math.round(n * 100) / 100}`)
const fmtDate = (ts?: number | null) => ts ? new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const rangeText = (v?: string) => {
  if (!v) return ''
  const [lo, hi] = v.split('~')
  return hi ? `${lo || 0}-${hi}` : `${lo}+`
}

function RangeMenu({ def, value, onApply }: { def: typeof RANGES[number]; value: Record<string, string>; onApply: (next: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const active = def.rows.filter(r => value[r.field])
  const set = (field: string, lo: string, hi: string) => setDraft(d => ({ ...d, [field]: lo || hi ? `${lo}~${hi}` : '' }))
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setDraft(Object.fromEntries(def.rows.map(r => [r.field, value[r.field] ?? '']))); setOpen(o => !o) }}
        style={{ ...ctrl, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, borderColor: active.length ? HUE : C.ash, color: active.length ? HUE : C.ink }}>
        {def.label}{active.length ? `: ${active.map(r => rangeText(value[r.field])).join(', ')}` : ''} <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', padding: 14, width: 'min(440px, 86vw)' }}>
          {def.rows.map(r => {
            const [lo = '', hi = ''] = (draft[r.field] ?? '').split('~')
            return (
              <div key={r.field} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12.5, color: C.graphite, marginBottom: 7 }}>{r.label}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => set(r.field, '', '')} style={pill(!lo && !hi)}>All</button>
                  {r.presets.map(([a, b]) => {
                    const on = lo === String(a) && hi === (b == null ? '' : String(b))
                    return <button key={`${a}-${b}`} onClick={() => set(r.field, String(a), b == null ? '' : String(b))} style={pill(on)}>{b == null ? `${formatNumber(a)}+` : `${formatNumber(a)}-${formatNumber(b)}`}</button>
                  })}
                  <input value={lo} onChange={e => set(r.field, e.target.value.replace(/[^\d.]/g, ''), hi)} placeholder="Min" inputMode="decimal" style={{ ...ctrl, width: 70, padding: '6px 9px' }} />
                  <span style={{ color: C.stone }}>~</span>
                  <input value={hi} onChange={e => set(r.field, lo, e.target.value.replace(/[^\d.]/g, ''))} placeholder="Max" inputMode="decimal" style={{ ...ctrl, width: 70, padding: '6px 9px' }} />
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <button onClick={() => { const n = { ...value }; for (const r of def.rows) delete n[r.field]; onApply(n); setOpen(false) }} style={{ ...ctrl, cursor: 'pointer', border: 'none', color: C.graphite }}>Reset</button>
            <button onClick={() => { const n = { ...value }; for (const r of def.rows) { if (draft[r.field]) n[r.field] = draft[r.field]; else delete n[r.field] } onApply(n); setOpen(false) }}
              style={{ background: HUE, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5 }}>OK</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** The green "+N in 7 days" chip. Estimates carry "~" and amber. */
function Gain({ v, est, money: isMoney }: { v: number | null; est?: boolean; money?: boolean }) {
  if (v == null) return <span style={{ fontSize: 11.5, color: C.stone }} title="Not enough tracked history yet for a 7-day figure">no 7d data</span>
  const color = est ? D.mid : D.good
  return (
    <span title={est ? 'Estimate for the last 7 days, from reviews gained' : 'Measured over the last 7 days from our daily tracking'}
      style={{ display: 'inline-block', fontSize: 12, fontFamily: MONO, fontWeight: 600, color, background: withAlpha(color, 0.12), borderRadius: 6, padding: '2px 7px', marginTop: 4 }}>
      ↑{est ? '~' : ''}{isMoney ? money(v) : formatNumber(v)}
    </span>
  )
}

function Cell({ total, totalEst, gain, gainEst, isMoney }: { total: number | null; totalEst?: boolean; gain: number | null; gainEst?: boolean; isMoney?: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 15, fontFamily: MONO, color: total == null ? C.stone : totalEst ? D.mid : C.ink }}>
        {total == null ? '-' : `${totalEst ? '~' : ''}${isMoney ? money(total) : formatNumber(total)}`}
      </div>
      <Gain v={gain} est={gainEst} money={isMoney} />
    </div>
  )
}

/** HotProduct shape for the shared detail view. */
export function dbToHot(p: DbProduct): HotProduct {
  const ageDays = p.created ? Math.max(1, (Date.now() - p.created * 1000) / 86_400_000) : null
  return {
    listing_id: p.listingId, title: p.title, url: p.url, image: p.image,
    price: p.priceUsd ?? p.price, currency: p.priceUsd != null ? 'USD' : (p.cur ?? 'USD'),
    views: p.views ?? 0, favorites: p.favs ?? 0, engagementPct: p.eng ?? 0,
    favPerDay: ageDays && p.favs != null ? parseFloat((p.favs / ageDays).toFixed(2)) : null,
    hotScore: p.hot, tags: p.tags, shopName: p.shopName ?? '', createdTimestamp: p.created, quantity: p.qty ?? 0,
  }
}

function exportCsv(rows: DbProduct[]) {
  const header = ['Listing ID', 'Title', 'Shop', 'Category', 'Price (USD)', 'Original price', 'Released', 'Total sales (est.)', '7-day sales', '7-day sales basis', 'Total revenue USD (est.)', '7-day revenue USD', 'Reviews', '7-day reviews', 'Favorites', '7-day favorites', 'Views', '7-day views', 'Stock', 'Best rank (7d)', 'Badges', 'URL']
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map(p => [
    p.listingId, p.title, p.shopName, p.cat, p.priceUsd ?? '', p.priceOrig ?? '', fmtDate(p.created),
    p.salesTotal ?? '', p.sales7 ?? '', p.sales7 == null ? '' : p.salesEst ? 'estimate (reviews)' : 'measured (stock)',
    p.salesTotal != null && p.priceUsd != null ? Math.round(p.salesTotal * p.priceUsd) : '', p.rev7 ?? '',
    p.reviews ?? '', p.r7 ?? '', p.favs ?? '', p.f7 ?? '', p.views ?? '', p.v7 ?? '', p.qty ?? '', p.bestRank ?? '', p.badges.join(' | '), p.url,
  ].map(q).join(','))
  const url = URL.createObjectURL(new Blob(['﻿' + [header.map(q).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'rankkw-product-database.csv'; a.click()
  URL.revokeObjectURL(url)
}

const GRID = 'minmax(330px,2.6fr) repeat(5, minmax(96px,1fr)) 96px'

export function ProductDatabase({ onOpen }: { onOpen: (p: HotProduct) => void }) {
  const [draft, setDraft] = useState<Filters>(EMPTY)
  const [applied, setApplied] = useState<Filters | null>(null)
  const [sort, setSort] = useState('sales7')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [showEx, setShowEx] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [filterName, setFilterName] = useState('')
  const savedFilters = useSaved('filter')
  const toggleSaved = useToggleSaved()

  const params = useMemo(() => {
    if (!applied) return null
    const p = new URLSearchParams({ sort, page: String(page), meta: '1' })
    if (applied.q) p.set('q', applied.q)
    if (applied.ex) p.set('ex', applied.ex)
    if (applied.batch) p.set('batch', applied.batch)
    if (applied.cat) p.set('cat', applied.cat)
    if (applied.ship) p.set('ship', applied.ship)
    if (applied.type.length) p.set('type', applied.type.join(','))
    if (applied.labels.length) p.set('labels', applied.labels.join(','))
    if (applied.freeShip) p.set('freeShip', '1')
    if (applied.onSale) p.set('onSale', '1')
    if (applied.release) p.set('release', applied.release)
    else { if (applied.from) p.set('from', applied.from); if (applied.to) p.set('to', applied.to) }
    for (const [k, v] of Object.entries(applied.rng)) if (v) p.set(`rng_${k}`, v)
    return p.toString()
  }, [applied, sort, page])

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['hot-db', params],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get<ApiResponse<DbProductsResponse>>(`/api/etsy/hot-products/db?${params}`, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
    enabled: !!params,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 10,
    retry: false,
  })

  // Filters apply at once (they are free refinements); words apply on Search.
  const applyNow = useCallback((next: Filters) => { setDraft(next); setApplied(next); setPage(1) }, [])
  const patch = useCallback((p: Partial<Filters>) => applyNow({ ...draft, ...p }), [draft, applyNow])
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const products = data?.products ?? []
  const pageCount = data ? Math.max(1, Math.ceil(Math.min(data.total, data.cap) / data.pageSize)) : 1
  const cats = data?.categories ?? []
  const countries = data?.countries ?? []
  const errMsg = (error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error

  const headSort = (id: string) => () => { setSort(id); setPage(1) }
  const heads: { label: string; sub: string; id?: string }[] = [
    { label: 'Product', sub: '' },
    { label: 'Sales', sub: '7-day', id: 'sales7' },
    { label: 'Revenue', sub: '7-day', id: 'rev7' },
    { label: 'Reviews', sub: '7-day', id: 'r7' },
    { label: 'Favorites', sub: '7-day', id: 'f7' },
    { label: 'Views', sub: '7-day', id: 'v7' },
    { label: '', sub: '' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card pad="18px">
        <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>{data?.updatedAt ? `updated ${new Date(data.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'tracked data'}</span>}>Product Database</SectionTitle>
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.55, marginTop: -8, marginBottom: 14 }}>
          Every listing Rankkw tracks, with what it gained in the <strong style={{ color: C.ink }}>last 7 days</strong>, measured from our daily tracking.
          {' '}<span style={{ color: D.good, fontWeight: 600 }}>Green</span> = measured. <span style={{ color: D.mid, fontWeight: 600 }}>~ Amber</span> = estimate (Etsy publishes no per-listing sales).
          Filters and sorting are free: only a new search uses a credit.
        </p>
        <SearchBar value={draft.q} onChange={q => setDraft(d => ({ ...d, q }))} onSubmit={() => applyNow({ ...draft, q: draft.q.trim(), batch: '' })}
          placeholder="Product name, listing ID, listing URL or shop URL" button="Search →" maxWidth={640}
          control={<>
            <button onClick={() => setShowEx(s => !s)} style={{ ...ctrl, borderRadius: 100, cursor: 'pointer', color: draft.ex ? HUE : C.graphite, borderColor: draft.ex ? HUE : C.ash }}>{draft.ex ? `Excluding ${draft.ex.split(',').filter(Boolean).length}` : 'Exclude'}</button>
            <button onClick={() => setShowBatch(s => !s)} style={{ ...ctrl, borderRadius: 100, cursor: 'pointer', color: draft.batch ? HUE : C.graphite, borderColor: draft.batch ? HUE : C.ash }}>{draft.batch ? `Batch: ${draft.batch.split('\n').filter(Boolean).length}` : 'Batch search'}</button>
          </>} />
        {showBatch && (
          <div style={{ marginTop: 10 }}>
            <textarea value={draft.batch} onChange={e => setDraft(d => ({ ...d, batch: e.target.value.split('\n').slice(0, 20).join('\n') }))} rows={5}
              placeholder={'Up to 20, one per line: listing IDs, listing URLs, shop URLs or keywords'}
              style={{ ...ctrl, width: '100%', borderRadius: 12, resize: 'vertical', fontFamily: MONO, fontSize: 12.5 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.stone }}>{draft.batch.split('\n').filter(x => x.trim()).length}/20</span>
              <button onClick={() => applyNow({ ...draft, q: '' })} disabled={!draft.batch.trim()} style={{ background: HUE, color: '#fff', border: 'none', borderRadius: 100, padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>Search all</button>
              {draft.batch && <button onClick={() => applyNow({ ...draft, batch: '' })} style={{ ...ctrl, border: 'none', cursor: 'pointer', color: C.graphite }}>Clear batch</button>}
            </div>
          </div>
        )}
        {showEx && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input value={draft.ex} onChange={e => setDraft(d => ({ ...d, ex: e.target.value }))} onKeyDown={e => e.key === 'Enter' && applyNow(draft)}
              placeholder="Words to leave out, separated by commas (e.g. svg, digital, png)" style={{ ...ctrl, flex: 1, minWidth: 240, borderRadius: 100 }} />
            <button onClick={() => applyNow(draft)} style={{ background: HUE, color: '#fff', border: 'none', borderRadius: 100, padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>Apply</button>
          </div>
        )}
      </Card>

      <Card pad="14px 18px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={lbl}>Basic</span>
            <select value={draft.cat} onChange={e => patch({ cat: e.target.value })} style={{ ...ctrl, cursor: 'pointer', maxWidth: 220, borderColor: draft.cat ? HUE : C.ash }}>
              <option value="">All categories</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {RANGES.slice(0, 3).map(r => <RangeMenu key={r.id} def={r} value={draft.rng} onApply={rng => patch({ rng })} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={lbl}>Advanced</span>
            <select value={draft.ship} onChange={e => patch({ ship: e.target.value })} style={{ ...ctrl, cursor: 'pointer', maxWidth: 200, borderColor: draft.ship ? HUE : C.ash }} aria-label="Ships from">
              <option value="">Ships from: any</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {RANGES.slice(3).map(r => <RangeMenu key={r.id} def={r} value={draft.rng} onApply={rng => patch({ rng })} />)}
            {TYPES.map(t => <button key={t.id} onClick={() => patch({ type: toggle(draft.type, t.id) })} style={pill(draft.type.includes(t.id))}>{t.label}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={lbl}>Labels</span>
            {LABELS.map(l => <button key={l.id} onClick={() => patch({ labels: toggle(draft.labels, l.id) })} style={pill(draft.labels.includes(l.id))}>{l.label}</button>)}
            <button onClick={() => patch({ freeShip: !draft.freeShip })} style={pill(draft.freeShip)}>Free shipping</button>
            <button onClick={() => patch({ onSale: !draft.onSale })} style={pill(draft.onSale)}>On sale</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={lbl}>Released</span>
            {RELEASE.map(r => <button key={r.id} onClick={() => patch({ release: r.id, from: '', to: '' })} style={pill(draft.release === r.id && !(r.id === '' && (draft.from || draft.to)))}>{r.label}</button>)}
            <input type="date" value={draft.from} onChange={e => patch({ from: e.target.value, release: '' })} style={{ ...ctrl, padding: '6px 9px' }} aria-label="Released from" />
            <span style={{ color: C.stone }}>~</span>
            <input type="date" value={draft.to} onChange={e => patch({ to: e.target.value, release: '' })} style={{ ...ctrl, padding: '6px 9px' }} aria-label="Released until" />
            <select value="" onChange={e => { const f = (savedFilters.data ?? []).find(x => x.key === e.target.value); if (f?.params) { try { applyNow({ ...EMPTY, ...JSON.parse(f.params) as Partial<Filters> }) } catch { /* ignore a bad saved filter */ } } }}
              style={{ ...ctrl, cursor: 'pointer', marginLeft: 'auto' }} aria-label="Saved filters">
              <option value="">Saved filters ({(savedFilters.data ?? []).length})</option>
              {(savedFilters.data ?? []).map(f => <option key={f.key} value={f.key}>{f.key}</option>)}
            </select>
            {applied && JSON.stringify(applied) !== JSON.stringify(EMPTY) && (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Name these filters" style={{ ...ctrl, width: 150, padding: '6px 10px' }} />
                <button onClick={() => { if (filterName.trim()) { toggleSaved.mutate({ kind: 'filter', on: true, name: filterName.trim(), params: JSON.stringify(applied) }); setFilterName('') } }}
                  disabled={!filterName.trim()} style={{ ...ctrl, cursor: 'pointer', color: HUE, borderColor: HUE }}>Save</button>
              </span>
            )}
            {applied && JSON.stringify(applied) !== JSON.stringify(EMPTY) && (
              <button onClick={() => applyNow(EMPTY)} style={{ ...ctrl, border: 'none', cursor: 'pointer', color: C.graphite }}>Clear all</button>
            )}
          </div>
        </div>
      </Card>

      {!applied && (
        <Card>
          <EmptyState icon="🔥" title="See what is selling right now" sub="Browse every product we track, ranked by measured 7-day sales, or search above. Nothing loads until you ask, so no credits are used until you do." />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <button onClick={() => applyNow(draft)} style={{ background: HUE, color: '#fff', border: 'none', borderRadius: 100, padding: '11px 24px', fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Show top products this week</button>
          </div>
        </Card>
      )}
      {isError && <ErrorBox>{errMsg ?? 'Could not load the product database. Try again in a moment.'}</ErrorBox>}
      {applied && isLoading && <Loading label="Loading products…" />}

      {data && (
        <>
          <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13.5, color: C.graphite }}>
              Found <strong style={{ color: C.ink }}>{formatNumber(data.total)}{data.total >= data.cap ? '+' : ''}</strong> products
              {data.total > data.cap ? `, showing the first ${formatNumber(data.cap)}` : ''} · {formatNumber(data.dbSize)} in the database
              {isFetching && <span style={{ color: C.stone, marginLeft: 8 }}>· loading…</span>}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select value={sort} onChange={e => { setSort(e.target.value); setPage(1) }} style={{ ...ctrl, borderRadius: 100, cursor: 'pointer' }}>
                {SORTS.map(s => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 4, background: C.bone, padding: 4, borderRadius: 100 }}>
                {(['list', 'grid'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} title={`${v} view`}
                    style={{ padding: '6px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12.5, fontFamily: MONO, background: view === v ? C.paper : 'transparent', color: view === v ? C.ink : C.graphite }}>
                    {v === 'list' ? '☰' : '▦'}
                  </button>
                ))}
              </div>
              <button onClick={() => exportCsv(products)} disabled={!products.length}
                style={{ ...ctrl, borderRadius: 100, cursor: products.length ? 'pointer' : 'default', opacity: products.length ? 1 : 0.5, fontFamily: MONO, fontSize: 12.5 }}>↓ Export CSV</button>
            </div>
          </div>

          {data.updatedAt == null && (
            <p style={{ fontSize: 12.5, color: '#8A5A00', background: '#FFF7E6', border: '1px solid #F2D8A7', borderRadius: 8, padding: '8px 12px' }}>
              The product database is being built for the first time. Products appear here within the hour, and 7-day figures fill in as tracking history builds up.
            </p>
          )}

          {products.length === 0 ? (
            <Card><EmptyState icon="🔍" title="No products match" sub="Try fewer filters, or search Etsy live with the Live search tab above." /></Card>
          ) : view === 'list' ? (
            <Card pad={0} style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 980, opacity: isFetching ? 0.65 : 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '13px 18px', background: C.headerBg, borderBottom: `1px solid ${C.ash}` }}>
                  {heads.map((h, i) => (
                    <button key={h.label || i} onClick={h.id ? headSort(h.id) : undefined} disabled={!h.id}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: h.id ? 'pointer' : 'default', textAlign: i === 0 ? 'left' : 'right', fontFamily: 'inherit' }}>
                      <span style={{ display: 'block', fontSize: 12, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: h.id && sort === h.id ? HUE : C.graphite }}>{h.label}{h.id && sort === h.id ? ' ↓' : ''}</span>
                      {h.sub && <span style={{ fontSize: 10.5, color: C.stone }}>({h.sub})</span>}
                    </button>
                  ))}
                </div>
                {products.map(p => {
                  const totalRev = p.salesTotal != null && p.priceUsd != null ? Math.round(p.salesTotal * p.priceUsd) : null
                  return (
                    <div key={p.listingId} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '14px 18px', borderBottom: `1px solid ${C.hair}`, alignItems: 'center' }}>
                      <button onClick={() => onOpen(dbToHot(p))} style={{ display: 'flex', gap: 13, alignItems: 'center', minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        {p.image ? <img src={p.image} alt="" style={{ width: 78, height: 78, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.hair}` }} />
                          : <div style={{ width: 78, height: 78, borderRadius: 10, background: C.bone, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={22} color={C.stone} /></div>}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 14.5, fontWeight: 500, color: C.ink, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.title || `Listing ${p.listingId}`}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                            {p.badges.map(b => <span key={b} style={{ fontSize: 10.5, color: HUE, background: withAlpha(HUE, 0.1), borderRadius: 5, padding: '1px 6px' }}>{b}</span>)}
                            {p.shopName && <span style={{ fontSize: 10.5, color: C.graphite, background: C.bone, borderRadius: 5, padding: '1px 6px' }}>{p.shopName}</span>}
                            {p.cat && <span style={{ fontSize: 10.5, color: C.graphite, background: C.bone, borderRadius: 5, padding: '1px 6px' }}>{p.cat}</span>}
                            {p.freeShip && <span style={{ fontSize: 10.5, color: D.good, background: withAlpha(D.good, 0.1), borderRadius: 5, padding: '1px 6px' }}>Free shipping</span>}
                            {p.ship && <span style={{ fontSize: 10.5, color: C.graphite, background: C.bone, borderRadius: 5, padding: '1px 6px' }}>{p.ship}</span>}
                            {p.bought24h != null && p.bought24h > 0 && <span title={`Etsy showed this on ${p.boughtDay}`} style={{ fontSize: 10.5, fontWeight: 600, color: D.good, background: withAlpha(D.good, 0.12), borderRadius: 5, padding: '1px 6px' }}>{formatNumber(p.bought24h)}+ bought in 24h</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 5 }}>
                            {p.priceUsd != null ? <span style={{ fontSize: 15, fontFamily: MONO, fontWeight: 600, color: HUE }}>{money(p.priceUsd)}</span>
                              : p.price != null ? <span style={{ fontSize: 15, fontFamily: MONO, fontWeight: 600, color: HUE }}>{p.price} {p.cur}</span> : null}
                            {p.onSale && p.priceOrig != null && p.price != null && p.priceOrig > p.price && <span style={{ fontSize: 12, color: C.stone, textDecoration: 'line-through' }}>{Math.round(p.priceOrig * 100) / 100} {p.cur}</span>}
                            <span style={{ fontSize: 11.5, color: C.stone }}>Released {fmtDate(p.created)}</span>
                          </div>
                        </div>
                      </button>
                      <Cell total={p.salesTotal} totalEst gain={p.sales7} gainEst={p.salesEst} />
                      <Cell total={totalRev} totalEst gain={p.rev7} gainEst isMoney />
                      <Cell total={p.reviews} gain={p.r7} />
                      <Cell total={p.favs} gain={p.f7} />
                      <Cell total={p.views} gain={p.v7} />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        <SaveButtons listingId={p.listingId} title={p.title} image={p.image} />
                        <a href={p.url} target="_blank" rel="noopener noreferrer" title="Open on Etsy" style={{ color: HUE, display: 'flex' }}><Icon name="link" size={17} color={HUE} /></a>
                        <button onClick={() => onOpen(dbToHot(p))} title="Product details" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}><Icon name="chart" size={17} color={HUE} /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : (
            <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, opacity: isFetching ? 0.65 : 1 }}>
              {products.map(p => (
                <button key={p.listingId} onClick={() => onOpen(dbToHot(p))}
                  style={{ display: 'block', textAlign: 'left', background: C.paper, border: `1px solid ${C.hair}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  <div style={{ position: 'relative', height: 160, background: C.bone }}>
                    {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={26} color={C.stone} /></div>}
                    {p.badges[0] && <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, color: '#fff', background: withAlpha(HUE, 0.95), padding: '3px 9px', borderRadius: 100 }}>{p.badges[0]}</span>}
                  </div>
                  <div style={{ padding: '11px 13px' }}>
                    <p style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: 34 }}>{p.title}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 12, fontFamily: MONO }}>
                      <span style={{ color: HUE, fontWeight: 600, fontSize: 13 }}>{p.priceUsd != null ? money(p.priceUsd) : '-'}</span>
                      <span style={{ color: p.sales7 == null ? C.stone : p.salesEst ? D.mid : D.good }}>{p.sales7 == null ? 'no 7d data' : `${p.salesEst ? '~' : ''}${formatNumber(p.sales7)} sold/7d`}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11.5, fontFamily: MONO, color: C.graphite }}>
                      <span>♥ {formatNumber(p.favs ?? 0)}{p.f7 != null ? ` (+${formatNumber(p.f7)})` : ''}</span>
                      <span>★ {formatNumber(p.reviews ?? 0)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <Pagination page={page} pageCount={pageCount} onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} loading={isFetching} />

          <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
            7-day figures are measured: what each listing gained between our daily readings, scaled to exactly 7 days. &ldquo;no 7d data&rdquo; means we have not tracked it long enough yet.
            Sales are units that left the listing's stock when we saw it (one order can be several units; stock cuts bigger than the views gained are ignored as seller edits); otherwise they are an estimate from reviews gained (amber, ~). Total sales and revenue are always estimates.
          </p>
        </>
      )}
    </div>
  )
}
