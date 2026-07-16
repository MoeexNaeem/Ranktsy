'use client'
import { useState, useCallback, useMemo } from 'react'
import { useTopSellers } from '@/hooks/useKeywords'
import { useAppStore } from '@/store/app'
import { BarChart } from '@/components/charts/BarChart'
import { BubbleChart } from '@/components/charts/InsightCharts'
import { Star, Toggle, ExportBtn, Popover, PopItem, toCsv, downloadCsv, slugify, ctrlBtn } from '../controls'
import { useFavorites } from '@/hooks/useFavorites'
import {
  SearchBar, Card, SectionTitle, ErrorBox, Loading, EmptyState,
  tableCard, tableHead, th, tableRow, MONO,
} from '../kit'
import { C, D, flag, formatNumber } from '@/utils'
import type { TopSeller } from '@/lib/etsy'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')


interface Col { id: string; label: string; width: string; locked?: boolean }
const ALL_COLS: Col[] = [
  { id: 'rank',    label: 'Rank',    width: '0.45fr', locked: true },
  { id: 'shop',    label: 'Shop',    width: '1.9fr',  locked: true },
  { id: 'sales',   label: 'Sales',   width: '0.85fr' },
  { id: 'reviews', label: 'Reviews', width: '0.9fr' },
  { id: 'country', label: 'Country', width: '0.7fr' },
  { id: 'opened',  label: 'Year Opened', width: '0.75fr' },
  { id: 'active',  label: 'Active Listings', width: '0.8fr' },
  { id: 'niche',   label: 'In This Niche', width: '0.75fr' },
  { id: 'faves',   label: 'Favorites', width: '0.75fr' },
  { id: 'price',   label: 'Avg Price', width: '0.7fr' },
]
const DEFAULT_HIDDEN = new Set(['faves'])

type SortKey = 'sales' | 'reviewCount' | 'reviewAverage' | 'yearOpened' | 'activeListings' | 'listings' | 'totalFaves' | 'avgPrice'

export function TopSellersTab() {
  // Seeded from the store so "See Best Sellers" on the Keyword Tool lands here
  // already scoped to the keyword the user was researching.
  const seed = useAppStore.getState().activeKeyword || 'personalized jewelry'
  const [input, setInput] = useState(seed)
  const [query, setQuery] = useState(seed)
  const [activeOnly, setActiveOnly] = useState(false)
  const [filter, setFilter] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set(DEFAULT_HIDDEN))
  const [sortKey, setSortKey] = useState<SortKey>('sales')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading, isFetching, isError } = useTopSellers(query)
  const { isFavorite, toggle } = useFavorites()

  const go = useCallback(() => { const v = input.trim(); if (v.length >= 2) setQuery(v) }, [input])

  const cols = useMemo(() => ALL_COLS.filter(c => !hidden.has(c.id)), [hidden])
  const grid = useMemo(() => `28px ${cols.map(c => c.width).join(' ')}`, [cols])

  const handleSort = useCallback((key: SortKey) => {
    setSortDir(p => (sortKey === key && p === 'desc' ? 'asc' : 'desc'))
    setSortKey(key)
  }, [sortKey])

  const view = useMemo(() => {
    let base = data ?? []
    const f = filter.trim().toLowerCase()
    if (f) base = base.filter(s => s.shop_name.toLowerCase().includes(f))
    if (activeOnly) base = base.filter(s => !s.isVacation)
    const dir = sortDir === 'desc' ? -1 : 1
    return [...base].sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      // Unknowns sort last in both directions — absent data isn't a low value.
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return dir * (av - bv)
    })
  }, [data, filter, activeOnly, sortKey, sortDir])

  const top10 = useMemo(() => view.filter(s => s.sales != null).slice(0, 10), [view])
  const cur = sym(data?.[0]?.currency)

  const bubble = useMemo(() => view.slice(0, 15).map((s, i) => ({
    x: s.totalViews, y: s.totalFaves, r: Math.max(8, Math.min(30, 7 + s.listings * 3.5)),
    label: s.shop_name, color: i < 3 ? C.orange : C.charcoal,
  })), [view])

  const totals = useMemo(() => {
    const known = view.filter(s => s.sales != null)
    return {
      shops: view.length,
      withSales: known.length,
      totalSales: known.reduce((s, x) => s + (x.sales ?? 0), 0),
      medianSales: known.length
        ? [...known].sort((a, b) => (a.sales ?? 0) - (b.sales ?? 0))[Math.floor((known.length - 1) / 2)].sales ?? 0
        : 0,
    }
  }, [view])

  const exportCsv = useCallback(() => {
    const csv = toCsv(
      ['Rank', 'Shop', 'Lifetime sales', 'Reviews', 'Rating', 'Country', 'Year opened', 'Active listings', 'Listings in niche', 'Favorites', 'Avg price', 'Currency', 'On vacation', 'Shop URL'],
      view.map((s, i) => [i + 1, s.shop_name, s.sales, s.reviewCount, s.reviewAverage, s.countryIso, s.yearOpened, s.activeListings, s.listings, s.totalFaves, s.avgPrice, s.currency, s.isVacation ? 'yes' : 'no', s.shopUrl]),
    )
    downloadCsv(`top-sellers-${slugify(query)}.csv`, csv)
  }, [view, query])

  const cell = (s: TopSeller, c: Col, i: number) => {
    switch (c.id) {
      case 'rank':
        return <span key={c.id} style={{ fontSize: 14, fontFamily: MONO, fontWeight: 600, color: i < 3 ? C.orange : C.stone }}>{i + 1}</span>
      case 'shop':
        return (
          <div key={c.id} style={{ minWidth: 0 }}>
            <a href={s.shopUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 14.5, fontWeight: 500, color: C.ink, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.orange)}
              onMouseLeave={e => (e.currentTarget.style.color = C.ink)}>
              {s.shop_name}{s.isVacation && <span style={{ fontSize: 11, color: C.stone, marginLeft: 7 }}>· on vacation</span>}
            </a>
            <p style={{ fontSize: 12, color: C.graphite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.topListing.title}</p>
          </div>
        )
      case 'sales':
        return s.sales != null
          ? <span key={c.id} style={{ fontSize: 15, fontFamily: MONO, fontWeight: 600, color: D.good }}>{formatNumber(s.sales)}</span>
          : <span key={c.id} title="Etsy didn't return this shop's record" style={{ fontSize: 14, fontFamily: MONO, color: C.stone, cursor: 'help' }}>—</span>
      case 'reviews':
        return s.reviewCount != null ? (
          <span key={c.id} style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink }}>
            {formatNumber(s.reviewCount)}
            {s.reviewAverage != null && s.reviewAverage > 0 && (
              <span style={{ color: s.reviewAverage >= 4.8 ? D.good : s.reviewAverage >= 4.5 ? D.mid : D.hard, marginLeft: 7 }}>★{s.reviewAverage.toFixed(2)}</span>
            )}
          </span>
        ) : <span key={c.id} style={{ fontSize: 14, color: C.stone }}>—</span>
      case 'country':
        return <span key={c.id} style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink }}>{s.countryIso ? `${flag(s.countryIso)} ${s.countryIso}` : '—'}</span>
      case 'opened':
        return <span key={c.id} style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink }}>{s.yearOpened ?? '—'}</span>
      case 'active':
        return <span key={c.id} style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink }}>{s.activeListings != null ? formatNumber(s.activeListings) : '—'}</span>
      case 'niche':
        return <span key={c.id} style={{ fontSize: 13.5, fontFamily: MONO, color: C.orange, fontWeight: 500 }}>{s.listings}</span>
      case 'faves':
        return <span key={c.id} style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink }}>{formatNumber(s.totalFaves)}</span>
      case 'price':
        return <span key={c.id} style={{ fontSize: 13.5, fontFamily: MONO, color: C.ink }}>{sym(s.currency)}{s.avgPrice.toFixed(2)}</span>
      default:
        return <span key={c.id} />
    }
  }

  const SORTABLE: Record<string, SortKey> = {
    sales: 'sales', reviews: 'reviewCount', opened: 'yearOpened',
    active: 'activeListings', niche: 'listings', faves: 'totalFaves', price: 'avgPrice',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <SearchBar value={input} onChange={setInput} onSubmit={go}
          placeholder="Which niche's top shops? e.g. macrame wall hanging" button="Rank shops →" />
        <p style={{ fontSize: 13, color: C.graphite, marginTop: 10, lineHeight: 1.55 }}>
          Shops ranked by <strong style={{ color: D.good }}>real lifetime sales</strong>{' '}— Etsy&apos;s own{' '}
          <code style={{ fontFamily: MONO, fontSize: 12, background: C.bone, padding: '1px 6px', borderRadius: 4 }}>transaction_sold_count</code>
          {' '}from the official API, not an engagement proxy.
        </p>
      </div>

      {isLoading && <Loading label="Ranking shops by real sales…" />}
      {isError && <ErrorBox>Couldn&apos;t load top sellers from Etsy. Please try again.</ErrorBox>}
      {data && !isLoading && data.length === 0 && <EmptyState icon="🏆" title="No shops found" sub="Try a broader keyword." />}

      {data && data.length > 0 && (
        <>
          {/* Totals */}
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { k: 'Shops found', v: formatNumber(totals.shops), c: C.ink, s: `in “${query}”` },
              { k: 'Combined sales', v: formatNumber(totals.totalSales), c: D.good, s: 'lifetime, these shops' },
              { k: 'Median shop sales', v: formatNumber(totals.medianSales), c: '#2E6DB4', s: 'typical competitor' },
              { k: 'Sales resolved', v: `${totals.withSales}/${totals.shops}`, c: totals.withSales === totals.shops ? D.good : D.mid, s: 'shop records read' },
            ].map(x => (
              <Card key={x.k} pad="18px 20px">
                <p style={{ fontSize: 11.5, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9 }}>{x.k}</p>
                <p style={{ fontSize: 28, fontWeight: 500, color: x.c, letterSpacing: '-0.03em', lineHeight: 1 }}>{x.v}</p>
                <p style={{ fontSize: 12, color: C.stone, marginTop: 6 }}>{x.s}</p>
              </Card>
            ))}
          </div>

          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{isFetching ? 'refreshing…' : 'real sales'}</span>}>
                Top shops for &ldquo;{query}&rdquo;
              </SectionTitle>
              {top10.length ? (
                <BarChart axis="y" height={300} labels={top10.map(s => s.shop_name)} values={top10.map(s => s.sales ?? 0)} highlightMax />
              ) : <EmptyState icon="🏆" title="No sales data" sub="Etsy didn't return shop records." />}
            </Card>
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>bubble = listings</span>}>Views vs favorites</SectionTitle>
              <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 10 }}>Shops toward the <strong style={{ color: C.orange }}>top-left</strong> earn the most favorites per view — the strongest buyer pull.</p>
              <BubbleChart points={bubble} xLabel="Total views" yLabel="Total favorites" />
            </Card>
          </div>

          {/* Toolbar */}
          <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.bone, padding: 10, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '10px 16px', flex: 1, minWidth: 190 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.graphite} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter shops…"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14.5, fontFamily: 'inherit', flex: 1, color: C.ink, minWidth: 0 }} />
            </div>
            <Toggle on={activeOnly} onChange={setActiveOnly} label="Show active shops only" />
            <Popover label="Columns" width={210}>
              {ALL_COLS.map(c => (
                <PopItem key={c.id} label={c.label} on={!hidden.has(c.id)} disabled={c.locked}
                  onClick={() => {
                    if (c.locked) return
                    setHidden(p => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })
                  }} />
              ))}
            </Popover>
            <ExportBtn onClick={exportCsv} />
          </div>

          {/* Etsy exposes sales per SHOP, never per listing — so sales can't be
              attributed to a niche. Stating that plainly beats letting a
              findings supplier with one matching listing read as the category king. */}
          <div style={{ display: 'flex', gap: 11, padding: '12px 16px', background: D.midBg, borderRadius: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 15, lineHeight: 1.4 }}>💡</span>
            <p style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.6 }}>
              <strong>Sales are shop-wide, not niche-specific.</strong> Etsy publishes a lifetime total per shop and
              nothing per listing, so a large generalist can top this list off one matching listing. Check the{' '}
              <strong style={{ color: C.orange }}>In This Niche</strong> column — sort by it to find shops that actually
              specialise in &ldquo;{query}&rdquo;.
            </p>
          </div>

          <div className="rtable" style={tableCard}>
            <div style={tableHead(grid)}>
              <span />
              {cols.map(c => {
                const key = SORTABLE[c.id]
                return (
                  <button key={c.id} onClick={() => key && handleSort(key)} disabled={!key}
                    style={{ ...th, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: key ? 'pointer' : 'default', padding: 0, textAlign: 'left', fontFamily: MONO }}>
                    {c.label}
                    {key && sortKey === key && <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
                  </button>
                )
              })}
            </div>
            {view.map((s, i) => (
              <div key={s.shop_id} style={{ ...tableRow(grid), transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Star on={isFavorite(s.shop_name)} onClick={() => toggle(s.shop_name)} />
                {cols.map(c => cell(s, c, i))}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
            Sales, reviews, country and open-year come from each shop&apos;s official Etsy record. Etsy publishes only a
            lifetime sales total — no historical series — so a sales-over-time trend needs day-over-day tracking, which
            starts once shop snapshots are enabled. Views/favorites are listing engagement within this niche only.
          </p>
        </>
      )}
    </div>
  )
}
