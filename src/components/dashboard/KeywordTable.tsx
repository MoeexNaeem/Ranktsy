'use client'
import { memo, useCallback, useMemo, useState } from 'react'
import { MiniTrend }    from '@/components/charts/MiniTrend'
import { C, formatNumber } from '@/utils'
import { MONO, tableCard, tableHead, th, tableRow, tdMono, tdTitle, CompBadge } from './kit'
import type { KeywordData } from '@/types'

type SortKey = keyof Pick<KeywordData, 'avgSearches' | 'avgClicks' | 'avgCtr' | 'competition' | 'difficulty' | 'tagOccurrences' | 'charCount' | 'googleSearches'>
type SortDir = 'asc' | 'desc'

const COLS: { label: string; key?: SortKey }[] = [
  { label: 'Keyword' },
  { label: 'Trend' },
  { label: 'Searches',    key: 'avgSearches' },
  { label: 'Clicks',      key: 'avgClicks' },
  { label: 'CTR',         key: 'avgCtr' },
  { label: 'Competition', key: 'competition' },
  { label: 'KD',          key: 'difficulty' },
  { label: 'Tag Occ',     key: 'tagOccurrences' },
  { label: 'Chars',       key: 'charCount' },
  { label: 'Google',      key: 'googleSearches' },
]

const ROW_GRID = '1.9fr 1fr 0.8fr 0.75fr 0.65fr 0.9fr 0.7fr 0.75fr 0.6fr 0.8fr'

const AscIcon  = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
const DescIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
const BothIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.3}}><polyline points="18 15 12 9 6 15"/><polyline points="6 9 12 15 18 9"/></svg>

function kdColor(d: number): string { return d < 34 ? C.warn : d < 67 ? C.orange : C.danger }

const KeywordRow = memo(function KeywordRow({ row, onSelect }: { row: KeywordData; onSelect?: (r: KeywordData) => void }) {
  return (
    <div onClick={() => onSelect?.(row)}
      style={{ ...tableRow(ROW_GRID), cursor: 'pointer', transition: 'background 0.12s' }}
      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <span style={tdTitle}>{row.keyword}</span>
      <MiniTrend data={row.trend} />
      <span style={tdMono}>{formatNumber(row.avgSearches)}</span>
      <span style={tdMono}>{formatNumber(row.avgClicks)}</span>
      <span style={tdMono}>{row.avgCtr !== null ? `${row.avgCtr}%` : '—'}</span>
      <CompBadge level={row.competitionLevel} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontFamily: MONO, color: kdColor(row.difficulty), fontWeight: 600 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: kdColor(row.difficulty), display: 'inline-block' }} />{row.difficulty}
      </span>
      <span style={tdMono}>{row.tagOccurrences}</span>
      <span style={tdMono}>{row.charCount}</span>
      <span style={{ ...tdMono, color: row.googleSearches != null ? C.ink : C.stone }}>{row.googleSearches != null ? formatNumber(row.googleSearches) : '—'}</span>
    </div>
  )
})

export const KeywordTable = memo(function KeywordTable({ rows, onSelect }: { rows: KeywordData[]; onSelect?: (r: KeywordData) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('avgSearches')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filter, setFilter]   = useState('')

  const handleSort = useCallback((key: SortKey) => {
    setSortDir(prev => (sortKey === key && prev === 'desc' ? 'asc' : 'desc'))
    setSortKey(key)
  }, [sortKey])

  const view = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const base = f ? rows.filter(r => r.keyword.toLowerCase().includes(f)) : rows
    return [...base].sort((a, b) => (sortDir === 'desc' ? -1 : 1) * (((a[sortKey] as number) ?? -Infinity) - ((b[sortKey] as number) ?? -Infinity)))
  }, [rows, filter, sortKey, sortDir])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Filter bar */}
      <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '10px 16px', maxWidth: 360, flex: 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.graphite} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter keywords…"
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit', flex: 1, color: C.ink, minWidth: 0 }} />
        </div>
        <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite, whiteSpace: 'nowrap' }}>{view.length} keyword{view.length === 1 ? '' : 's'}</span>
      </div>

      <div className="rtable" style={tableCard}>
        <div style={tableHead(ROW_GRID)}>
          {COLS.map(({ label, key }) => (
            <button key={label} onClick={() => key && handleSort(key)} disabled={!key}
              style={{ ...th, display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: key ? 'pointer' : 'default', padding: 0, textAlign: 'left' as const, fontFamily: MONO }}>
              {label}
              {key && (sortKey === key ? (sortDir === 'desc' ? <DescIcon/> : <AscIcon/>) : <BothIcon/>)}
            </button>
          ))}
        </div>
        {view.map(row => <KeywordRow key={row.keyword} row={row} onSelect={onSelect} />)}
      </div>
    </div>
  )
})
