'use client'
import { useState, useCallback, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Star, ExportBtn, HeatPill, toCsv, downloadCsv } from '../controls'
import { useFavorites } from '@/hooks/useFavorites'
import { C, D, compColor, formatNumber } from '@/utils'
import { Card, SectionTitle, ErrorBox, Loading, EmptyState, tableCard, tableHead, th, tableRow, tdMono, tdTitle, primaryBtn, MONO } from '../kit'
import type { ApiResponse, BulkKeywordRow } from '@/types'

const MAX = 25
const GRID = '28px 1.7fr 1fr 0.6fr 0.75fr 0.7fr 0.8fr 0.8fr'

type SortKey = 'competition' | 'difficulty' | 'avgViews' | 'avgFavorites' | 'favPerView' | 'medianPrice' | 'googleSearches'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? c + ' ' : '$')

const COLS: { label: string; key?: SortKey }[] = [
  { label: 'Keyword' },
  { label: 'Etsy Competition', key: 'competition' },
  { label: 'KD', key: 'difficulty' },
  { label: 'Avg Views', key: 'avgViews' },
  { label: 'Avg Favs', key: 'avgFavorites' },
  // Not "CTR" — Etsy exposes no clicks. This is favourites ÷ views.
  { label: 'Favs / View', key: 'favPerView' },
  { label: 'Median Price', key: 'medianPrice' },
]

function CompCell({ row }: { row: BulkKeywordRow }) {
  // "No market" must not read as green/Low — zero competition means nobody sells
  // it because nobody buys it.
  if (row.noMarket) {
    return (
      <span title="No live Etsy listings match this keyword — no competition, but no demand either"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 100, background: C.charcoalSoft, color: C.graphite, fontSize: 12.5, fontFamily: MONO, fontWeight: 600, width: 'fit-content', cursor: 'help' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.stone, flexShrink: 0 }} />
        No market
      </span>
    )
  }
  if (row.competition == null || row.competitionLevel == null) {
    return <span title={row.error ? "Etsy didn't return results for this keyword" : 'Unknown'}
      style={{ ...tdMono, color: C.stone, cursor: 'help' }}>—</span>
  }
  const { fg, bg } = compColor(row.competitionLevel)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 100, background: bg, color: fg, fontSize: 13, fontFamily: MONO, fontWeight: 600, width: 'fit-content' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg, flexShrink: 0 }} />
      {formatNumber(row.competition)}
    </span>
  )
}

export function BulkKeywordTab() {
  const [text, setText] = useState('silver necklace\nboho earrings\nhandmade candle\npersonalized gift\nmacrame wall hanging')
  const [sortKey, setSortKey] = useState<SortKey>('competition')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { isFavorite, toggle } = useFavorites()

  const run = useMutation({
    mutationFn: async (keywords: string[]) => {
      const { data } = await axios.post<ApiResponse<BulkKeywordRow[]>>('/api/keywords/bulk', { keywords })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Bulk analysis failed')
      return data.data
    },
  })

  const parsed = useMemo(
    () => [...new Set(text.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean))],
    [text])

  const go = useCallback(() => {
    if (parsed.length) run.mutate(parsed.slice(0, MAX))
  }, [parsed, run])

  const handleSort = useCallback((key: SortKey) => {
    setSortDir(p => (sortKey === key ? (p === 'asc' ? 'desc' : 'asc') : 'desc'))
    setSortKey(key)
  }, [sortKey])

  const rows = run.data
  const view = useMemo(() => {
    if (!rows) return []
    const dir = sortDir === 'desc' ? -1 : 1
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      // Failed probes sort last either way — they're unknown, not low.
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return dir * (av - bv)
    })
  }, [rows, sortKey, sortDir])

  const best = useMemo(() => {
    // Excludes noMarket rows: a keyword with zero listings scores the lowest
    // difficulty on the page, so without this filter the "best opportunity"
    // callout would confidently recommend a dead keyword.
    const ok = view.filter(r => !r.noMarket && !r.error && r.competition != null && r.difficulty != null)
    if (!ok.length) return null
    return [...ok].sort((a, b) => (a.difficulty ?? 100) - (b.difficulty ?? 100))[0]
  }, [view])

  const deadCount = useMemo(() => view.filter(r => r.noMarket).length, [view])

  const exportCsv = useCallback(() => {
    if (!view.length) return
    downloadCsv('bulk-keywords.csv', toCsv(
      ['Keyword', 'Etsy competition', 'Competition level', 'KD', 'Avg views', 'Avg favorites', 'Favs per view %', 'Median price', 'Currency', 'Chars', 'Words', 'Google searches'],
      view.map(r => [r.keyword, r.competition, r.competitionLevel, r.difficulty, r.avgViews, r.avgFavorites, r.favPerView, r.medianPrice, r.currency, r.charCount, r.wordCount, r.googleSearches]),
    ))
  }, [view])

  const over = parsed.length > MAX

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="18px">
        <SectionTitle right={
          <span style={{ fontSize: 11.5, fontFamily: MONO, color: over ? D.hard : C.stone }}>
            {Math.min(parsed.length, MAX)}/{MAX}{over ? ` · ${parsed.length - MAX} ignored` : ''}
          </span>
        }>Compare up to {MAX} keywords</SectionTitle>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
          placeholder="One keyword per line…"
          style={{ width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 10, padding: '12px 14px', fontSize: 13.5, fontFamily: MONO, color: C.ink, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={go} disabled={run.isPending || !parsed.length}
            style={{ ...primaryBtn, opacity: run.isPending || !parsed.length ? 0.6 : 1 }}>
            {run.isPending ? 'Analyzing…' : 'Analyze keywords →'}
          </button>
          <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.5 }}>
            Each keyword gets its own live Etsy search — <strong style={{ color: C.ink }}>Etsy Competition</strong> is a
            real listing total, not an estimate.
          </p>
        </div>
      </Card>

      {run.isPending && <Loading label={`Running ${Math.min(parsed.length, MAX)} live Etsy searches…`} />}
      {run.isError && <ErrorBox>Failed to analyze keywords. Please try again.</ErrorBox>}

      {rows && rows.length > 0 && !run.isPending && (
        <>
          {best && (
            <div style={{ display: 'flex', gap: 11, padding: '13px 17px', background: D.goodBg, borderRadius: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15 }}>🎯</span>
              <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>
                Best opportunity here: <strong style={{ color: D.good }}>{best.keyword}</strong> — KD {best.difficulty} with{' '}
                {formatNumber(best.competition)} competing listings.
              </p>
            </div>
          )}

          {deadCount > 0 && (
            <div style={{ display: 'flex', gap: 11, padding: '13px 17px', background: C.charcoalSoft, borderRadius: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, lineHeight: 1.4 }}>⚠️</span>
              <p style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.6 }}>
                <strong>{deadCount} keyword{deadCount === 1 ? ' has' : 's have'} no market.</strong> Etsy returns zero live
                listings for {deadCount === 1 ? 'it' : 'them'}. That&apos;s not an easy win — it means nobody sells{' '}
                {deadCount === 1 ? 'it' : 'them'} because nobody searches for {deadCount === 1 ? 'it' : 'them'}. They&apos;re
                excluded from the opportunity pick above.
              </p>
            </div>
          )}

          <div>
            <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
              <SectionTitle>Results</SectionTitle>
              <ExportBtn onClick={exportCsv} />
            </div>
            <div className="rtable" style={tableCard}>
              <div style={tableHead(GRID)}>
                <span />
                {COLS.map(({ label, key }) => (
                  <button key={label} onClick={() => key && handleSort(key)} disabled={!key}
                    style={{ ...th, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: key ? 'pointer' : 'default', padding: 0, textAlign: 'left', fontFamily: MONO }}>
                    {label}
                    {key && sortKey === key && <span style={{ fontSize: 9 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>}
                  </button>
                ))}
              </div>
              {view.map(r => (
                <div key={r.keyword} style={{ ...tableRow(GRID), opacity: r.error ? 0.6 : 1 }}>
                  <Star on={isFavorite(r.keyword)} onClick={() => toggle(r.keyword)} />
                  <span style={tdTitle}>{r.keyword}</span>
                  <CompCell row={r} />
                  {r.difficulty != null ? <HeatPill score={r.difficulty} /> : <span style={{ ...tdMono, color: C.stone }}>—</span>}
                  <span style={{ ...tdMono, color: '#2E6DB4' }}>{r.avgViews != null ? formatNumber(r.avgViews) : '—'}</span>
                  <span style={{ ...tdMono, color: D.hard }}>{r.avgFavorites != null ? formatNumber(r.avgFavorites) : '—'}</span>
                  <span style={tdMono}>{r.favPerView != null ? `${r.favPerView}%` : '—'}</span>
                  <span style={tdMono}>{r.medianPrice != null ? `${sym(r.currency)}${r.medianPrice.toFixed(2)}` : '—'}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.stone, marginTop: 12, fontFamily: MONO, lineHeight: 1.6 }}>
              Etsy Competition is the real count of live listings per keyword. KD is an estimate derived from that supply
              plus how strongly incumbents engage buyers. Median price covers only the dominant currency in each result
              set — Etsy prices listings in many currencies and publishes no exchange rate.
            </p>
          </div>
        </>
      )}

      {!rows && !run.isPending && (
        <EmptyState icon="📊" title="Bulk keyword comparison" sub="Paste keywords above to compare their real competition side by side" />
      )}
    </div>
  )
}
