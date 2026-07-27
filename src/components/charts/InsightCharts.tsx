'use client'
import { memo, useMemo } from 'react'
import { Chart as ChartJS, LinearScale, PointElement, ArcElement, Tooltip, BubbleController, type ChartOptions } from 'chart.js'
import { Doughnut, Bubble } from 'react-chartjs-2'
import { C, D, formatNumber } from '@/utils'

ChartJS.register(LinearScale, PointElement, ArcElement, Tooltip, BubbleController)

const SANS = "'General Sans',sans-serif"

// ─── Opportunity Map — real demand (x) vs ranking difficulty, self-explanatory ──
// The old chart.js scatter was hard to read: everything clustered in a corner, no
// labels (you couldn't tell which dot was which keyword), and the "lower-right is
// good" convention was backwards. This is a custom SVG that teaches itself —
// labelled quadrants, an intuitive up-and-right = best layout, direct labels on
// the winners, and a plain-language "best bets" line beneath.
export interface OppPoint { label: string; x: number; kd: number }

function niceCeil(v: number): number {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}
const median = (arr: number[]): number => {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}

// Layout constants (module scope — constant, so never in a deps array).
const OM_W = 720, OM_H = 380, OM_ML = 54, OM_MR = 18, OM_MT = 30, OM_MB = 46
const OM_PW = OM_W - OM_ML - OM_MR, OM_PH = OM_H - OM_MT - OM_MB

export const OpportunityMap = memo(function OpportunityMap({ points, xLabel = 'Search volume →' }: { points: OppPoint[]; xLabel?: string }) {
  const W = OM_W, H = OM_H, ML = OM_ML, MT = OM_MT, pw = OM_PW, ph = OM_PH

  const v = useMemo(() => {
    const maxX = niceCeil(Math.max(...points.map(p => p.x), 1))
    const sx = (val: number) => OM_ML + (val / maxX) * OM_PW
    const sy = (kd: number) => OM_MT + (Math.min(Math.max(kd, 0), 100) / 100) * OM_PH  // KD 0 (easy) at TOP
    // Adaptive quadrants: split at the medians so "relatively higher demand" and
    // "relatively easier" are always meaningful within this keyword set.
    const medX = median(points.map(p => p.x))
    const medKD = median(points.map(p => p.kd))
    const scored = points.map(p => ({
      ...p, px: sx(p.x), py: sy(p.kd),
      sweet: p.x >= medX && p.kd <= medKD,
      score: (p.x / maxX) * (1 - p.kd / 100),
    }))
    const winners = [...scored].sort((a, b) => b.score - a.score).slice(0, 4)
    const winnerSet = new Set(winners.map(w => w.label))
    return { maxX, sx, sy, xMid: sx(medX), yMid: sy(medKD), scored, winners, winnerSet }
  }, [points])

  if (!points.length) return null
  const { maxX, sx, sy, xMid, yMid, scored, winners, winnerSet } = v
  const dotColor = (p: { sweet: boolean; kd: number }) => p.sweet ? D.good : p.kd < 34 ? D.good : p.kd < 67 ? D.mid : D.hard

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Keyword opportunity map: demand versus ranking difficulty">
        {/* Quadrant tints */}
        <rect x={xMid} y={MT} width={ML + pw - xMid} height={yMid - MT} fill={D.goodBg} />
        <rect x={ML} y={MT} width={xMid - ML} height={yMid - MT} fill="rgba(46,109,180,0.05)" />
        <rect x={xMid} y={yMid} width={ML + pw - xMid} height={MT + ph - yMid} fill={D.midBg} fillOpacity={0.5} />
        <rect x={ML} y={yMid} width={xMid - ML} height={MT + ph - yMid} fill="rgba(61,62,59,0.035)" />

        {/* Median divider lines + plot border */}
        <line x1={xMid} y1={MT} x2={xMid} y2={MT + ph} stroke="rgba(61,62,59,0.18)" strokeDasharray="4 4" />
        <line x1={ML} y1={yMid} x2={ML + pw} y2={yMid} stroke="rgba(61,62,59,0.18)" strokeDasharray="4 4" />
        <rect x={ML} y={MT} width={pw} height={ph} fill="none" stroke="rgba(61,62,59,0.14)" />

        {/* Quadrant labels */}
        <text x={ML + pw - 8} y={MT + 16} textAnchor="end" fontSize="12.5" fontWeight="700" fill={D.good} fontFamily={SANS}>🎯 Sweet spot</text>
        <text x={ML + pw - 8} y={MT + 31} textAnchor="end" fontSize="10" fill={C.stone} fontFamily={SANS}>more demand · easier</text>
        <text x={ML + 8} y={MT + 15} textAnchor="start" fontSize="10.5" fill={C.stone} fontFamily={SANS}>easy · low demand</text>
        <text x={ML + pw - 8} y={MT + ph - 8} textAnchor="end" fontSize="10.5" fill={C.stone} fontFamily={SANS}>high demand · hard</text>
        <text x={ML + 8} y={MT + ph - 8} textAnchor="start" fontSize="10.5" fill={C.stone} fontFamily={SANS}>low priority</text>

        {/* Axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <text key={i} x={sx(f * maxX)} y={MT + ph + 17} textAnchor="middle" fontSize="10" fill={C.graphite} fontFamily={SANS}>{formatNumber(Math.round(f * maxX))}</text>
        ))}
        {[0, 25, 50, 75, 100].map(kd => (
          <text key={kd} x={ML - 8} y={sy(kd) + 3.5} textAnchor="end" fontSize="10" fill={C.graphite} fontFamily={SANS}>{kd}</text>
        ))}

        {/* Axis titles */}
        <text x={ML + pw / 2} y={H - 7} textAnchor="middle" fontSize="12" fill={C.graphite} fontFamily={SANS}>{xLabel}</text>
        <text transform={`translate(14 ${MT + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={C.graphite} fontFamily={SANS}>Easier to rank ↑ (KD)</text>

        {/* Dots */}
        {scored.map((p, i) => (
          <g key={i}>
            {p.sweet && winnerSet.has(p.label) && <circle cx={p.px} cy={p.py} r={11} fill="none" stroke={D.good} strokeWidth={1.4} strokeOpacity={0.5} />}
            <circle cx={p.px} cy={p.py} r={winnerSet.has(p.label) ? 8 : 6.5} fill={dotColor(p)} fillOpacity={0.85} stroke="#fff" strokeWidth={1.5}>
              <title>{`${p.label} — ${formatNumber(Math.round(p.x))} · KD ${Math.round(p.kd)}`}</title>
            </circle>
          </g>
        ))}

        {/* Direct labels on the winners */}
        {winners.map((p, i) => {
          const right = p.px < ML + pw - 130
          const label = p.label.length > 22 ? p.label.slice(0, 21) + '…' : p.label
          return (
            <text key={i} x={right ? p.px + 12 : p.px - 12} y={p.py + 3.5} textAnchor={right ? 'start' : 'end'}
              fontSize="11.5" fontWeight="600" fill={C.ink} fontFamily={SANS}
              style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.5, strokeLinejoin: 'round' }}>
              {label}
            </text>
          )
        })}
      </svg>

      {/* Plain-language takeaway — so the point lands even without reading the axes */}
      {winners.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 8, padding: '10px 13px', background: D.goodBg, borderRadius: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, marginRight: 2 }}>🎯 Best bets:</span>
          {winners.map((w, i) => (
            <span key={w.label} style={{ fontSize: 12.5, color: C.ink }}>
              {i > 0 && <span style={{ color: C.lightGray, margin: '0 3px' }}>·</span>}
              <strong>{w.label}</strong>{' '}
              <span style={{ color: C.stone, fontFamily: 'monospace', fontSize: 10.5 }}>{formatNumber(Math.round(w.x))}·KD{Math.round(w.kd)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

// ─── Mix donut with a centred total (competition breakdown, etc.) ────────────
export interface Segment { label: string; value: number; color: string }

// ─── Bubble chart — x vs y, bubble size = a third metric (leaderboards) ──────
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
