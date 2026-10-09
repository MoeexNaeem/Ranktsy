'use client'
/**
 * Rank Movement → "What climbers did differently": for one keyword, how common
 * each measured trait is among the listings that climbed vs the ones that dropped.
 * Counts only include listings where the trait was observed, so unknown never
 * reads as "no". It shows what moved together with rank, never a cause.
 */
import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MONO } from '../kit'
import { Shimmer } from '../skeletons'
import { AiInsights } from '../AiInsights'
import { C, D } from '@/utils'
import type { ApiResponse, AiFact } from '@/types'
import type { MoverComparison, CompareRow } from '@/lib/rank-explain'

export interface CompareMover { listingId: number; change: number; firstDay: string; latestDay: string }

const share = (g: { yes: number; known: number }) => (g.known ? g.yes / g.known : null)
/** Percentage-point gap between climbers and droppers; null unless both were measured. */
const gap = (r: CompareRow) => {
  const a = share(r.climbers), b = share(r.droppers)
  return a == null || b == null ? null : Math.round((a - b) * 100)
}

function Cell({ g, color }: { g: { yes: number; known: number }; color: string }) {
  const s = share(g)
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ height: 6, borderRadius: 4, background: C.hair, overflow: 'hidden' }}>
        {s != null && <div style={{ width: `${Math.max(s * 100, s > 0 ? 4 : 0)}%`, height: '100%', background: color, borderRadius: 4 }} />}
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 12, fontFamily: MONO, color: g.known ? C.ink : C.stone }}>
        {g.known ? `${g.yes} of ${g.known}` : '-'}
      </p>
    </div>
  )
}

const GRID = 'minmax(170px, 1.5fr) 1fr 1fr minmax(120px, 0.9fr)'

export const RankCompareCard = memo(function RankCompareCard({ query, movers }: { query: string; movers: CompareMover[] }) {
  const moving = useMemo(() => movers.filter(m => m.change !== 0).map(m => ({ listingId: m.listingId, change: m.change, firstDay: m.firstDay, latestDay: m.latestDay })), [movers])
  const q = useQuery({
    queryKey: ['rank-compare', query.toLowerCase().trim(), moving.map(m => `${m.listingId}:${m.change}`).join(',')],
    queryFn: async ({ signal }) => {
      const r = await fetch('/api/etsy/rank-compare', {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: query, movers: moving }),
      })
      const j = (await r.json()) as ApiResponse<MoverComparison>
      if (!j.success || !j.data) throw new Error(j.error ?? 'Failed')
      return j.data
    },
    enabled: moving.length >= 2,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  })

  // Strongest differences first. Traits no listing had on either side get one
  // summary line instead of a row of zeros.
  const all = useMemo(() => [...(q.data?.rows ?? [])].sort((a, b) => Math.abs(gap(b) ?? 0) - Math.abs(gap(a) ?? 0)), [q.data])
  const rows = useMemo(() => all.filter(r => r.climbers.yes + r.droppers.yes > 0), [all])
  const nobody = useMemo(() => all.filter(r => r.climbers.yes + r.droppers.yes === 0), [all])

  const facts: AiFact[] = useMemo(() => {
    const d = q.data
    if (!d) return []
    return [
      { label: 'Listings that climbed', value: String(d.climbers) },
      { label: 'Listings that dropped', value: String(d.droppers) },
      ...(d.digitalShare != null ? [{ label: 'Digital downloads among these listings', value: `${d.digitalShare}%` }] : []),
      ...all.filter(r => r.climbers.known + r.droppers.known >= 2).slice(0, 20).map(r => ({
        label: r.label,
        value: `climbers ${r.climbers.yes} of ${r.climbers.known}, droppers ${r.droppers.yes} of ${r.droppers.known}`,
      })),
    ]
  }, [q.data, all])

  if (moving.length < 2) return null
  if (q.isLoading) {
    return <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>{[34, 34, 34, 34].map((h, i) => <Shimmer key={i} h={h} r={8} />)}</div>
  }
  if (q.isError || !q.data || !all.length || q.data.climbers + q.data.droppers < 2) return null
  const d = q.data

  return (
    <>
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650, color: C.ink }}>What climbers did differently</h3>
          <span style={{ fontSize: 11.5, fontFamily: MONO, color: C.graphite }}>
            <span style={{ color: D.good }}>{d.climbers} climbed</span> · <span style={{ color: D.hard }}>{d.droppers} dropped</span>
          </span>
        </div>
        <div className="rtable" style={{ border: `1px solid ${C.hair}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '9px 14px', background: C.canvas }}>
            {['Measured on the listing', 'Climbers', 'Droppers', ''].map(h => (
              <span key={h || 'gap'} style={{ fontSize: 10.5, fontFamily: MONO, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {rows.map(r => {
            const g = gap(r)
            const strong = g != null && Math.abs(g) >= 25 && r.climbers.known >= 2 && r.droppers.known >= 2
            return (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, alignItems: 'center', padding: '10px 14px', borderTop: `1px solid ${C.hair}` }}>
                <span style={{ fontSize: 13, color: C.ink, fontWeight: strong ? 600 : 500 }}>{r.label}</span>
                <Cell g={r.climbers} color={D.good} />
                <Cell g={r.droppers} color={D.hard} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: strong ? (g! > 0 ? D.good : D.hard) : C.stone }}>
                  {strong ? (g! > 0 ? 'More common in climbers' : 'More common in droppers') : ''}
                </span>
              </div>
            )
          })}
        </div>
        {nobody.length > 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: C.graphite, lineHeight: 1.55 }}>
            Not seen on any of these listings this period: {nobody.map(r => r.label.charAt(0).toLowerCase() + r.label.slice(1)).join(', ')}.
          </p>
        )}
      </div>
      {facts.length >= 4 && (
        <div style={{ marginTop: 16 }}>
          <AiInsights
            tool="Rank Movement"
            subject={query}
            facts={facts}
            notes="Etsy listings ranking for this keyword over the last 30 days. Each count is measured: how many climbers vs droppers had the trait. This is correlation, never say a trait caused a move. Turn the clearest differences into practical steps a seller can take on their own listing for this keyword. If most listings are digital downloads, do not suggest packaging or shipping."
          />
        </div>
      )}
    </>
  )
})
