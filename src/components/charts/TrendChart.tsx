'use client'
import { memo, useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend, type ChartOptions, type ScriptableContext } from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { TrendData, TrendPlatform } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

// Validated categorical palette (dataviz: fixed order, never cycled). Passed the
// palette validator — worst adjacent CVD ΔE 18.9, normal-vision ΔE 29.8.
const COLORS: Record<TrendPlatform, string> = {
  etsy:   '#FB5E09', // brand orange
  google: '#2E6DB4', // blue (matches the Google treatment used elsewhere)
  amazon: '#C08A12', // gold
  ebay:   '#7A4FB5', // purple
}

// Soft top-to-bottom gradient in the series colour → transparent, so the area
// reads as depth rather than a flat wash (the old fills were near-invisible).
function fill(color: string) {
  return (ctx: ScriptableContext<'line'>) => {
    const { chart } = ctx
    const { ctx: c, chartArea } = chart
    if (!chartArea) return 'transparent'
    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    const [r, gr, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
    g.addColorStop(0, `rgba(${r},${gr},${b},0.30)`)
    g.addColorStop(0.85, `rgba(${r},${gr},${b},0.02)`)
    g.addColorStop(1, `rgba(${r},${gr},${b},0)`)
    return g
  }
}

interface Props { data: TrendData[]; activePlatforms: TrendPlatform[] }

export const TrendChart = memo(function TrendChart({ data, activePlatforms }: Props) {
  const filtered = useMemo(() => data.filter(d => activePlatforms.includes(d.platform)), [data, activePlatforms])
  const labels   = useMemo(() => data[0]?.points.map(p => p.month) ?? [], [data])
  // A single active series reads best as a filled area (like the sample); with
  // several, fills would muddy, so only the first keeps a strong fill.
  const single = filtered.length === 1

  const chartData = useMemo(() => ({
    labels,
    datasets: filtered.map((s, i) => ({
      label:            s.platform.charAt(0).toUpperCase() + s.platform.slice(1),
      data:             s.points.map(p => p.value),
      borderColor:      COLORS[s.platform],
      backgroundColor:  single || i === 0 ? fill(COLORS[s.platform]) : 'transparent',
      tension:          0.4,
      borderWidth:      2.5,
      pointRadius:      0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: COLORS[s.platform],
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
      fill:             single || i === 0 ? 'origin' : false,
    })),
  }), [filtered, labels, single])

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index', intersect: false, backgroundColor: '#3D3E3B', padding: 11,
        titleFont: { size: 12, family: "'General Sans',sans-serif", weight: 'bold' },
        bodyFont: { size: 12.5, family: "'General Sans',sans-serif" },
        cornerRadius: 9, boxPadding: 5, usePointStyle: true,
        callbacks: { label: c => `  ${c.dataset.label}: ${Number(c.parsed.y).toLocaleString()}` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, family: "'General Sans',sans-serif" }, color: '#93938A', maxRotation: 0, autoSkipPadding: 12 } },
      y: {
        grid: { color: 'rgba(61,62,59,0.07)' }, border: { display: false }, beginAtZero: true,
        ticks: { font: { size: 11, family: "'General Sans',sans-serif" }, color: '#93938A', maxTicksLimit: 6, padding: 8, callback: v => Number(v).toLocaleString() },
      },
    },
  }), [])

  return <div style={{ position: 'relative', height: 224 }}><Line data={chartData} options={options} /></div>
})
