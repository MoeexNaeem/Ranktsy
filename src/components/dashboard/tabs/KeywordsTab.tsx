'use client'
import { useState, useCallback, useMemo } from 'react'
import { useKeywordSearch, useRelatedKeywords, useNearMatches, useKeywordListings, useTrends } from '@/hooks/useKeywords'
import { useAppStore }     from '@/store/app'
import { useFavorites }    from '@/hooks/useFavorites'
import { KeywordTable }    from '../KeywordTable'
import { TrendChart }      from '@/components/charts/TrendChart'
import { CountryChart }    from '@/components/charts/CountryChart'
import { OpportunityScatter, MixDonut } from '@/components/charts/InsightCharts'
import { PlatformToggle }  from '../PlatformToggle'
import { Star }            from '../controls'
import { SearchAnalysisPanel } from '../keyword/SearchAnalysisPanel'
import { NearMatchesTable }    from '../keyword/NearMatchesTable'
import { MarketplacesPanel }   from '../keyword/MarketplacesPanel'
import { Card, SearchBar, StatCard, SectionTitle, ErrorBox, EmptyState, MONO } from '../kit'
import { StatRowSkeleton, TableSkeleton, CardSkeleton, GridSkeleton, LoadingStages, Measuring, Shimmer } from '../skeletons'
import { C, D, heatColor, formatNumber, formatPercent } from '@/utils'
import type { TrendPlatform, KeywordStats, EtsyListing } from '@/types'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')

type Sub = 'ideas' | 'near' | 'analysis' | 'listings' | 'markets'

function Skel({ h = 82 }: { h?: number }) {
  return <div className="shimmer" style={{ height: h, background: '#e8e7e2', borderRadius: 10 }} />
}

// ─── Honest signal badges ─────────────────────────────────────────────────────
// eRank shows a "Trending in Search!" chip. The Etsy Open API exposes no search
// volume over time, so a trend chip here would be decoration. These read off
// metrics we genuinely have: real listing supply and real favorites-per-view.
function Badge({ color, bg, children, title }: {
  color: string; bg: string; children: React.ReactNode; title: string
}) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 100,
      fontSize: 12.5, fontWeight: 600, background: bg, color, whiteSpace: 'nowrap', cursor: 'help',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {children}
    </span>
  )
}

function SignalBadges({ s }: { s: KeywordStats }) {
  const out: React.ReactNode[] = []

  if (s.favPerView >= 4) {
    out.push(<Badge key="interest" color={D.good} bg={D.goodBg}
      title={`Top listings average ${s.favPerView}% favorites-per-view — well above the ~1–3% typical on Etsy. Shoppers who find these listings tend to save them.`}>
      High buyer interest
    </Badge>)
  } else if (s.favPerView > 0 && s.favPerView < 1) {
    out.push(<Badge key="cold" color={D.neutral} bg={D.neutralBg}
      title={`Top listings average only ${s.favPerView}% favorites-per-view. Traffic here converts to saves weakly.`}>
      Low engagement
    </Badge>)
  }

  if (s.difficulty < 34) {
    out.push(<Badge key="easy" color={D.good} bg={D.goodBg}
      title={`Keyword difficulty ${s.difficulty}/100 — comparatively little competition for the supply of listings.`}>
      Easy to rank
    </Badge>)
  } else if (s.difficulty >= 67) {
    out.push(<Badge key="hard" color={D.hard} bg={D.hardBg}
      title={`Keyword difficulty ${s.difficulty}/100 — ${formatNumber(s.totalResults)} live listings already compete here.`}>
      Hard to rank
    </Badge>)
  }

  if (s.totalResults > 500_000) {
    out.push(<Badge key="sat" color={D.hard} bg={D.hardBg}
      title={`${s.totalResults.toLocaleString()} active Etsy listings match this keyword. Consider a longer-tail phrase.`}>
      Saturated
    </Badge>)
  } else if (s.totalResults > 0 && s.totalResults < 5_000) {
    out.push(<Badge key="niche" color="#2E6DB4" bg="rgba(46,109,180,0.12)"
      title={`Only ${s.totalResults.toLocaleString()} active listings match — a genuine niche, if demand is there.`}>
      Niche
    </Badge>)
  }

  return <>{out}</>
}

// ─── Keyword difficulty panel ────────────────────────────────────────────────
function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${C.hair}` }}>
      <span style={{ fontSize: 14, color: C.graphite }}>{k}</span>
      <span style={{ fontSize: 15, fontFamily: MONO, fontWeight: 500, color: C.ink }}>{v}</span>
    </div>
  )
}

function DifficultyPanel({ s }: { s: KeywordStats }) {
  const color = heatColor(s.difficulty)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 52, fontWeight: 500, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.difficulty}</span>
        <div>
          <span style={{ fontSize: 15, fontWeight: 600, color, textTransform: 'uppercase', fontFamily: MONO, letterSpacing: '0.04em' }}>{s.difficultyLabel}</span>
          <p style={{ fontSize: 13, color: C.graphite }}>to rank · estimate</p>
        </div>
      </div>
      {/* Green→red gradient track so the score's position reads without the number */}
      <div style={{ height: 10, background: `linear-gradient(90deg, ${D.good} 0%, ${D.fair} 25%, ${D.mid} 50%, ${D.warm} 75%, ${D.hard} 100%)`, borderRadius: 999, margin: '16px 0', position: 'relative', opacity: 0.28 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${s.difficulty}%`, background: color, borderRadius: 999, transition: 'width 0.6s', opacity: 1 }} />
        </div>
      </div>
      <Row k="Competing listings" v={formatNumber(s.totalResults)} />
      <Row k="Median price" v={`${sym(s.currency)}${s.avgPrice.toFixed(0)}`} />
      <Row k="Avg. favorites" v={formatNumber(s.avgFavorites)} last />
    </div>
  )
}

// ─── Top listings grid ───────────────────────────────────────────────────────
function ListingsGrid({ listings }: { listings: EtsyListing[] }) {
  if (!listings.length) return <EmptyState icon="🔎" title="No listings" sub="Try another keyword." />
  const views = listings.map(l => l.views ?? 0)
  const maxViews = Math.max(...views, 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.5 }}>
        The listings Etsy ranks highest for this keyword, in Etsy&apos;s own relevance order. Rank <strong style={{ color: C.ink }}>#1</strong> is what you&apos;re competing against.
      </p>
      <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {listings.slice(0, 24).map((l, i) => {
          const price = l.price.amount / (l.price.divisor || 100)
          // Colour the rank chip by how far above/below the sample's peak views it sits.
          const share = (l.views ?? 0) / maxViews
          const rankColor = i < 3 ? C.orange : share > 0.5 ? D.good : C.graphite
          return (
            <a key={l.listing_id} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', textDecoration: 'none', border: `1px solid ${C.hair}`, borderRadius: 10, overflow: 'hidden', background: C.paper, transition: 'border-color 0.15s', position: 'relative' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = C.orange)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.hair)}>
              <span style={{
                position: 'absolute', top: 8, left: 8, zIndex: 2, background: rankColor, color: '#fff',
                fontSize: 11, fontFamily: MONO, fontWeight: 600, padding: '3px 8px', borderRadius: 100,
              }}>#{i + 1}</span>
              {l.images?.[0]?.url_570xN
                ? <img src={l.images[0].url_570xN} alt={l.title} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: 140, background: C.bone }} />}
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: 12, color: C.ink, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 7, minHeight: 34 }}>{l.title}</p>
                <p style={{ fontSize: 11, color: C.stone, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.shop_name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontFamily: MONO }}>
                  <span style={{ color: C.orange, fontWeight: 600, fontSize: 13 }}>{sym(l.price.currency_code)}{price.toFixed(2)}</span>
                  <span style={{ color: C.graphite }}>
                    <span style={{ color: '#2E6DB4' }}>{formatNumber(l.views)}</span> views · <span style={{ color: D.hard }}>{formatNumber(l.num_favorers)}</span> ♥
                  </span>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ─── Sub-tab bar ─────────────────────────────────────────────────────────────
function SubTabs({ active, onChange, counts }: {
  active: Sub; onChange: (s: Sub) => void; counts: Partial<Record<Sub, number>>
}) {
  const TABS: { id: Sub; label: string }[] = [
    { id: 'ideas',    label: 'Keyword Ideas' },
    { id: 'near',     label: 'Near Matches' },
    { id: 'analysis', label: 'Search Results Analysis' },
    { id: 'listings', label: 'Top Listings' },
    { id: 'markets',  label: 'Marketplaces' },
  ]
  return (
    <div className="rwrap-sm" style={{ display: 'flex', gap: 4, background: C.bone, padding: 4, borderRadius: 100, width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap' }}>
      {TABS.map(t => {
        const on = active === t.id
        const n = counts[t.id]
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            aria-current={on ? 'page' : undefined}
            style={{
              fontSize: 14, fontFamily: 'inherit', fontWeight: on ? 500 : 400, padding: '9px 17px',
              borderRadius: 100, cursor: 'pointer', whiteSpace: 'nowrap',
              background: on ? C.paper : 'transparent', color: on ? C.ink : C.graphite,
              border: on ? `1px solid ${C.ash}` : '1px solid transparent', transition: 'all 0.15s',
            }}>
            {t.label}
            {n != null && n > 0 && (
              <span style={{ fontSize: 11.5, fontFamily: MONO, color: on ? C.orange : C.stone, marginLeft: 7 }}>{n}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function KeywordsTab({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const [input, setInput] = useState('silver necklace')
  const [query, setQuery] = useState('silver necklace')
  const [plats, setPlats] = useState<TrendPlatform[]>(['etsy', 'google'])
  const [sub, setSub]     = useState<Sub>('ideas')

  const addR = useAppStore(s => s.addRecentSearch)
  const setActiveKeyword = useAppStore(s => s.setActiveKeyword)
  const { isFavorite, toggle } = useFavorites()

  // Three parallel stages, not one blocking call. The core paints the page in
  // ~1–2s; related keywords (~24 live searches) and near matches (~6) fill in
  // behind it, each with its own loading state so the UI can say which part is
  // still measuring.
  const { data: kw, isLoading, isError, isFetching } = useKeywordSearch(query)
  const related = useRelatedKeywords(query)
  const near    = useNearMatches(query)
  // Images cost a separate ~1.5s Etsy batch call and only this grid uses them,
  // so they're fetched only once the tab is actually opened.
  const listingImgs = useKeywordListings(query, sub === 'listings')
  const { data: tr } = useTrends(query)

  // Related rows arrive unenriched with the core (competition: null) and are
  // replaced in place once probed — so the table shows keywords immediately and
  // the competition column resolves a few seconds later.
  const relatedRows = related.data ?? kw?.related ?? []
  const relatedPending = related.isPending || related.isFetching

  const run = useCallback((q: string) => {
    const v = q.trim()
    if (v.length < 2) return
    setInput(v); setQuery(v); addR(v); setActiveKeyword(v)
  }, [addR, setActiveKeyword])

  const search = useCallback(() => run(input), [input, run])

  // Every card is a direct Etsy measurement. There is no "Avg. Searches" or
  // "Avg. Clicks" card: Etsy publishes neither, and the old ones were listing
  // views and favourites relabelled.
  const stats = useMemo(() => {
    if (!kw) return null
    const { avgViews, avgFavorites, favPerView, totalResults, difficulty, difficultyLabel } = kw.stats
    return [
      { label: 'Competition',   value: formatNumber(totalResults), sub: 'live Etsy listings',   pct: difficulty,                                   color: heatColor(difficulty) },
      { label: 'Keyword Difficulty', value: `${difficulty}`,        sub: `${difficultyLabel} · estimate`, pct: difficulty,                          color: heatColor(difficulty) },
      { label: 'Avg. Views',    value: formatNumber(avgViews),      sub: 'lifetime, top listings', pct: Math.min((avgViews / 20000) * 100, 100),    color: '#2E6DB4' },
      { label: 'Avg. Favorites', value: formatNumber(avgFavorites), sub: `${formatPercent(favPerView)} of views`, pct: Math.min(favPerView * 12, 100), color: favPerView >= 4 ? D.good : favPerView >= 1.5 ? D.mid : D.neutral },
    ]
  }, [kw])

  const insights = useMemo(() => {
    if (!relatedRows.length) return null
    // Plots two REAL measurements: buyer pull (avg favourites of the listings
    // ranking for that keyword) against difficulty. The old X axis was a
    // fabricated "searches" figure, so the matrix ranked keywords by a number
    // Etsy never published.
    const pts = relatedRows
      .filter(r => r.difficulty != null && r.avgFavorites != null && r.avgFavorites > 0)
      .map(r => ({ x: r.avgFavorites as number, y: r.difficulty as number, label: r.keyword, color: heatColor(r.difficulty as number) }))
    // Keywords whose competition probe hasn't returned (or failed) are genuinely
    // unknown — counting them as any bucket would overstate what we know.
    const mix = { Low: 0, Med: 0, High: 0 } as Record<'Low' | 'Med' | 'High', number>
    let unknown = 0
    relatedRows.forEach(r => { if (r.competitionLevel) mix[r.competitionLevel]++; else unknown++ })
    const compMix = [
      { label: 'Low',  value: mix.Low,  color: D.good },
      { label: 'Med',  value: mix.Med,  color: D.mid },
      { label: 'High', value: mix.High, color: D.hard },
    ]
    return { pts, compMix, unknown }
  }, [relatedRows])

  const counts: Partial<Record<Sub, number>> = {
    ideas:    relatedRows.length || undefined,
    near:     near.data?.length,
    analysis: kw?.analysis?.listingsAnalyzed,
    listings: kw?.listings.length,
  }

  // Named stages, so a 13-second cold measure reads as progress rather than a hang.
  const stages = useMemo(() => [
    { label: 'Listings & stats', done: !!kw && !isFetching, failed: isError },
    { label: `Competition for ${kw?.related.length ?? 24} keywords`, done: !!related.data && !related.isFetching, failed: related.isError },
    { label: 'Near matches', done: !!near.data && !near.isFetching, failed: near.isError },
  ], [kw, isFetching, isError, related.data, related.isFetching, related.isError, near.data, near.isFetching, near.isError])

  const allDone = stages.every(s => s.done || s.failed)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={search} placeholder="Search any Etsy keyword…" />

      {/* Live progress. Stays up until every stage lands, so the user always
          knows data is still arriving rather than wondering if it's stuck. */}
      {!allDone && !isError && <LoadingStages stages={stages} note="Every figure is measured live against the Etsy API — no cached estimates. This takes a few seconds the first time a keyword is searched; afterwards it's instant." />}

      {/* Keyword header */}
      {isLoading && !kw && (
        <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Shimmer h={32} w={220} r={6} />
          <Shimmer h={24} w={130} r={100} />
          <Shimmer h={24} w={100} r={100} />
        </div>
      )}

      {kw && (
        <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 30, fontWeight: 500, color: C.ink, letterSpacing: '-0.03em', textTransform: 'capitalize' }}>{kw.query}</h2>
          <Star on={isFavorite(kw.query)} onClick={() => toggle(kw.query)} size={19} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <SignalBadges s={kw.stats} />
          </div>
          <button
            onClick={() => { setActiveKeyword(kw.query); onNavigate?.('topsellers') }}
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, height: 40,
              padding: '0 17px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper,
              color: C.ink, fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.color = C.orange }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.ash; e.currentTarget.style.color = C.ink }}>
            See Best Sellers →
          </button>
        </div>
      )}

      {/* Stats */}
      {!stats
        ? <StatRowSkeleton n={4} />
        : (
          <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {stats.map(s => <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} accent={s.color} pct={s.pct} />)}
          </div>
        )}

      {/* Trend + difficulty */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, alignItems: 'start' }}>
        <Card>
          <SectionTitle right={tr?.trends?.length ? <PlatformToggle active={plats} onChange={setPlats} /> : undefined}>
            Search Trend (12 months)
          </SectionTitle>
          {!tr ? <Shimmer h={112} r={8} />
            : tr.trends?.length ? <TrendChart data={tr.trends} activePlatforms={plats} />
            : (
              /* Etsy publishes no search volume over time. The chart here used to
                 be a hardcoded curve — identical for every keyword — so this now
                 points at the real signal instead. */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0' }}>
                <p style={{ fontSize: 13.5, color: C.ink, fontWeight: 500 }}>No search-volume series for Etsy</p>
                <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6 }}>
                  Etsy&apos;s API doesn&apos;t publish search volume or history. The <strong style={{ color: C.ink }}>Search
                  Results Analysis</strong> tab below shows real listing age and demand signals for &ldquo;{query}&rdquo;;
                  connecting Google Ads adds a real monthly volume line here.
                </p>
              </div>
            )}
        </Card>
        <Card>
          <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: C.stone }}>KD</span>}>Keyword Difficulty</SectionTitle>
          {kw ? <DifficultyPanel s={kw.stats} /> : <Shimmer h={200} r={8} />}
        </Card>
      </div>

      {/* Google row — only when Google Ads is connected */}
      {tr?.countries && tr.countries.length > 0 && (
        <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
          <Card>
            <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: C.stone }}>Google</span>}>Searchers by Country</SectionTitle>
            <CountryChart data={tr.countries} />
          </Card>
          <Card>
            <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: C.stone }}>Google</span>}>Google Search Volume</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0' }}>
              <span style={{ fontSize: 38, fontWeight: 400, color: '#2E6DB4', letterSpacing: '-1px', lineHeight: 1 }}>
                {kw?.stats.googleSearches != null ? formatNumber(kw.stats.googleSearches) : '—'}
              </span>
              <span style={{ fontSize: 12.5, color: C.stone }}>avg / month</span>
            </div>
            <p style={{ fontSize: 11.5, color: C.stone, lineHeight: 1.55, marginTop: 6 }}>
              Real Google monthly search volume for &ldquo;{query}&rdquo; (US), from the Google Ads Keyword Planner.
            </p>
          </Card>
        </div>
      )}

      {isError && <ErrorBox>Failed to load keyword data from Etsy. Please try again.</ErrorBox>}

      {/* Sub-tabs */}
      {kw && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <SubTabs active={sub} onChange={setSub} counts={counts} />
            <span style={{ fontSize: 10.5, fontFamily: MONO, color: C.inkFaint }}>
              {kw.cachedAt ? 'cached' : 'live'} · top {kw.listings.length} listings sampled
            </span>
          </div>

          {sub === 'ideas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {insights && (
                <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 12, alignItems: 'start' }}>
                  <Card>
                    <SectionTitle right={relatedPending ? <Measuring /> : <span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{insights.pts.length} keywords</span>}>Opportunity Matrix</SectionTitle>
                    <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 10 }}>
                      Keywords toward the <strong style={{ color: D.good }}>lower-right</strong> — more buyer pull, lower difficulty — are your best targets.
                    </p>
                    {relatedPending && !insights.pts.length
                      ? <Shimmer h={280} r={8} />
                      : insights.pts.length
                        ? <OpportunityScatter points={insights.pts} />
                        : <EmptyState icon="📊" title="Not enough data" sub="Etsy returned no engagement for these keywords." />}
                  </Card>
                  <Card>
                    <SectionTitle right={relatedPending ? <Measuring /> : undefined}>Competition Mix</SectionTitle>
                    <MixDonut segments={insights.compMix} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                      {insights.compMix.map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{s.label} competition</span>
                          <span style={{ fontSize: 14.5, fontWeight: 600, fontFamily: MONO, color: s.color }}>{s.value}</span>
                        </div>
                      ))}
                      {insights.unknown > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 9, borderTop: `1px solid ${C.hair}` }}>
                          <span style={{ width: 11, height: 11, borderRadius: 3, background: C.lightGray, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 14, color: C.graphite }}
                            title={relatedPending ? 'Still measuring these against Etsy' : "Etsy didn't return a listing count for these keywords"}>
                            {relatedPending ? 'Measuring…' : 'Unknown'}
                          </span>
                          <span style={{ fontSize: 14.5, fontWeight: 600, fontFamily: MONO, color: C.graphite }}>{insights.unknown}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {/* Keywords appear as soon as the core lands; the competition
                  column resolves when the per-keyword probes return. */}
              {relatedRows.length
                ? <KeywordTable rows={relatedRows} query={kw.query} onSelect={r => run(r.keyword)} measuring={relatedPending} />
                : <TableSkeleton
                    grid="26px 24px 1.9fr 1fr 1fr 0.7fr 0.85fr 0.85fr 0.75fr 0.8fr 0.55fr 0.85fr"
                    columns={['', '', 'Keywords', 'Listings / month', 'Etsy Competition', 'KD', 'Avg. Views', 'Avg. Favorites', 'Favs / View', 'Tag Occurrences', 'Chars', 'Google Searches']}
                    rows={10}
                    label="Running a live Etsy search for each related keyword…" />}

              <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
                Every column is measured from the Etsy API: competition is the real total of live listings for that exact
                keyword, views and favourites come from the listings ranking for it. KD is an estimate computed from those
                real inputs. Etsy publishes no search volume or click data, so neither is shown.
              </p>
            </div>
          )}

          {sub === 'near' && (
            near.isPending && !near.data
              ? <TableSkeleton
                  grid="28px 1.7fr 1fr 0.95fr 0.7fr 0.85fr 0.85fr 0.75fr 0.75fr"
                  columns={['', 'Keywords', 'Listings / month', 'Etsy Competition', 'KD', 'Avg. Views', 'Avg. Favorites', 'Favs / View', 'Tag Occurrences']}
                  rows={5}
                  label="Measuring each spelling variant against its own live Etsy search…" />
              : near.isError
                ? <ErrorBox>Couldn&apos;t measure near matches. Please try again.</ErrorBox>
                : <NearMatchesTable rows={near.data ?? []} onSelect={run} />
          )}

          {sub === 'analysis' && (
            kw.analysis
              ? <SearchAnalysisPanel analysis={kw.analysis} onSelectTag={run} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <CardSkeleton h={80} />
                  <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12 }}>
                    <CardSkeleton h={300} /><CardSkeleton h={300} />
                  </div>
                </div>
          )}

          {sub === 'listings' && (
            listingImgs.data?.length
              ? <ListingsGrid listings={listingImgs.data} />
              : listingImgs.isError
                ? <ErrorBox>Couldn&apos;t load listings from Etsy. Please try again.</ErrorBox>
                : <GridSkeleton n={12} />
          )}
          {sub === 'markets'  && <MarketplacesPanel query={kw.query} stats={kw.stats} />}
        </div>
      )}
    </div>
  )
}
