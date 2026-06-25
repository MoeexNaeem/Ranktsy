'use client'
import { memo, useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend, type ChartOptions } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { C } from '@/utils'
import type { TrendData, TrendPlatform } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const COLORS: Record<TrendPlatform,string> = {
  etsy: C.forest, google: C.mutedYellow, amazon: C.mutedTeal, ebay: C.frosted,
}

interface Props { data:TrendData[]; activePlatforms:TrendPlatform[] }

export const TrendChart = memo(function TrendChart({ data, activePlatforms }:Props) {
  const filtered = useMemo(() => data.filter(d=>activePlatforms.includes(d.platform)), [data, activePlatforms])
  const labels   = useMemo(() => data[0]?.points.map(p=>p.month) ?? [], [data])

  const chartData = useMemo(() => ({
    labels,
    datasets: filtered.map(s => ({
      label:           s.platform.charAt(0).toUpperCase() + s.platform.slice(1),
      data:            s.points.map(p=>p.value),
      borderColor:     COLORS[s.platform],
      backgroundColor: s.platform==='etsy' ? 'rgba(255,96,8,0.06)' : 'transparent',
      tension:         0.4,
      borderWidth:     s.platform==='etsy' ? 2 : 1.5,
      borderDash:      s.platform==='etsy' ? [] : [4,4],
      pointRadius:     0,
      fill:            s.platform==='etsy',
    })),
  }), [filtered, labels])

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display:false },
      tooltip: { mode:'index', intersect:false },
    },
    scales: {
      x: { grid:{ display:false }, ticks:{ font:{ size:9, family:"'IBM Plex Mono',monospace" }, color:'#bbb' } },
      y: { grid:{ color:'rgba(0,0,0,0.04)' }, ticks:{ font:{ size:9, family:"'IBM Plex Mono',monospace" }, color:'#bbb' } },
    },
  }), [])

  return <div style={{ position:'relative', height:108 }}><Line data={chartData} options={options} /></div>
})
