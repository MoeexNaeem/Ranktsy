'use client'
import { memo, useMemo, useState } from 'react'
import { Chart as ChartJS, LinearScale, CategoryScale, BarElement, PointElement, ArcElement, Tooltip, BubbleController, type ChartOptions } from 'chart.js'
import { Doughnut, Bubble } from 'react-chartjs-2'
import { ResponsiveContainer, BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell, LabelList } from 'recharts'
import { C, D, formatNumber } from '@/utils'

ChartJS.register(LinearScale, CategoryScale, BarElement, PointElement, ArcElement, Tooltip, BubbleController)

const SANS = "'General Sans',sans-serif"

// ─── Opportunity Bar Chart - a big, readable horizontal bar graph ────────────
// Related keywords ranked by an Opportunity score (real search demand balanced
// against ranking difficulty). Horizontal bars so long keyword names fit, coloured
// by tier, sized big so it reads at a glance. Hover any bar for the real numbers.
export interface OppPoint {
  label: string
  x: number                 // demand: real Google search volume, or avg-favorites buyer pull
  kd: number                // ranking difficulty 0–100
  competition?: number | null
  compLevel?: 'Low' | 'Med' | 'High' | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OppTip({ active, payload, unit }: any) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload as OppPoint & { opp: number }
  const line = (l: string, v: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 12, color: C.graphite, lineHeight: 1.8 }}><span>{l}</span><strong style={{ color: C.ink }}>{v}</strong></div>
  )
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.hair}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(20,18,14,0.16)', padding: '10px 13px', fontFamily: SANS, minWidth: 190 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{r.label}</div>
      {line('Opportunity', `${r.opp} / 100`)}
      {line('Demand', `${formatNumber(Math.round(r.x))} ${unit}`)}
      {line('Difficulty', `KD ${Math.round(r.kd)}`)}
      {r.competition != null && line('Competing', `${formatNumber(r.competition)}${r.compLevel ? ` · ${r.compLevel}` : ''}`)}
    </div>
  )
}

export const OpportunityBarChart = memo(function OpportunityBarChart({ points, unit = 'searches/mo', limit = 10 }: { points: OppPoint[]; unit?: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo(() => {
    const maxVol = Math.max(...points.map(p => p.x), 1)
    return points
      .map(p => {
        const demand = Math.max(p.x, 0) / maxVol
        const ease = Math.max(100 - p.kd, 0) / 100
        // Geometric mean rewards keywords strong on BOTH axes and spreads the field.
        return { ...p, opp: Math.round(100 * Math.sqrt(demand * ease)) }
      })
      .sort((a, b) => b.opp - a.opp)
  }, [points])

  // Cap the chart at `limit` bars so it stays a readable size no matter how many
  // related keywords come back; "Show all" expands to the full ranked list.
  const visible = useMemo(() => (expanded ? rows : rows.slice(0, limit)), [rows, expanded, limit])
  const barColor = (o: number) => o >= 40 ? D.good : o >= 20 ? D.mid : D.hard

  if (!points.length) return null
  // Height tracks only the VISIBLE bars, so the card never balloons.
  const height = Math.max(visible.length * 34 + 60, 220)
  const hasMore = rows.length > limit

  return (
    <div>
      <div style={{ position: 'relative', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={visible} margin={{ top: 4, right: 44, bottom: 22, left: 4 }} barCategoryGap="26%">
            <CartesianGrid stroke="rgba(61,62,59,0.06)" horizontal={false} />
            <XAxis type="number" domain={[0, 'dataMax']} tick={{ fontSize: 11, fill: C.graphite, fontFamily: SANS }} tickLine={false} axisLine={{ stroke: 'rgba(61,62,59,0.06)' }}
              label={{ value: 'Opportunity score  (higher = better target)', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: C.graphite, fontFamily: SANS } }} />
            <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12.5, fill: C.ink, fontFamily: SANS }} tickLine={false} axisLine={false} interval={0} />
            <RTooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<OppTip unit={unit} />} />
            <RBar dataKey="opp" radius={[0, 5, 5, 0]} barSize={22} isAnimationActive={false}>
              {visible.map((r, i) => <Cell key={i} fill={barColor(r.opp)} />)}
              <LabelList dataKey="opp" position="right" style={{ fontSize: 11, fontWeight: 700, fill: C.graphite, fontFamily: SANS }} />
            </RBar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Legend so the tier colours read without hovering */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
        {[{ l: 'Strong opportunity', c: D.good }, { l: 'Moderate', c: D.mid }, { l: 'Tough', c: D.hard }].map(x => (
          <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.graphite, fontFamily: SANS }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: x.c }} />{x.l}
          </span>
        ))}
        {hasMore ? (
          <button onClick={() => setExpanded(e => !e)}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontFamily: SANS, fontWeight: 500, color: C.orange, background: C.orangeFaint, border: `1px solid ${C.orange}`, borderRadius: 100, padding: '6px 14px', cursor: 'pointer' }}>
            {expanded ? `Show top ${limit}` : `Show all ${rows.length} keywords`}
            <span style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'inline-flex' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </span>
          </button>
        ) : (
          <span style={{ fontSize: 11.5, color: C.stone, fontFamily: SANS, marginLeft: 'auto' }}>Hover a bar for search volume, KD & competition.</span>
        )}
      </div>
    </div>
  )
})

// ─── Mix donut with a centred total (competition breakdown, etc.) ────────────
export interface Segment { label: string; value: number; color: string }

// ─── Bubble chart - x vs y, bubble size = a third metric (leaderboards) ──────
export interface BubblePoint { x: number; y: number; r: number; label: string; color: string }

export const BubbleChart = memo(function BubbleChart({ points, xLabel, yLabel }: { points: BubblePoint[]; xLabel: string; yLabel: string }) {
  const data = useMemo(() => ({
    datasets: [{
      data: points,
      backgroundColor: points.map(p => p.color + 'cc'),
      borderColor: '#fff', borderWidth: 1.5, hoverBorderWidth: 2,
    }],
  }), [points])

  const options = useMemo<ChartOptions<'bubble'>>(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: C.ink, padding: 11, cornerRadius: 8,
        titleFont: { size: 13, family: SANS }, bodyFont: { size: 12.5, family: SANS },
        callbacks: {
          title: (items) => points[items[0].dataIndex]?.label ?? '',
          label: (ctx) => `${xLabel}: ${formatNumber(Math.round(ctx.parsed.x ?? 0))} · ${yLabel}: ${formatNumber(Math.round(ctx.parsed.y ?? 0))}`,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: xLabel, font: { size: 12, family: SANS }, color: C.graphite }, grid: { color: 'rgba(61,62,59,0.06)' }, ticks: { font: { size: 11, family: SANS }, color: C.graphite, callback: (v) => formatNumber(Number(v)) }, border: { display: false } },
      y: { title: { display: true, text: yLabel, font: { size: 12, family: SANS }, color: C.graphite }, grid: { color: 'rgba(61,62,59,0.06)' }, ticks: { font: { size: 11, family: SANS }, color: C.graphite, callback: (v) => formatNumber(Number(v)) }, border: { display: false } },
    },
  }), [points, xLabel, yLabel])

  return <div style={{ position: 'relative', height: 320 }}><Bubble data={data} options={options} /></div>
})

export const MixDonut = memo(function MixDonut({ segments, centerLabel = 'keywords' }: { segments: Segment[]; centerLabel?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const data = useMemo(() => ({
    labels: segments.map(s => s.label),
    datasets: [{ data: segments.map(s => s.value), backgroundColor: segments.map(s => s.color), borderWidth: 2, borderColor: '#fff' }],
  }), [segments])
  const options = useMemo<ChartOptions<'doughnut'>>(() => ({
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: C.ink, padding: 10, cornerRadius: 8, bodyFont: { size: 12.5, family: SANS } },
    },
  }), [segments])
  return (
    <div style={{ position: 'relative', height: 168 }}>
      <Doughnut data={data} options={options} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: 30, fontWeight: 500, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em' }}>{total}</span>
        <span style={{ fontSize: 11, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{centerLabel}</span>
      </div>
    </div>
  )
})
