'use client'
import { useState, useCallback, useMemo } from 'react'
import { useKeywordSearch, useTrends } from '@/hooks/useKeywords'
import { useAppStore }     from '@/store/app'
import { KeywordTable }    from '../KeywordTable'
import { TrendChart }      from '@/components/charts/TrendChart'
import { CountryChart }    from '@/components/charts/CountryChart'
import { BarChart }        from '@/components/charts/BarChart'
import { OpportunityScatter, MixDonut } from '@/components/charts/InsightCharts'
import { PlatformToggle }  from '../PlatformToggle'
import { Card, SearchBar, StatCard, SectionTitle, ErrorBox, Loading, EmptyState, MONO } from '../kit'
import { C, formatNumber, formatPercent } from '@/utils'
import type { TrendPlatform, KeywordStats, EtsyListing } from '@/types'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')

function Skel({ h = 82 }: { h?: number }) {
  return <div className="shimmer" style={{ height: h, background: '#e8e7e2', borderRadius: 10 }} />
}

// ── Keyword difficulty panel (replaces the empty country box; Etsy has no ──────
// per-keyword buyer geography). Honest, derivable enterprise metric.
function DifficultyPanel({ s }: { s: KeywordStats }) {
  const color = s.difficulty < 34 ? C.warn : s.difficulty < 67 ? C.orange : C.danger
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.hair}` }}>
      <span style={{ fontSize: 14, color: C.graphite }}>{k}</span>
      <span style={{ fontSize: 15, fontFamily: MONO, fontWeight: 500, color: C.ink }}>{v}</span>
    </div>
  )
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 52, fontWeight: 500, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.difficulty}</span>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color, textTransform: 'uppercase', fontFamily: MONO, letterSpacing: '0.04em' }}>{s.difficultyLabel}</span>
          <p style={{ fontSize: 13, color: C.graphite }}>to rank · estimate</p>
        </div>
      </div>
      <div style={{ height: 10, background: C.bone, borderRadius: 999, overflow: 'hidden', margin: '16px 0 16px' }}>
        <div style={{ height: '100%', width: `${s.difficulty}%`, background: color, borderRadius: 999, transition: 'width 0.6s' }} />
      </div>
      <Row k="Competing listings" v={formatNumber(s.totalResults)} />
      <Row k="Median price" v={`${sym(s.currency)}${s.avgPrice.toFixed(0)}`} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
        <span style={{ fontSize: 14, color: C.graphite }}>Avg. favorites</span>
        <span style={{ fontSize: 15, fontFamily: MONO, fontWeight: 500, color: C.ink }}>{formatNumber(s.avgFavorites)}</span>
      </div>
    </div>
  )
}

function SnapRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: last ? 'none' : `1px solid ${C.hair}` }}>
      <span style={{ fontSize: 14, color: C.graphite }}>{k}</span>
      <span style={{ fontSize: 15.5, fontWeight: 500, fontFamily: MONO, color: C.ink }}>{v}</span>
    </div>
  )
}

// ── Top listings grid (the "Top Listings" sub-tab) ────────────────────────────
function ListingsGrid({ listings }: { listings: EtsyListing[] }) {
  if (!listings.length) return <EmptyState icon="🔎" title="No listings" sub="Try another keyword." />
  return (
    <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
      {listings.slice(0, 12).map(l => {
        const price = l.price.amount / (l.price.divisor || 100)
        return (
          <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textDecoration: 'none', border: `1px solid ${C.hair}`, borderRadius: 8, overflow: 'hidden', background: C.paper, transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.orange)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.hair)}>
            {l.images?.[0]?.url_570xN ? <img src={l.images[0].url_570xN} alt={l.title} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', height: 130, background: C.bone }} />}
            <div style={{ padding: '9px 11px' }}>
              <p style={{ fontSize: 11.5, color: C.ink, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 6 }}>{l.title}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontFamily: MONO, color: '#8a8a82' }}>
                <span style={{ color: C.orange, fontWeight: 500 }}>{sym(l.price.currency_code)}{price.toFixed(0)}</span>
                <span>{formatNumber(l.views)}👁 · {formatNumber(l.num_favorers)}♥</span>
              </div>
            </div>
          </a>
        )
      })}
    </div>
  )
}

export function KeywordsTab() {
  const [input, setInput] = useState('silver necklace')
  const [query, setQuery] = useState('silver necklace')
  const [plats, setPlats] = useState<TrendPlatform[]>(['etsy', 'google'])
  const [sub, setSub]     = useState<'ideas' | 'listings'>('ideas')
  const addR = useAppStore(s => s.addRecentSearch)

  const { data: kw, isLoading, isError } = useKeywordSearch(query)
  const { data: tr } = useTrends(query)

  const search = useCallback(() => {
    const q = input.trim(); if (q.length < 2) return
    setQuery(q); addR(q)
  }, [input, addR])

  const stats = useMemo(() => {
    if (!kw) return null
    const { avgSearches, avgClicks, avgCtr, totalResults, difficulty } = kw.stats
    const compColor = difficulty < 34 ? C.warn : difficulty < 67 ? C.orange : C.danger
    return [
      { label: 'Avg. Searches', value: formatNumber(avgSearches), sub: 'per month · est.', pct: Math.min((avgSearches / 80000) * 100, 100), color: C.ink },
      { label: 'Avg. Clicks',   value: formatNumber(avgClicks),   sub: 'per month · est.', pct: Math.min((avgClicks / 60000) * 100, 100),   color: C.orange },
      { label: 'Avg. CTR',      value: formatPercent(avgCtr),     sub: 'click-through',    pct: avgCtr,                                      color: C.ink },
      { label: 'Competition',   value: formatNumber(totalResults),sub: 'live listings',    pct: difficulty,                                color: compColor },
    ]
  }, [kw])

  // ── eRank-style insights from real API data (related keywords + top listings) ──
  const insights = useMemo(() => {
    if (!kw) return null
    const pts = kw.related
      .filter(r => (r.avgSearches ?? 0) > 0)
      .map(r => ({
        x: r.avgSearches as number, y: r.difficulty, label: r.keyword,
        color: r.difficulty < 34 ? C.orange : r.difficulty < 67 ? C.warn : C.danger,
      }))
    const mix = { Low: 0, Med: 0, High: 0 } as Record<'Low' | 'Med' | 'High', number>
    kw.related.forEach(r => { mix[r.competitionLevel]++ })
    const compMix = [
      { label: 'Low', value: mix.Low, color: C.ink },
      { label: 'Med', value: mix.Med, color: C.warn },
      { label: 'High', value: mix.High, color: C.danger },
    ]
    const tagMap = new Map<string, number>()
    kw.listings.forEach(l => (l.tags ?? []).forEach(t => tagMap.set(t, (tagMap.get(t) ?? 0) + 1)))
    const tags = [...tagMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    const prices = kw.listings.map(l => l.price.amount / (l.price.divisor || 100)).filter(p => p > 0).sort((a, b) => a - b)
    const views = kw.listings.map(l => l.views).filter(v => v >= 0)
    const favs = kw.listings.map(l => l.num_favorers).filter(v => v >= 0)
    const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
    const snapshot = {
      priceLow: prices[0] ?? 0, priceHigh: prices[prices.length - 1] ?? 0,
      priceMed: prices[Math.floor(prices.length / 2)] ?? 0,
      avgViews: avg(views), avgFavs: avg(favs), sample: kw.listings.length, cur: sym(kw.stats.currency),
    }
    return { pts, compMix, tags, snapshot }
  }, [kw])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={search} placeholder="Search any Etsy keyword…" />

      {/* Stats */}
      <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {isLoading || !stats
          ? [0, 1, 2, 3].map(i => <Skel key={i} />)
          : stats.map(s => <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} accent={s.color} pct={s.pct} />)}
      </div>

      {/* Charts + difficulty */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, alignItems: 'start' }}>
        <Card>
          <SectionTitle right={tr ? <PlatformToggle active={plats} onChange={setPlats} /> : undefined}>Search Trend (12 months)</SectionTitle>
          {tr ? <TrendChart data={tr.trends} activePlatforms={plats} /> : <Skel h={112} />}
        </Card>
        <Card>
          <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: '#b0b0a8' }}>KD</span>}>Keyword Difficulty</SectionTitle>
          {kw ? <DifficultyPanel s={kw.stats} /> : <Skel h={112} />}
        </Card>
      </div>

      {/* eRank-style insights — Opportunity Matrix + Competition Mix */}
      {insights && !isLoading && (
        <>
          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 12, alignItems: 'start' }}>
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{insights.pts.length} keywords</span>}>Opportunity Matrix</SectionTitle>
              <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 10 }}>Keywords toward the <strong style={{ color: C.orange }}>lower-right</strong> — higher volume, lower difficulty — are your best targets.</p>
              {insights.pts.length ? <OpportunityScatter points={insights.pts} /> : <EmptyState icon="📊" title="Not enough data" sub="No search estimates for related keywords yet." />}
            </Card>
            <Card>
              <SectionTitle>Competition Mix</SectionTitle>
              <MixDonut segments={insights.compMix} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                {insights.compMix.map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{s.label} competition</span>
                    <span style={{ fontSize: 14.5, fontWeight: 600, fontFamily: MONO, color: C.ink }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Tag analysis + listing snapshot */}
          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 12, alignItems: 'start' }}>
            <Card>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>top {insights.snapshot.sample} listings</span>}>Most-used Tags</SectionTitle>
              {insights.tags.length
                ? <BarChart axis="y" height={340} highlightMax labels={insights.tags.map(t => t[0])} values={insights.tags.map(t => t[1])} />
                : <EmptyState icon="🏷️" title="No tags found" />}
            </Card>
            <Card>
              <SectionTitle>Listing Snapshot</SectionTitle>
              <SnapRow k="Median price" v={`${insights.snapshot.cur}${insights.snapshot.priceMed.toFixed(0)}`} />
              <SnapRow k="Price range" v={`${insights.snapshot.cur}${insights.snapshot.priceLow.toFixed(0)} – ${insights.snapshot.cur}${insights.snapshot.priceHigh.toFixed(0)}`} />
              <SnapRow k="Avg. views" v={formatNumber(Math.round(insights.snapshot.avgViews))} />
              <SnapRow k="Avg. favorites" v={formatNumber(Math.round(insights.snapshot.avgFavs))} />
              <SnapRow k="Listings sampled" v={String(insights.snapshot.sample)} last />
            </Card>
          </div>
        </>
      )}

      {/* Google-powered row — only shows when Google Ads is connected */}
      {tr?.countries && tr.countries.length > 0 && (
        <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
          <Card>
            <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: '#b0b0a8' }}>Google</span>}>Searchers by Country</SectionTitle>
            <CountryChart data={tr.countries} />
          </Card>
          <Card>
            <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: '#b0b0a8' }}>Google</span>}>Google Search Volume</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0' }}>
              <span style={{ fontSize: 38, fontWeight: 400, color: C.ink, letterSpacing: '-1px', lineHeight: 1 }}>
                {kw?.stats.googleSearches != null ? formatNumber(kw.stats.googleSearches) : '—'}
              </span>
              <span style={{ fontSize: 12.5, color: '#8a8a82' }}>avg / month</span>
            </div>
            <p style={{ fontSize: 11.5, color: '#9a9a92', lineHeight: 1.55, marginTop: 6 }}>
              Real Google monthly search volume for &ldquo;{query}&rdquo; (US), from the Google Ads Keyword Planner. Toggle the <strong>Google</strong> line on the trend chart above to see its 12-month shape.
            </p>
          </Card>
        </div>
      )}

      {/* Keyword table / listings */}
      {isLoading && <Loading />}
      {isError && <ErrorBox>Failed to load keyword data from Etsy. Please try again.</ErrorBox>}
      {kw && !isLoading && (
        <div>
          <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
            <div style={{ display: 'flex', gap: 4, background: C.bone, padding: 3, borderRadius: 100 }}>
              {([['ideas', `Keyword Ideas (${kw.related.length})`], ['listings', `Top Listings (${kw.listings.length})`]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setSub(id)}
                  style={{ fontSize: 14, fontFamily: 'inherit', fontWeight: sub === id ? 500 : 400, padding: '8px 16px', borderRadius: 100, cursor: 'pointer', background: sub === id ? C.paper : 'transparent', color: sub === id ? C.ink : C.graphite, border: sub === id ? `1px solid ${C.ash}` : '1px solid transparent', transition: 'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 10.5, fontFamily: MONO, color: C.inkFaint }}>{kw.cachedAt ? 'cached' : 'live'} · derived from top {kw.listings.length} listings</span>
          </div>
          {sub === 'ideas' ? <KeywordTable rows={kw.related} /> : <ListingsGrid listings={kw.listings} />}
          <p style={{ fontSize: 11, color: '#a9a79f', marginTop: 12, fontFamily: MONO, lineHeight: 1.6 }}>
            Searches/clicks/CTR are relative estimates derived from live Etsy listing engagement (the official API doesn&apos;t expose absolute search volume). Competition is the real total of active listings; KD is an estimate.
          </p>
        </div>
      )}
    </div>
  )
}
