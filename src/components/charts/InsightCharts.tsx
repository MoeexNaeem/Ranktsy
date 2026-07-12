'use client'
import { memo, useMemo } from 'react'
import { Chart as ChartJS, LinearScale, PointElement, ArcElement, Tooltip, BubbleController, type ChartOptions } from 'chart.js'
import { Scatter, Doughnut, Bubble } from 'react-chartjs-2'
import { C, formatNumber } from '@/utils'

ChartJS.register(LinearScale, PointElement, ArcElement, Tooltip, BubbleController)

const SANS = "'General Sans',sans-serif"

// ─── Opportunity Matrix — search volume (x) vs difficulty (y) ────────────────
export interface ScatterPoint { x: number; y: number; label: string; color: string }

export const OpportunityScatter = memo(function OpportunityScatter({ points }: { points: ScatterPoint[] }) {
  const data = useMemo(() => ({
    datasets: [{
      data: points,
      pointRadius: 8, pointHoverRadius: 12,
      backgroundColor: points.map(p => p.color),
      borderColor: '#fff', borderWidth: 1.5,
    }],
  }), [points])

  const options = useMemo<ChartOptions<'scatter'>>(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: C.ink, padding: 11, cornerRadius: 8,
        titleFont: { size: 13, family: SANS }, bodyFont: { size: 12.5, family: SANS },
        callbacks: {
          title: (items) => points[items[0].dataIndex]?.label ?? '',
          label: (ctx) => `${Math.round(ctx.parsed.x ?? 0).toLocaleString()} searches · KD ${Math.round(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Search volume →', font: { size: 12, family: SANS }, color: C.graphite }, grid: { color: 'rgba(61,62,59,0.06)' }, ticks: { font: { size: 11, family: SANS }, color: C.graphite }, border: { display: false } },
      y: { title: { display: true, text: 'Difficulty (KD)', font: { size: 12, family: SANS }, color: C.graphite }, min: 0, max: 100, grid: { color: 'rgba(61,62,59,0.06)' }, ticks: { font: { size: 11, family: SANS }, color: C.graphite, stepSize: 25 }, border: { display: false } },
    },
  }), [points])

  return <div style={{ position: 'relative', height: 300 }}><Scatter data={data} options={options} /></div>
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
