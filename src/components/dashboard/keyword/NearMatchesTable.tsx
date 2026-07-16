'use client'
import { memo, useCallback, useMemo, useState } from 'react'
import { MiniTrend } from '@/components/charts/MiniTrend'
import { Star, ExportBtn, toCsv, downloadCsv, slugify, HeatPill } from '../controls'
import { useFavorites } from '@/hooks/useFavorites'
import { MONO, tableCard, tableHead, th, tableRow, tdMono, tdTitle, EmptyState } from '../kit'
import { C, D, compColor, formatNumber } from '@/utils'
import type { NearMatch } from '@/types'

const GRID = '28px 1.7fr 0.85fr 0.75fr 0.7fr 0.65fr 0.95fr 0.6fr 0.75fr'

const KIND_LABEL: Record<NearMatch['kind'], string> = {
  exact:    'your keyword',
  plural:   'plural',
  singular: 'singular',
  hyphen:   'hyphenated',
  spacing:  'no space',
  order:    'word order',
}

type SortKey = 'avgViews' | 'avgFavorites' | 'favPerView' | 'competition' | 'difficulty' | 'tagOccurrences'

// Real Etsy measurements only — no searches/clicks/CTR, which Etsy doesn't publish.
const COLS: { label: string; key?: SortKey }[] = [
  { label: 'Keywords' },
  { label: 'Listings / month' },
  { label: 'Etsy Competition', key: 'competition' },
  { label: 'KD',              key: 'difficulty' },
  { label: 'Avg. Views',      key: 'avgViews' },
  { label: 'Avg. Favorites',  key: 'avgFavorites' },
  { label: 'Favs / View',     key: 'favPerView' },
  { label: 'Tag Occurrences', key: 'tagOccurrences' },
]

const AscIcon  = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
const DescIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
const BothIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.3}}><polyline points="18 15 12 9 6 15"/><polyline points="6 9 12 15 18 9"/></svg>

function CompCell({ level, value }: { level: NearMatch['competitionLevel']; value: number }) {
  const { fg, bg } = compColor(level)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 100, background: bg, color: fg, fontSize: 13, fontFamily: MONO, fontWeight: 600, width: 'fit-content' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg, flexShrink: 0 }} />
      {formatNumber(value)}
    </span>
  )
}

export const NearMatchesTable = memo(function NearMatchesTable({
  rows, onSelect,
}: { rows: NearMatch[]; onSelect?: (kw: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('competition')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const { isFavorite, toggle } = useFavorites()

  const handleSort = useCallback((key: SortKey) => {
    setSortDir(prev => (sortKey === key && prev === 'desc' ? 'asc' : 'desc'))
    setSortKey(key)
  }, [sortKey])

  const view = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      // Unknowns last in both directions — absent data isn't a low value.
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return dir * (av - bv)
    })
  }, [rows, sortKey, sortDir])

  const exportCsv = useCallback(() => {
    const csv = toCsv(
      ['Keyword', 'Variant type', 'Etsy competition', 'Competition level', 'KD', 'Avg views', 'Avg favorites', 'Favs per view %', 'Tag occurrences'],
      view.map(r => [r.keyword, KIND_LABEL[r.kind], r.competition, r.competitionLevel, r.difficulty, r.avgViews, r.avgFavorites, r.favPerView, r.tagOccurrences]),
    )
    downloadCsv(`near-matches-${slugify(rows[0]?.variantOf ?? 'keyword')}.csv`, csv)
  }, [view, rows])

  if (!rows.length) {
    return <EmptyState icon="🔤" title="No near matches" sub="No spelling or plural variants of this keyword returned Etsy results." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.5, maxWidth: 560 }}>
          Plurals, hyphenation and word-order variants of <strong style={{ color: C.ink }}>&ldquo;{rows[0]?.variantOf}&rdquo;</strong>.
          Each one is measured against its own live Etsy search — so <strong style={{ color: C.ink }}>Etsy Competition</strong> is a real listing total, not an estimate.
        </p>
        <ExportBtn onClick={exportCsv} count={view.length} />
      </div>

      <div className="rtable" style={tableCard}>
        <div style={tableHead(GRID)}>
          <span />
          {COLS.map(({ label, key }) => (
            <button key={label} onClick={() => key && handleSort(key)} disabled={!key}
              style={{ ...th, display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: key ? 'pointer' : 'default', padding: 0, textAlign: 'left', fontFamily: MONO }}>
              {label}
              {key && (sortKey === key ? (sortDir === 'desc' ? <DescIcon /> : <AscIcon />) : <BothIcon />)}
            </button>
          ))}
        </div>

        {view.map(r => (
          <div key={r.keyword}
            onClick={() => onSelect?.(r.keyword)}
            style={{ ...tableRow(GRID), cursor: onSelect ? 'pointer' : 'default', transition: 'background 0.12s', background: r.kind === 'exact' ? C.orangeFaint : 'transparent' }}
            onMouseEnter={e => { if (r.kind !== 'exact') e.currentTarget.style.background = C.rowHover }}
            onMouseLeave={e => (e.currentTarget.style.background = r.kind === 'exact' ? C.orangeFaint : 'transparent')}>
            <Star on={isFavorite(r.keyword)} onClick={() => toggle(r.keyword)} />
            <span style={{ minWidth: 0 }}>
              <span style={{ ...tdTitle, display: 'block' }}>{r.keyword}</span>
              <span style={{ fontSize: 11, fontFamily: MONO, color: r.kind === 'exact' ? C.orange : C.stone }}>{KIND_LABEL[r.kind]}</span>
            </span>
            <MiniTrend data={r.listingsByMonth} title={`${r.keyword} — listings created per calendar month (Jan→Dec)`} />
            <CompCell level={r.competitionLevel} value={r.competition} />
            <HeatPill score={r.difficulty} />
            <span style={{ ...tdMono, color: r.avgViews != null ? '#2E6DB4' : C.stone }}>{r.avgViews != null ? formatNumber(r.avgViews) : '—'}</span>
            <span style={{ ...tdMono, color: r.avgFavorites != null ? D.hard : C.stone }}>{r.avgFavorites != null ? formatNumber(r.avgFavorites) : '—'}</span>
            <span style={tdMono}>{r.favPerView != null ? `${r.favPerView}%` : '—'}</span>
            <span style={tdMono}>{r.tagOccurrences}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
