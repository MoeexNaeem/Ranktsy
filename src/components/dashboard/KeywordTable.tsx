'use client'
import { memo, useCallback, useMemo, useState } from 'react'
import { MiniTrend } from '@/components/charts/MiniTrend'
import { Star, Check, Popover, PopItem, Toggle, ExportBtn, toCsv, downloadCsv, slugify, HeatPill, ctrlBtn } from './controls'
import { useFavorites } from '@/hooks/useFavorites'
import { C, D, compColor, formatNumber } from '@/utils'
import { MONO, tableCard, tableHead, th, tableRow, tdMono, tdTitle } from './kit'
import type { KeywordData } from '@/types'

type SortKey = keyof Pick<KeywordData, 'avgViews' | 'avgFavorites' | 'favPerView' | 'competition' | 'difficulty' | 'tagOccurrences' | 'charCount' | 'wordCount' | 'googleSearches'>

// Match types mirror how Etsy shoppers actually phrase queries.
type Match = 'default' | 'exact' | 'phrase' | 'broad'
const MATCH_LABEL: Record<Match, string> = {
  default: 'Default', exact: 'Exact', phrase: 'Phrase', broad: 'Broad',
}
const MATCH_HINT: Record<Match, string> = {
  default: 'Every related keyword Etsy surfaced',
  exact:   'Only the keyword itself',
  phrase:  'Contains your full keyword',
  broad:   'Contains any word from your keyword',
}

interface Col {
  id: string
  label: string
  key?: SortKey
  width: string
  /** Locked columns can't be hidden — the table is meaningless without them. */
  locked?: boolean
}

// Column labels state exactly what Etsy measured. There is no "Avg. Searches" or
// "Avg. Clicks" column because Etsy publishes neither — the old ones were listing
// views and favourites wearing those names.
const ALL_COLS: Col[] = [
  { id: 'keyword',  label: 'Keywords',        width: '1.9fr', locked: true },
  { id: 'bymonth',  label: 'Listings / month', width: '1fr' },
  { id: 'comp',     label: 'Etsy Competition', width: '1fr',  key: 'competition' },
  { id: 'kd',       label: 'KD',              width: '0.7fr', key: 'difficulty' },
  { id: 'views',    label: 'Avg. Views',      width: '0.85fr', key: 'avgViews' },
  { id: 'favs',     label: 'Avg. Favorites',  width: '0.85fr', key: 'avgFavorites' },
  { id: 'fpv',      label: 'Favs / View',     width: '0.75fr', key: 'favPerView' },
  { id: 'tags',     label: 'Tag Occurrences', width: '0.8fr', key: 'tagOccurrences' },
  { id: 'chars',    label: 'Chars',           width: '0.55fr', key: 'charCount' },
  { id: 'words',    label: 'Words',           width: '0.55fr', key: 'wordCount' },
  { id: 'google',   label: 'Google Searches', width: '0.85fr', key: 'googleSearches' },
]

const DEFAULT_HIDDEN = new Set(['words'])

const AscIcon  = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
const DescIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
const BothIcon = () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.3}}><polyline points="18 15 12 9 6 15"/><polyline points="6 9 12 15 18 9"/></svg>

function CompCell({ level, value, measuring }: {
  level: KeywordData['competitionLevel']; value: number | null; measuring?: boolean
}) {
  // Competition is probed per keyword AFTER the page paints, so a null here can
  // mean "still measuring" or "Etsy didn't answer" — two different things, and
  // the user shouldn't have to guess which.
  if (value == null || level == null) {
    return measuring
      ? <span className="shimmer" style={{ height: 12, width: 54, borderRadius: 4, background: '#e8e7e2', display: 'inline-block' }} />
      : <span title="Etsy didn't return a listing count for this keyword" style={{ ...tdMono, color: C.stone, cursor: 'help' }}>—</span>
  }
  const { fg, bg } = compColor(level)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 100, background: bg, color: fg, fontSize: 13, fontFamily: MONO, fontWeight: 600, width: 'fit-content' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg, flexShrink: 0 }} />
      {formatNumber(value)}
    </span>
  )
}

const KeywordRow = memo(function KeywordRow({
  row, grid, cols, selected, onToggleSelect, starred, onToggleStar, onSelect, measuring,
}: {
  row: KeywordData; grid: string; cols: Col[]
  selected: boolean; onToggleSelect: () => void
  starred: boolean; onToggleStar: () => void
  onSelect?: (r: KeywordData) => void
  measuring?: boolean
}) {
  const num = (v: number | null, color?: string) =>
    v == null
      ? <span style={{ ...tdMono, color: C.stone }}>—</span>
      : <span style={{ ...tdMono, color: color ?? C.ink }}>{formatNumber(v)}</span>

  const cell = (c: Col) => {
    switch (c.id) {
      case 'keyword':  return <span key={c.id} style={tdTitle}>{row.keyword}</span>
      case 'bymonth':  return <MiniTrend key={c.id} data={row.listingsByMonth} title={`${row.keyword} — listings created per calendar month (Jan→Dec)`} />
      case 'comp':     return <CompCell key={c.id} level={row.competitionLevel} value={row.competition} measuring={measuring} />
      case 'kd':       return row.difficulty != null
                         ? <HeatPill key={c.id} score={row.difficulty} />
                         : measuring
                           ? <span key={c.id} className="shimmer" style={{ height: 12, width: 30, borderRadius: 4, background: '#e8e7e2', display: 'inline-block' }} />
                           : <span key={c.id} style={{ ...tdMono, color: C.stone }}>—</span>
      case 'views':    return <span key={c.id}>{num(row.avgViews, '#2E6DB4')}</span>
      case 'favs':     return <span key={c.id}>{num(row.avgFavorites, D.hard)}</span>
      case 'fpv':      return <span key={c.id} style={tdMono}>{row.favPerView != null ? `${row.favPerView}%` : '—'}</span>
      case 'tags':     return <span key={c.id} style={{ ...tdMono, color: row.tagOccurrences > 0 ? C.ink : C.stone }}>{row.tagOccurrences}</span>
      case 'chars':    return <span key={c.id} style={tdMono}>{row.charCount}</span>
      case 'words':    return <span key={c.id} style={tdMono}>{row.wordCount}</span>
      case 'google':   return <span key={c.id}>{num(row.googleSearches)}</span>
      default:         return <span key={c.id} />
    }
  }

  return (
    <div onClick={() => onSelect?.(row)}
      style={{ ...tableRow(grid), cursor: onSelect ? 'pointer' : 'default', transition: 'background 0.12s', background: selected ? C.orangeFaint : 'transparent' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = C.rowHover }}
      onMouseLeave={e => (e.currentTarget.style.background = selected ? C.orangeFaint : 'transparent')}>
      <Check on={selected} onChange={onToggleSelect} />
      <Star on={starred} onClick={onToggleStar} />
      {cols.map(cell)}
    </div>
  )
})

export const KeywordTable = memo(function KeywordTable({
  rows, query = '', onSelect, measuring,
}: {
  rows: KeywordData[]; query?: string; onSelect?: (r: KeywordData) => void
  /** Competition/KD probes still in flight — cells shimmer instead of showing "—". */
  measuring?: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>('competition')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filter, setFilter]   = useState('')
  const [match, setMatch]     = useState<Match>('default')
  const [tagsOnly, setTagsOnly] = useState(false)
  const [hidden, setHidden]   = useState<Set<string>>(new Set(DEFAULT_HIDDEN))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { isFavorite, toggle, addMany } = useFavorites()

  const cols = useMemo(() => ALL_COLS.filter(c => !hidden.has(c.id)), [hidden])
  // Two fixed lead columns: checkbox + star.
  const grid = useMemo(() => `26px 24px ${cols.map(c => c.width).join(' ')}`, [cols])

  const handleSort = useCallback((key: SortKey) => {
    setSortDir(prev => (sortKey === key && prev === 'desc' ? 'asc' : 'desc'))
    setSortKey(key)
  }, [sortKey])

  const view = useMemo(() => {
    const q = query.toLowerCase().trim()
    const qWords = q.split(/\s+/).filter(Boolean)
    const f = filter.trim().toLowerCase()

    let base = rows
    if (f) base = base.filter(r => r.keyword.toLowerCase().includes(f))
    if (tagsOnly) base = base.filter(r => r.tagOccurrences > 0)

    if (q) {
      if (match === 'exact')  base = base.filter(r => r.keyword.toLowerCase() === q)
      if (match === 'phrase') base = base.filter(r => r.keyword.toLowerCase().includes(q))
      if (match === 'broad')  base = base.filter(r => qWords.some(w => r.keyword.toLowerCase().includes(w)))
    }

    // Nulls (no data) always sort last, regardless of direction — they're absent
    // data, not low values, so they shouldn't win an "ascending" sort.
    const dir = sortDir === 'desc' ? -1 : 1
    return [...base].sort((a, b) => {
      const av = a[sortKey] as number | null
      const bv = b[sortKey] as number | null
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return dir * (av - bv)
    })
  }, [rows, filter, sortKey, sortDir, match, tagsOnly, query])

  const allSelected = view.length > 0 && view.every(r => selected.has(r.keyword))
  const someSelected = view.some(r => selected.has(r.keyword))

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const next = new Set(prev)
      const every = view.length > 0 && view.every(r => next.has(r.keyword))
      view.forEach(r => (every ? next.delete(r.keyword) : next.add(r.keyword)))
      return next
    })
  }, [view])

  const toggleOne = useCallback((kw: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw); else next.add(kw)
      return next
    })
  }, [])

  const exportCsv = useCallback(() => {
    // Export honours the current view, and narrows to the selection if there is one.
    const target = selected.size ? view.filter(r => selected.has(r.keyword)) : view
    const csv = toCsv(
      ['Keyword', 'Etsy competition', 'Competition level', 'KD', 'Avg views', 'Avg favorites', 'Favs per view %', 'Tag occurrences', 'Chars', 'Words', 'Google searches'],
      target.map(r => [r.keyword, r.competition, r.competitionLevel, r.difficulty, r.avgViews, r.avgFavorites, r.favPerView, r.tagOccurrences, r.charCount, r.wordCount, r.googleSearches]),
    )
    downloadCsv(`keywords-${slugify(query)}.csv`, csv)
  }, [view, selected, query])

  const saveSelected = useCallback(() => {
    addMany([...selected])
    setSelected(new Set())
  }, [selected, addMany])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Toolbar */}
      <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.bone, padding: 10, borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '10px 16px', flex: 1, minWidth: 190 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.graphite} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter keywords…"
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14.5, fontFamily: 'inherit', flex: 1, color: C.ink, minWidth: 0 }} />
          {filter && (
            <button onClick={() => setFilter('')} aria-label="Clear filter"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.stone, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
          )}
        </div>

        {/* Match type */}
        <Popover label={<>Match: <strong style={{ fontWeight: 600 }}>{MATCH_LABEL[match]}</strong></>} width={250}>
          {(Object.keys(MATCH_LABEL) as Match[]).map(m => (
            <button key={m} onClick={() => setMatch(m)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: match === m ? C.orangeFaint : 'transparent',
              }}
              onMouseEnter={e => { if (match !== m) e.currentTarget.style.background = C.canvas }}
              onMouseLeave={e => (e.currentTarget.style.background = match === m ? C.orangeFaint : 'transparent')}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: match === m ? C.orange : C.ink, display: 'block' }}>{MATCH_LABEL[m]}</span>
              <span style={{ fontSize: 11.5, color: C.stone }}>{MATCH_HINT[m]}</span>
            </button>
          ))}
        </Popover>

        <Toggle on={tagsOnly} onChange={setTagsOnly} label="Show tags only" />

        {/* Column picker */}
        <Popover label="Columns" width={210}>
          {ALL_COLS.map(c => (
            <PopItem key={c.id} label={c.label} on={!hidden.has(c.id)} disabled={c.locked}
              onClick={() => {
                if (c.locked) return
                setHidden(prev => {
                  const next = new Set(prev)
                  if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                  return next
                })
              }} />
          ))}
        </Popover>

        <ExportBtn onClick={exportCsv} count={selected.size || undefined} />
      </div>

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: C.orangeFaint, border: `1px solid rgba(251,94,9,0.28)`, borderRadius: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500 }}>
            {selected.size} keyword{selected.size === 1 ? '' : 's'} selected
          </span>
          <button onClick={saveSelected} style={{ ...ctrlBtn, height: 34, borderColor: C.orange, color: C.orange }}>★ Save to Favorites</button>
          <button onClick={() => navigator.clipboard?.writeText([...selected].join(', '))} style={{ ...ctrlBtn, height: 34 }}>Copy</button>
          <button onClick={() => setSelected(new Set())} style={{ ...ctrlBtn, height: 34, border: 'none', background: 'transparent', color: C.graphite }}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="rtable" style={tableCard}>
        <div style={tableHead(grid)}>
          <Check on={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} />
          <span />
          {cols.map(({ id, label, key }) => (
            <button key={id} onClick={() => key && handleSort(key)} disabled={!key}
              style={{ ...th, display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: key ? 'pointer' : 'default', padding: 0, textAlign: 'left', fontFamily: MONO }}>
              {label}
              {key && (sortKey === key ? (sortDir === 'desc' ? <DescIcon /> : <AscIcon />) : <BothIcon />)}
            </button>
          ))}
        </div>

        {view.length === 0 ? (
          <div style={{ padding: '44px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: C.ink, fontWeight: 500 }}>No keywords match</p>
            <p style={{ fontSize: 13.5, color: C.graphite, marginTop: 5 }}>
              {tagsOnly ? 'Try turning off “Show tags only”' : match !== 'default' ? `Try a broader match than “${MATCH_LABEL[match]}”` : 'Try clearing the filter'}
            </p>
          </div>
        ) : view.map(row => (
          <KeywordRow key={row.keyword} row={row} grid={grid} cols={cols}
            selected={selected.has(row.keyword)} onToggleSelect={() => toggleOne(row.keyword)}
            starred={isFavorite(row.keyword)} onToggleStar={() => toggle(row.keyword)}
            onSelect={onSelect} measuring={measuring} />
        ))}
      </div>

      {/* Footer legend */}
      <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>
          {view.length} keyword{view.length === 1 ? '' : 's'}{view.length !== rows.length ? ` of ${rows.length}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: C.stone, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.05em' }}>KD</span>
          {[{ l: 'Easy', c: D.good }, { l: 'Moderate', c: D.mid }, { l: 'Hard', c: D.hard }].map(x => (
            <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.graphite }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.c }} />{x.l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
})
