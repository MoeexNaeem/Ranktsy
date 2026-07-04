'use client'
import { memo, useCallback, useMemo, useState } from 'react'
import { MiniTrend }    from '@/components/charts/MiniTrend'
import { C, formatNumber } from '@/utils'
import { MONO, tableCard, tableHead, th, tableRow, tdMono, tdTitle, CompBadge } from './kit'
import type { KeywordData } from '@/types'

type SortKey = keyof Pick<KeywordData,'avgSearches'|'avgClicks'|'avgCtr'|'competition'>
type SortDir = 'asc'|'desc'

const COLS: { label:string; key?:SortKey }[] = [
  { label:'Keyword' },
  { label:'Searches', key:'avgSearches' },
  { label:'Clicks',   key:'avgClicks'   },
  { label:'CTR',      key:'avgCtr'      },
  { label:'Competition', key:'competition' },
  { label:'Trend' },
]

const AscIcon  = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
const DescIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
const BothIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.3}}><polyline points="18 15 12 9 6 15"/><polyline points="6 9 12 15 18 9"/></svg>

const ROW_GRID = '2fr 0.8fr 0.8fr 0.65fr 0.75fr 1fr'

const KeywordRow = memo(function KeywordRow({ row, onSelect }: { row:KeywordData; onSelect?:(r:KeywordData)=>void }) {
  return (
    <div onClick={()=>onSelect?.(row)}
      style={{ ...tableRow(ROW_GRID), cursor:'pointer', transition:'background 0.12s' }}
      onMouseEnter={e=>(e.currentTarget.style.background=C.rowHover)}
      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
      <span style={tdTitle}>{row.keyword}</span>
      <span style={tdMono}>{formatNumber(row.avgSearches)}</span>
      <span style={tdMono}>{formatNumber(row.avgClicks)}</span>
      <span style={tdMono}>{row.avgCtr !== null ? `${row.avgCtr}%` : '—'}</span>
      <CompBadge level={row.competitionLevel} />
      <MiniTrend data={row.trend} />
    </div>
  )
})

export const KeywordTable = memo(function KeywordTable({ rows, onSelect }: { rows:KeywordData[]; onSelect?:(r:KeywordData)=>void }) {
  const [sortKey, setSortKey] = useState<SortKey>('avgSearches')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = useCallback((key:SortKey) => {
    setSortDir(prev => sortKey===key && prev==='desc' ? 'asc' : 'desc')
    setSortKey(key)
  }, [sortKey])

  const sorted = useMemo(() =>
    [...rows].sort((a,b) => (sortDir==='desc'?-1:1) * ((a[sortKey] ?? -Infinity) - (b[sortKey] ?? -Infinity))),
    [rows, sortKey, sortDir]
  )

  return (
    <div style={tableCard}>
      {/* Header */}
      <div style={tableHead(ROW_GRID)}>
        {COLS.map(({ label, key }) => (
          <button key={label} onClick={()=>key&&handleSort(key)} disabled={!key}
            style={{ ...th, display:'flex', alignItems:'center', gap:3, background:'none', border:'none', cursor:key?'pointer':'default', padding:0, textAlign:'left' as const, fontFamily:MONO }}>
            {label}
            {key && (sortKey===key ? (sortDir==='desc'?<DescIcon/>:<AscIcon/>) : <BothIcon/>)}
          </button>
        ))}
      </div>
      {sorted.map(row=><KeywordRow key={row.keyword} row={row} onSelect={onSelect} />)}
    </div>
  )
})
