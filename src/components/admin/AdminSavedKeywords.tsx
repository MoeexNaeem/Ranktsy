'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Admin: "Saved Keywords" - every keyword users run through Keyword Search, saved
 * to `savedkeywordsfromusers`. Pick any date (or all dates) to see what was
 * searched, then export the current view to CSV.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { C } from '@/utils'
import { MONO, SectionTitle, StatCard, EmptyState, tableCard, tableHead, th, tableRow } from '@/components/dashboard/kit'

interface DayCount { day: string; count: number }
interface KeywordRow { keyword: string; count: number; countries: string[]; users: string[]; lastAt: string | null; day?: string }
interface Payload { days: DayCount[]; selectedDay: string; total: number; keywords: KeywordRow[] }

const PAGE = 25
const prettyDay = (d: string) => {
  if (d === 'all') return 'All dates'
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'

export function AdminSavedKeywords() {
  const [data, setData]   = useState<Payload | null>(null)
  const [day, setDay]     = useState<string>('')   // '' = default (latest), 'all', or YYYY-MM-DD
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [page, setPage]   = useState(1)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async (d: string) => {
    setState('loading')
    try {
      const r = await fetch(`/api/admin/saved-keywords${d ? `?day=${encodeURIComponent(d)}` : ''}`)
      const j = await r.json()
      if (r.ok && j?.success) { setData(j.data); setDay(j.data.selectedDay); setState('ok'); setPage(1) }
      else setState('error')
    } catch { setState('error') }
  }, [])

  useEffect(() => { load('') }, [load])

  const isAll = day === 'all'
  const keywords = useMemo(() => data?.keywords ?? [], [data])
  const pageCount = Math.max(1, Math.ceil(keywords.length / PAGE))
  const pageRows = useMemo(() => keywords.slice((page - 1) * PAGE, page * PAGE), [keywords, page])
  const uniqueKw = keywords.length
  const GRID = isAll ? '1fr 2.4fr 0.7fr 1.2fr 1.6fr' : '2.6fr 0.7fr 1fr 1.7fr 1.3fr'

  const exportCsv = useCallback(async (scope: string) => {
    setExporting(true)
    try {
      const r = await fetch(`/api/admin/saved-keywords?day=${encodeURIComponent(scope)}&format=csv`)
      if (!r.ok) return
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = scope === 'all' ? 'saved-keywords-all.csv' : `saved-keywords-${scope}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }, [])

  const btn = (active: boolean): React.CSSProperties => ({
    height: 34, padding: '0 13px', borderRadius: 100, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit',
    cursor: 'pointer', border: `1px solid ${active ? C.orange : C.ash}`,
    background: active ? C.orange : C.paper, color: active ? '#fff' : C.ink, whiteSpace: 'nowrap',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <StatCard label="Searches in view" value={(data?.total ?? 0).toLocaleString()} accent={C.orange} />
        <StatCard label="Unique keywords" value={uniqueKw.toLocaleString()} accent="#2563EB" />
        <StatCard label="Days tracked" value={String(data?.days.length ?? 0)} accent="#7C3AED" />
      </div>

      {/* Date picker + export */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <input
          type="date"
          value={isAll ? '' : day}
          onChange={e => e.target.value && load(e.target.value)}
          style={{ height: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}
        />
        <button onClick={() => load('all')} style={btn(isAll)}>All dates</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button onClick={() => exportCsv(day || 'all')} disabled={exporting || !uniqueKw}
            style={{ ...btn(false), height: 40, opacity: (exporting || !uniqueKw) ? 0.6 : 1 }}>
            {exporting ? 'Exporting…' : isAll ? 'Export all' : 'Export this date'}
          </button>
          {!isAll && (
            <button onClick={() => exportCsv('all')} disabled={exporting}
              style={{ ...btn(false), height: 40, opacity: exporting ? 0.6 : 1 }}>
              Export all dates
            </button>
          )}
        </div>
      </div>

      {/* Recent days as quick chips */}
      {data && data.days.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data.days.slice(0, 14).map(d => (
            <button key={d.day} onClick={() => load(d.day)} style={btn(!isAll && d.day === day)}>
              {prettyDay(d.day)} <span style={{ fontFamily: MONO, opacity: 0.7 }}>· {d.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div>
        <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: '#808080' }}>{prettyDay(isAll ? 'all' : day)}</span>}>
          Keywords searched
        </SectionTitle>

        {state === 'loading' && <p style={{ fontSize: 13, color: '#808080', padding: '18px 2px' }}>Loading…</p>}
        {state === 'error' && <EmptyState icon="⚠️" title="Could not load" sub="Please try again." />}
        {state === 'ok' && keywords.length === 0 && (
          <EmptyState icon="🔍" title="No keywords for this date" sub="Pick another date, or choose All dates." />
        )}

        {state === 'ok' && keywords.length > 0 && (
          <>
            <div className="rtable" style={tableCard}>
              <div style={tableHead(GRID)}>
                {(isAll ? ['Date', 'Keyword', 'Searches', 'Countries', 'Last searched'] : ['Keyword', 'Searches', 'Countries', 'Searched by', 'Last searched']).map((h, i) => (
                  <span key={i} style={th}>{h}</span>
                ))}
              </div>
              {pageRows.map((k, i) => (
                <div key={(k.day ?? '') + k.keyword} style={{ ...tableRow(GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                  {isAll && <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#808080' }}>{k.day}</span>}
                  <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.keyword}</span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: C.orange, fontWeight: 600 }}>{k.count}</span>
                  <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#666' }}>{k.countries.join(', ') || '-'}</span>
                  {!isAll && <span style={{ fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k.users.join(', ')}>{k.users.length ? (k.users.length > 1 ? `${k.users.length} users` : k.users[0]) : 'Guest'}</span>}
                  <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#808080' }}>{fmtTime(k.lastAt)}</span>
                </div>
              ))}
            </div>

            {pageCount > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ ...btn(false), opacity: page === 1 ? 0.5 : 1 }}>← Prev</button>
                <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#808080' }}>Page {page} / {pageCount}</span>
                <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} style={{ ...btn(false), opacity: page === pageCount ? 0.5 : 1 }}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
