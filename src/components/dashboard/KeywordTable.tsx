'use client'
import { memo, useCallback, useMemo, useState } from 'react'
import { MiniTrend }    from '@/components/charts/MiniTrend'
import { C, formatNumber } from '@/utils'
import type { KeywordData } from '@/types'

type SortKey = keyof Pick<KeywordData,'avgSearches'|'avgClicks'|'avgCtr'|'competition'>
type SortDir = 'asc'|'desc'

const COMP: Record<string,{bg:string;color:string}> = {
  Low:  { bg:'rgba(105,142,121,0.15)', color:'#698e79' },
  Med:  { bg:'rgba(159,153,91,0.15)',  color:'#7a7320' },
  High: { bg:'rgba(28,58,19,0.1)',     color:'#1c3a13' },
}

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
  const cs = COMP[row.competitionLevel]
  return (
    <div onClick={()=>onSelect?.(row)}
      style={{ display:'grid', gridTemplateColumns:ROW_GRID, gap:8, padding:'7px 12px', borderBottom:'1px solid rgba(0,0,0,0.04)', alignItems:'center', cursor:'pointer', transition:'background 0.12s' }}
      onMouseEnter={e=>(e.currentTarget.style.background='rgba(238,238,233,0.55)')}
      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
      <span style={{ fontSize:12.5, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.keyword}</span>
      <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#555' }}>{formatNumber(row.avgSearches)}</span>
      <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#555' }}>{formatNumber(row.avgClicks)}</span>
      <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono',monospace", color:'#555' }}>{row.avgCtr}%</span>
      <span style={{ display:'inline-flex', padding:'2px 9px', borderRadius:999, fontSize:10, fontWeight:500, background:cs.bg, color:cs.color, width:'fit-content' }}>
        {row.competitionLevel}
      </span>
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
    [...rows].sort((a,b) => (sortDir==='desc'?-1:1) * (a[sortKey]-b[sortKey])),
    [rows, sortKey, sortDir]
  )

  return (
    <div style={{ background:C.snow, border:'1px solid rgba(0,0,0,0.07)', borderRadius:12, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:ROW_GRID, gap:8, padding:'8px 12px', borderBottom:'1px solid rgba(0,0,0,0.08)', background:'#f8f8f4' }}>
        {COLS.map(({ label, key }) => (
          <button key={label} onClick={()=>key&&handleSort(key)} disabled={!key}
            style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, fontFamily:"'IBM Plex Mono',monospace", textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'#aaa', background:'none', border:'none', cursor:key?'pointer':'default', padding:0, textAlign:'left' as const }}>
            {label}
            {key && (sortKey===key ? (sortDir==='desc'?<DescIcon/>:<AscIcon/>) : <BothIcon/>)}
          </button>
        ))}
      </div>
      {sorted.map(row=><KeywordRow key={row.keyword} row={row} onSelect={onSelect} />)}
    </div>
  )
})
