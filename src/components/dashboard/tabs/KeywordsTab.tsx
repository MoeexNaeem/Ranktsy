'use client'
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useKeywordSearch, useRelatedKeywords, useNearMatches, useKeywordListings, useTrends, useKeywordIdeas } from '@/hooks/useKeywords'
import { useAppStore }     from '@/store/app'
import { useFavorites }    from '@/hooks/useFavorites'
import { KeywordTable }    from '../KeywordTable'
import { TrendChart }      from '@/components/charts/TrendChart'
import { CountryChart }    from '@/components/charts/CountryChart'
import { OpportunityBarChart, MixDonut } from '@/components/charts/InsightCharts'
import { PlatformToggle }  from '../PlatformToggle'
import { Star }            from '../controls'
import { SearchAnalysisPanel } from '../keyword/SearchAnalysisPanel'
import { NearMatchesTable }    from '../keyword/NearMatchesTable'
import { MarketplacesPanel }   from '../keyword/MarketplacesPanel'
import { KeywordIdeasPanel }   from '../keyword/KeywordIdeasPanel'
import { TopListingsTable }    from '../keyword/TopListingsTable'
import { Card, SearchBar, SectionTitle, ErrorBox, EmptyState, MONO } from '../kit'
import { AiInsights } from '../AiInsights'
import { TableSkeleton, CardSkeleton, GridSkeleton, LoadingStages, Measuring, Shimmer } from '../skeletons'
import { useFx } from '@/hooks/useFx'
import { C, D, heatColor, formatNumber, formatPercent } from '@/utils'
import type { TrendPlatform, KeywordStats, AiFact } from '@/types'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: '₨', INR: '₹' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')

// Google advertiser-competition band → semantic colour (green/amber/red).
const GCOMP: Record<string, { fg: string; bg: string; label: string }> = {
  LOW:    { fg: D.good, bg: D.goodBg, label: 'Low' },
  MEDIUM: { fg: D.mid,  bg: D.midBg,  label: 'Med' },
  HIGH:   { fg: D.hard, bg: D.hardBg, label: 'High' },
}
function fmtCpcRange(low?: number | null, high?: number | null, cur?: string | null): string {
  const s = cur ? sym(cur) : ''
  const f = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2))
  if (low != null && high != null) return `${s}${f(low)}–${s}${f(high)}`
  const one = low ?? high
  return one != null ? `${s}${f(one)}` : '—'
}

// ─── Country filter (like eRank's) — changes which country's Google volume,
// CPC and competition are shown. Etsy metrics are marketplace-global. Keep in
// sync with KEYWORD_GEOS in lib/google-ads.ts.
const COUNTRIES = [
  { code: 'US',  name: 'United States' },
  { code: 'GB',  name: 'United Kingdom' },
  { code: 'AU',  name: 'Australia' },
  { code: 'CA',  name: 'Canada' },
  { code: 'FR',  name: 'France' },
  { code: 'DE',  name: 'Germany' },
  { code: 'IN',  name: 'India' },
  { code: 'GLO', name: 'Global' },
]

// Real flag images — flag emoji don't render on Windows (they show "US"/"GB"
// letters), so we use flagcdn images. Global gets a globe glyph.
function FlagIcon({ code, w = 24 }: { code: string; w?: number }) {
  const [err, setErr] = useState(false)
  const h = Math.round(w * 0.72)
  if (code === 'GLO') {
    return (
      <svg width={w} height={h} viewBox="0 0 24 18" style={{ flexShrink: 0 }} aria-hidden>
        <circle cx="12" cy="9" r="7.4" fill="none" stroke={C.graphite} strokeWidth="1.4" />
        <path d="M4.6 9h14.8M12 1.6a13 13 0 0 1 0 14.8M12 1.6a13 13 0 0 0 0 14.8" fill="none" stroke={C.graphite} strokeWidth="1.2" />
      </svg>
    )
  }
  // Fallback to a code badge if the flag image ever fails to load.
  if (err) return <span style={{ width: w, height: h, borderRadius: 3, background: C.canvas, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.graphite, fontFamily: MONO, flexShrink: 0, boxShadow: `0 0 0 1px ${C.hair}` }}>{code}</span>
  return (
    <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} width={w} height={h} alt={code}
      loading="lazy" onError={() => setErr(true)}
      style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0, boxShadow: `0 0 0 1px ${C.hair}` }} />
  )
}

function CountrySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const cur = COUNTRIES.find(c => c.code === value) ?? COUNTRIES[0]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexShrink: 0 }}
      title="Country for Google search volume, CPC & competition">
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={`Country: ${cur.name}`}
        style={{ display: 'flex', alignItems: 'center', gap: 9, height: '100%', minHeight: 50, padding: '0 15px', borderRadius: 100, border: `1px solid ${open ? C.orange : C.ash}`, background: C.paper, color: C.ink, fontSize: 14.5, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <FlagIcon code={cur.code} />
        <span>{cur.name}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.graphite} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, minWidth: 232, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 14, boxShadow: '0 14px 34px rgba(40,40,40,0.14)', padding: 6 }}>
          {COUNTRIES.map(c => {
            const on = c.code === value
            return (
              <button key={c.code} type="button" onClick={() => { onChange(c.code); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', background: on ? C.orangeFaint : 'transparent', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = C.canvas }}
                onMouseLeave={e => { e.currentTarget.style.background = on ? C.orangeFaint : 'transparent' }}>
                <FlagIcon code={c.code} />
                <span style={{ flex: 1, fontSize: 14, color: on ? C.orange : C.ink, fontWeight: on ? 600 : 400 }}>{c.name}</span>
                {on && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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

// ─── Keyword Statistics panel (colored value chips, like the eRank layout) ─────
// The three fabricated metrics (Avg. Searches from a made-up factor, Avg. Clicks =
// favourites, CTR) are gone. Avg. Searches is now REAL Google volume; the other
// rows are direct Etsy measurements. Every chip is a measured number or "—".
function InfoDot({ title }: { title: string }) {
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', border: `1.4px solid ${C.lightGray}`, color: C.stone, fontSize: 9.5, fontStyle: 'italic', fontWeight: 700, cursor: 'help', flexShrink: 0 }}>i</span>
  )
}

function KeywordStatsPanel({ s }: { s: KeywordStats }) {
  const rows = [
    { label: 'Avg. Searches', tip: 'Real Google monthly search volume (US) from the Google Ads Keyword Planner. Etsy publishes no search volume of its own.', value: s.googleSearches != null ? formatNumber(s.googleSearches) : '—', color: s.googleSearches != null ? D.good : C.lightGray },
    { label: 'Avg. Views',    tip: 'Mean lifetime views of the listings ranking for this keyword — Etsy’s own `views` field. This is real traffic, shown instead of a fabricated “Avg. Clicks”.', value: formatNumber(s.avgViews), color: '#2E6DB4' },
    { label: 'Favs / View',   tip: 'Favorites ÷ views, a real engagement ratio (~1–3% is typical on Etsy). Shown instead of “CTR”: Etsy exposes no clicks, so a real click-through rate can’t be computed.', value: `${s.favPerView}%`, color: s.favPerView >= 4 ? D.good : s.favPerView >= 1.5 ? D.mid : D.neutral },
    { label: 'Competition',   tip: 'Real total of live Etsy listings competing for this keyword.', value: formatNumber(s.totalResults), color: s.totalResults > 250_000 ? D.hard : s.totalResults > 25_000 ? D.mid : D.good },
  ]
  return (
    <Card>
      <SectionTitle>Keyword Statistics</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 2 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 14.5, color: C.ink, fontWeight: 500 }}>{r.label}</span>
            <InfoDot title={r.tip} />
            <span style={{ minWidth: 92, marginLeft: 'auto', textAlign: 'center', padding: '8px 14px', borderRadius: 9, background: r.color, color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: MONO, letterSpacing: '-0.01em' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Google CPC with a live USD toggle ────────────────────────────────────────
// Google returns CPC only in the Ads account currency (here PKR). The toggle
// converts with a REAL live rate (/api/fx); if the rate is unknown the toggle is
// hidden and we keep the account-currency figure — never a fabricated conversion.
function CpcDisplay({ low, high, currency }: { low: number | null; high: number | null; currency: string | null }) {
  const [usd, setUsd] = useState(false)
  const fx = useFx(currency)
  const rate = fx.data?.rate ?? null
  const canConvert = !!currency && currency !== 'USD' && rate != null
  const showUsd = usd && canConvert
  const [dl, dh] = showUsd && rate != null
    ? [low != null ? low * rate : null, high != null ? high * rate : null]
    : [low, high]
  const cur = showUsd ? 'USD' : currency
  const has = low != null || high != null

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <p style={{ fontSize: 10.5, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top-of-page CPC{cur ? ` (${cur})` : ''}</p>
        {canConvert && (
          <button onClick={() => setUsd(u => !u)}
            title={`Live rate: 1 ${currency} = ${rate?.toFixed(5)} USD`}
            style={{ marginLeft: 'auto', fontSize: 9.5, fontFamily: MONO, fontWeight: 700, padding: '2px 8px', borderRadius: 100, border: `1px solid ${showUsd ? C.orange : C.ash}`, background: showUsd ? C.orangeFaint : C.paper, color: showUsd ? C.orange : C.graphite, cursor: 'pointer' }}>
            {showUsd ? '✓ USD' : '→ USD'}
          </button>
        )}
      </div>
      <span style={{ fontSize: 15, fontFamily: MONO, fontWeight: 600, color: has ? C.ink : C.stone }}>
        {fmtCpcRange(dl, dh, cur)}
      </span>
    </>
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
  // Seed from the store so a tag clicked in Hot Products (or elsewhere) lands
  // here already researched, instead of on a fixed default.
  const seed = useAppStore.getState().activeKeyword || 'silver necklace'
  const [input, setInput] = useState(seed)
  const [query, setQuery] = useState(seed)
  const [country, setCountry] = useState('US')
  const [plats, setPlats] = useState<TrendPlatform[]>(['etsy', 'google'])
  const [sub, setSub]     = useState<Sub>('ideas')

  const addR = useAppStore(s => s.addRecentSearch)
  const setActiveKeyword = useAppStore(s => s.setActiveKeyword)
  const { isFavorite, toggle } = useFavorites()

  // Three parallel stages, not one blocking call. The core paints the page in
  // ~1–2s; related keywords (~24 live searches) and near matches (~6) fill in
  // behind it, each with its own loading state so the UI can say which part is
  // still measuring.
  const { data: kw, isLoading, isError, isFetching } = useKeywordSearch(query, country)
  const related = useRelatedKeywords(query, country)
  const near    = useNearMatches(query)
  // Images cost a separate ~1.5s Etsy batch call and only this grid uses them,
  // so they're fetched only once the tab is actually opened.
  const listingImgs = useKeywordListings(query, sub === 'listings')
  const { data: tr } = useTrends(query, country)
  // Google-suggested keywords (generateKeywordIdeas) — real discovery beyond Etsy tags.
  const ideas = useKeywordIdeas(query, country)

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

  const insights = useMemo(() => {
    if (!relatedRows.length) return null
    // X axis = real demand: Google search volume when Google Ads is connected,
    // otherwise buyer pull (avg favourites of the listings ranking for the keyword).
    // Both are REAL — never a fabricated "searches" figure. Y = difficulty (KD).
    const useVol = relatedRows.some(r => r.googleSearches != null && (r.googleSearches ?? 0) > 0)
    const pts = relatedRows
      .filter(r => r.difficulty != null && (useVol ? (r.googleSearches ?? 0) > 0 : (r.avgFavorites ?? 0) > 0))
      .map(r => ({ label: r.keyword, x: (useVol ? r.googleSearches : r.avgFavorites) as number, kd: r.difficulty as number, competition: r.competition, compLevel: r.competitionLevel }))
    const unit = useVol ? 'searches/mo' : 'avg favorites'
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
    // Ranking-difficulty spread (real KD buckets) — a second clear breakdown that
    // fills the summary row alongside competition.
    const kd = { Easy: 0, Medium: 0, Hard: 0 }
    relatedRows.forEach(r => { if (r.difficulty != null) { if (r.difficulty < 34) kd.Easy++; else if (r.difficulty < 67) kd.Medium++; else kd.Hard++ } })
    const kdMix = [
      { label: 'Easy',   value: kd.Easy,   color: D.good },
      { label: 'Medium', value: kd.Medium, color: D.mid },
      { label: 'Hard',   value: kd.Hard,   color: D.hard },
    ]
    return { pts, unit, compMix, kdMix, unknown }
  }, [relatedRows])

  // Real facts for the AI read — all measured by the keyword pipeline. Gemini
  // interprets "how to win this keyword"; it never produces these numbers.
  const aiFacts = useMemo<AiFact[]>(() => {
    if (!kw) return []
    const s = kw.stats
    const f: AiFact[] = [
      { label: 'Keyword difficulty', value: `${s.difficulty}/100`, hint: `${s.difficultyLabel} — estimate from real competition + engagement` },
      { label: 'Competing listings', value: formatNumber(s.totalResults), hint: 'live on Etsy for this exact keyword' },
      { label: 'Avg views (top listings)', value: formatNumber(s.avgViews), hint: 'lifetime' },
      { label: 'Avg favorites', value: formatNumber(s.avgFavorites) },
      { label: 'Favorites per view', value: formatPercent(s.favPerView), hint: 'real engagement ratio; ~1–3% is typical on Etsy' },
      { label: 'Median price', value: `${sym(s.currency)}${s.avgPrice.toFixed(0)}` },
    ]
    if (s.googleSearches != null) f.push({ label: 'Google monthly searches', value: formatNumber(s.googleSearches), hint: 'US, real Google Ads volume' })
    if (s.googleCompetition && s.googleCompetition !== 'UNSPECIFIED') f.push({ label: 'Google advertiser competition', value: `${s.googleCompetition}${s.googleCompetitionIndex != null ? ` (${s.googleCompetitionIndex}/100)` : ''}`, hint: 'advertiser competition on Google, not Etsy listing competition' })
    // Lowest-difficulty related ideas that still show real buyer pull = the openings.
    relatedRows
      .filter(r => r.difficulty != null && (r.avgFavorites ?? 0) > 0)
      .sort((a, b) => (a.difficulty as number) - (b.difficulty as number))
      .slice(0, 3)
      .forEach((r, i) => f.push({ label: `Lower-competition idea ${i + 1}`, value: r.keyword, hint: `KD ${r.difficulty}, ${formatNumber(r.avgFavorites)} avg favorites` }))
    return f
  }, [kw, relatedRows])

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
      <SearchBar value={input} onChange={setInput} onSubmit={search} placeholder="Search any Etsy keyword…"
        control={<CountrySelect value={country} onChange={setCountry} />} />

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

      {/* Overview — Keyword Statistics · Search Trends · Searchers by Country
          (the sample's three-panel row). Every figure is real or "—". */}
      <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1.55fr 1fr', gap: 12, alignItems: 'start' }}>
        {kw ? <KeywordStatsPanel s={kw.stats} /> : <Card><Shimmer h={230} r={8} /></Card>}

        <Card>
          <SectionTitle right={tr?.trends?.length ? <PlatformToggle active={plats} onChange={setPlats} /> : undefined}>
            Search Trends (12 months)
          </SectionTitle>
          {!tr ? <Shimmer h={224} r={8} />
            : tr.trends?.length ? <TrendChart data={tr.trends} activePlatforms={plats} />
            : (
              /* Etsy publishes no search volume over time. The chart here used to
                 be a hardcoded curve — identical for every keyword — so this now
                 points at the real signal instead. */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '30px 0' }}>
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
          <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: C.stone }}>Google</span>}>Searchers by Country</SectionTitle>
          {!tr ? <Shimmer h={200} r={8} />
            : tr.countries && tr.countries.length > 0
              ? <CountryChart data={tr.countries} />
              : <EmptyState icon="🌍" title="No country data" sub="Google Ads returned no country breakdown for this keyword yet." />}
        </Card>
      </div>

      {/* Difficulty + the Google volume / competition / CPC detail. */}
      <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, alignItems: 'start' }}>
        <Card>
          <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: C.stone }}>KD</span>}>Keyword Difficulty</SectionTitle>
          {kw ? <DifficultyPanel s={kw.stats} /> : <Shimmer h={200} r={8} />}
        </Card>
        <Card>
          <SectionTitle right={<span style={{ fontSize: 10, fontFamily: MONO, color: C.stone }}>Google</span>}>Google Search Volume</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0' }}>
            <span style={{ fontSize: 38, fontWeight: 400, color: '#2E6DB4', letterSpacing: '-1px', lineHeight: 1 }}>
              {kw?.stats.googleSearches != null ? formatNumber(kw.stats.googleSearches) : '—'}
            </span>
            <span style={{ fontSize: 12.5, color: C.stone }}>avg / month</span>
          </div>
          {/* Competition + CPC, from the same Keyword Planner call as the volume. */}
          <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10, marginTop: 10 }}>
            <div style={{ padding: '10px 12px', background: C.canvas, borderRadius: 10 }}>
              <p style={{ fontSize: 10.5, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Advertiser competition</p>
              {kw?.stats.googleCompetition && GCOMP[kw.stats.googleCompetition] ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: MONO, fontWeight: 600, color: GCOMP[kw.stats.googleCompetition].fg }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: GCOMP[kw.stats.googleCompetition].fg }} />
                  {GCOMP[kw.stats.googleCompetition].label}
                  {kw.stats.googleCompetitionIndex != null ? ` · ${kw.stats.googleCompetitionIndex}/100` : ''}
                </span>
              ) : <span style={{ fontSize: 15, fontFamily: MONO, color: C.stone }}>—</span>}
            </div>
            <div style={{ padding: '10px 12px', background: C.canvas, borderRadius: 10 }}>
              <CpcDisplay low={kw?.stats.googleCpcLow ?? null} high={kw?.stats.googleCpcHigh ?? null} currency={kw?.stats.googleCurrency ?? null} />
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: C.stone, lineHeight: 1.55, marginTop: 10 }}>
            Real Google monthly search volume, advertiser competition and top-of-page CPC for &ldquo;{query}&rdquo; (US),
            from the Google Ads Keyword Planner.
          </p>
        </Card>
      </div>

      {/* Best Keyword Opportunities — a big, readable bar graph right beneath the
          Google volume. Fed by related keywords, so it fills in once they land. */}
      {kw && (
        <Card>
          <SectionTitle right={relatedPending ? <Measuring /> : insights ? <span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{insights.pts.length} keywords</span> : undefined}>Best Keyword Opportunities</SectionTitle>
          <p style={{ fontSize: 13, color: C.graphite, marginTop: -8, marginBottom: 12 }}>
            Your related keywords <strong style={{ color: C.ink }}>ranked best-to-worst</strong> — the longer the bar, the better the target (real search demand you can realistically rank for).
          </p>
          {insights?.pts.length
            ? <OpportunityBarChart points={insights.pts} unit={insights.unit} />
            : relatedPending
              ? <Shimmer h={340} r={8} />
              : <EmptyState icon="📊" title="Measuring opportunities…" sub="Ranked keywords appear once their difficulty is measured." />}
        </Card>
      )}

      {isError && <ErrorBox>Failed to load keyword data from Etsy. Please try again.</ErrorBox>}

      {/* AI read of the whole keyword picture — Gemini interprets the real
          measured signals above into a "how to win this keyword" analysis. */}
      {kw && aiFacts.length >= 2 && (
        <AiInsights
          tool="Keyword Research"
          subject={kw.query}
          facts={aiFacts}
          notes="Difficulty is an estimate from real competition + engagement. Views/favorites are lifetime figures from the listings ranking for this keyword. Favorites-per-view is a real engagement ratio, not CTR. Etsy publishes no search volume; any Google figure is real Google Ads data."
        />
      )}

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
                  /* Two compact related-keyword breakdowns side by side. The
                     ranked opportunities graph now lives up beneath Google volume. */
                  <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
                    <Card>
                      <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>Etsy</span>}>Competition Mix</SectionTitle>
                      <p style={{ fontSize: 12, color: C.graphite, marginTop: -8, marginBottom: 8 }}>How many rivals compete for each related keyword.</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div style={{ width: 150, flexShrink: 0 }}><MixDonut segments={insights.compMix} /></div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                          {insights.compMix.map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: 13.5, color: C.ink }}>{s.label} competition</span>
                              <span style={{ fontSize: 14.5, fontWeight: 600, fontFamily: MONO, color: s.color }}>{s.value}</span>
                            </div>
                          ))}
                          {insights.unknown > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 9, borderTop: `1px solid ${C.hair}` }}>
                              <span style={{ width: 11, height: 11, borderRadius: 3, background: C.lightGray, flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: 13.5, color: C.graphite }}
                                title={relatedPending ? 'Still measuring these against Etsy' : "Etsy didn't return a listing count for these keywords"}>
                                {relatedPending ? 'Measuring…' : 'Unknown'}
                              </span>
                              <span style={{ fontSize: 14.5, fontWeight: 600, fontFamily: MONO, color: C.graphite }}>{insights.unknown}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                    <Card>
                      <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>KD</span>}>Difficulty Spread</SectionTitle>
                      <p style={{ fontSize: 12, color: C.graphite, marginTop: -8, marginBottom: 8 }}>How hard these keywords are to rank for (KD estimate).</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div style={{ width: 150, flexShrink: 0 }}><MixDonut segments={insights.kdMix} /></div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                          {insights.kdMix.map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: 13.5, color: C.ink }}>{s.label}{s.label === 'Easy' ? ' (KD < 34)' : s.label === 'Hard' ? ' (KD 67+)' : ' (34–66)'}</span>
                              <span style={{ fontSize: 14.5, fontWeight: 600, fontFamily: MONO, color: s.color }}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>
              )}

              {/* Keywords appear as soon as the core lands; the competition
                  column resolves when the per-keyword probes return. */}
              {relatedRows.length
                ? <KeywordTable rows={relatedRows} query={kw.query} onSelect={r => run(r.keyword)} measuring={relatedPending} currency={kw.stats.googleCurrency} />
                : <TableSkeleton
                    grid="26px 24px 1.9fr 1fr 1fr 0.7fr 0.85fr 0.85fr 0.75fr 0.8fr 0.55fr 0.85fr"
                    columns={['', '', 'Keywords', 'Listings / month', 'Etsy Competition', 'KD', 'Avg. Views', 'Avg. Favorites', 'Favs / View', 'Tag Occurrences', 'Chars', 'Google Searches']}
                    rows={10}
                    label="Running a live Etsy search for each related keyword…" />}

              <p style={{ fontSize: 11, color: C.stone, fontFamily: MONO, lineHeight: 1.6 }}>
                Every Etsy column is measured from the Etsy API: competition is the real total of live listings for that
                exact keyword, views and favourites come from the listings ranking for it. KD is an estimate computed from
                those real inputs. The Google Searches / Comp. / CPC columns are real Google Ads data (US), shown only when
                Google Ads is connected.
              </p>

              {/* Google keyword DISCOVERY — terms Google suggests that an Etsy-tag
                  sample can't contain. The one place we surface keywords Etsy never
                  returned, so it's kept distinct from the measured-related table. */}
              <KeywordIdeasPanel
                seed={kw.query}
                ideas={ideas.data?.ideas ?? []}
                currency={ideas.data?.currency ?? kw.stats.googleCurrency ?? null}
                loading={ideas.isPending || ideas.isFetching}
                configured={(kw.stats.googleCurrency ?? ideas.data?.currency ?? null) != null}
                onSelect={run}
              />
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
              ? <TopListingsTable listings={listingImgs.data} query={kw.query} />
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
