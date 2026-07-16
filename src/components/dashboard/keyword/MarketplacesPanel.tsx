'use client'
import { memo } from 'react'
import { Card, SectionTitle, MONO } from '../kit'
import { C, D, formatNumber } from '@/utils'
import type { KeywordStats } from '@/types'

// Only Etsy is wired to a live API. Every other marketplace here is an outbound
// search link and says so — no interpolated numbers, no scraping. Google fills
// in on its own once Google Ads credentials are configured (see google-ads.ts).
interface Market {
  id: string
  name: string
  color: string
  url: (q: string) => string
  note: string
}

const MARKETS: Market[] = [
  { id: 'etsy',   name: 'Etsy',   color: C.orange, note: 'Live via the official Etsy Open API',
    url: q => `https://www.etsy.com/search?q=${encodeURIComponent(q)}` },
  { id: 'google', name: 'Google', color: '#2E6DB4', note: 'Needs Google Ads credentials',
    url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { id: 'amazon', name: 'Amazon', color: '#C08A12', note: 'No public API connected',
    url: q => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
  { id: 'ebay',   name: 'eBay',   color: '#7A4FB5', note: 'No public API connected',
    url: q => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
]

function ExtIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function MarketCard({ m, query, value, unit }: {
  m: Market; query: string; value: number | null; unit: string
}) {
  const live = value != null
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 14, borderColor: live ? m.color : C.ash }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: live ? m.color : C.lightGray, flexShrink: 0 }} />
        <h4 style={{ fontSize: 17, fontWeight: 500, color: C.ink, flex: 1, letterSpacing: '-0.02em' }}>{m.name}</h4>
        <span style={{
          fontSize: 10, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
          padding: '3px 9px', borderRadius: 100,
          background: live ? D.goodBg : C.charcoalSoft, color: live ? D.good : C.stone,
        }}>
          {live ? 'Live' : 'Not connected'}
        </span>
      </div>

      <div>
        {live ? (
          <p style={{ fontSize: 34, fontWeight: 500, color: m.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {formatNumber(value)}
            <span style={{ fontSize: 13, fontWeight: 400, color: C.graphite, marginLeft: 8, letterSpacing: 0 }}>{unit}</span>
          </p>
        ) : (
          <p style={{ fontSize: 34, fontWeight: 400, color: C.lightGray, letterSpacing: '-0.03em', lineHeight: 1 }}>—</p>
        )}
        <p style={{ fontSize: 12, color: C.stone, marginTop: 8, lineHeight: 1.5 }}>{m.note}</p>
      </div>

      <a href={m.url(query)} target="_blank" rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          height: 38, borderRadius: 100, border: `1px solid ${C.ash}`, color: C.ink,
          fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.12s', marginTop: 'auto',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.color = m.color }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.ash; e.currentTarget.style.color = C.ink }}>
        Search on {m.name} <ExtIcon />
      </a>
    </Card>
  )
}

export const MarketplacesPanel = memo(function MarketplacesPanel({
  query, stats,
}: { query: string; stats: KeywordStats }) {
  const valueFor = (id: string): { value: number | null; unit: string } => {
    if (id === 'etsy')   return { value: stats.totalResults, unit: 'live listings' }
    if (id === 'google') return { value: stats.googleSearches, unit: 'searches / mo' }
    return { value: null, unit: '' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionTitle>Where &ldquo;{query}&rdquo; sells</SectionTitle>
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, marginTop: -8 }}>
          Rankkw is built on the <strong style={{ color: C.ink }}>official Etsy Open API</strong>{' '}— that&apos;s the only marketplace
          we can report real numbers for, and we won&apos;t invent the rest. Amazon and eBay open a live search in a new tab so you
          can eyeball demand yourself. Google fills in automatically once Google Ads credentials are configured.
        </p>
      </Card>

      <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'stretch' }}>
        {MARKETS.map(m => {
          const { value, unit } = valueFor(m.id)
          return <MarketCard key={m.id} m={m} query={query} value={value} unit={unit} />
        })}
      </div>

      <Card>
        <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>Etsy · live</span>}>Etsy demand snapshot</SectionTitle>
        <div className="rgrid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { k: 'Competing listings', v: formatNumber(stats.totalResults), c: stats.totalResults > 250_000 ? D.hard : stats.totalResults > 25_000 ? D.mid : D.good },
            { k: 'Keyword difficulty', v: `${stats.difficulty} · ${stats.difficultyLabel}`, c: stats.difficulty < 34 ? D.good : stats.difficulty < 67 ? D.mid : D.hard },
            { k: 'Median price', v: `${stats.currency === 'USD' ? '$' : stats.currency + ' '}${stats.avgPrice.toFixed(2)}`, c: C.ink },
            { k: 'Avg. favorites', v: formatNumber(stats.avgFavorites), c: C.ink },
          ].map(x => (
            <div key={x.k} style={{ padding: '14px 16px', background: C.canvas, borderRadius: 12 }}>
              <p style={{ fontSize: 11.5, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{x.k}</p>
              <p style={{ fontSize: 21, fontWeight: 500, color: x.c, letterSpacing: '-0.02em' }}>{x.v}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
})
