'use client'
import { memo, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, type ChartOptions,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { C } from '@/utils'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const MONO = "'General Sans',monospace"

interface Props {
  labels:  string[]
  values:  number[]
  /** 'x' = vertical bars (default), 'y' = horizontal bars (leaderboards) */
  axis?:   'x' | 'y'
  height?: number
  color?:  string
  /** highlight the max bar in the accent colour */
  highlightMax?: boolean
  /** optional per-bar colours (overrides color/highlightMax) */
  colors?: string[]
}

export const BarChart = memo(function BarChart({
  labels, values, axis = 'x', height = 200, color = C.orange, highlightMax = false, colors,
}: Props) {
  const bg = useMemo(() => {
    if (colors) return colors
    if (!highlightMax) return color
    const max = Math.max(...values, 0)
    return values.map(v => (v === max ? C.orange : 'rgba(145,145,131,0.32)'))
  }, [colors, color, highlightMax, values])

  const data = useMemo(() => ({
    labels,
    datasets: [{
      data:            values,
      backgroundColor: bg,
      borderRadius:    6,
      borderSkipped:   false as const,
      maxBarThickness: axis === 'y' ? 22 : 44,
    }],
  }), [labels, values, bg, axis])

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    indexAxis: axis,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: C.ink,
        padding: 10, cornerRadius: 8,
        titleFont: { size: 12.5, family: MONO },
        bodyFont:  { size: 12.5, family: MONO },
      },
    },
    scales: {
      x: {
        grid: { display: axis === 'y', color: 'rgba(61,62,59,0.06)' },
        ticks: { font: { size: 12, family: MONO }, color: '#6E6E64', maxRotation: 0, autoSkip: true },
        border: { display: false },
      },
      y: {
        grid: { display: axis === 'x', color: 'rgba(61,62,59,0.06)' },
        ticks: { font: { size: 12.5, family: MONO }, color: '#3D3E3B', autoSkip: false },
        border: { display: false },
      },
    },
  }), [axis])

  return <div style={{ position: 'relative', height }}><Bar data={data} options={options} /></div>
})
