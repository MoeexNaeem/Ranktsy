'use client'
import { memo, useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend, type ChartOptions } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { C } from '@/utils'
import type { TrendData, TrendPlatform } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const COLORS: Record<TrendPlatform,string> = {
  etsy: C.orange, google: C.charcoal, amazon: C.graphite, ebay: C.stone,
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
      backgroundColor: s.platform==='etsy' ? 'rgba(251,94,9,0.12)' : 'transparent',
      tension:         0.4,
      borderWidth:     s.platform==='etsy' ? 2.5 : 2,
      borderDash:      s.platform==='etsy' ? [] : [5,4],
      pointRadius:     0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: COLORS[s.platform],
      fill:            s.platform==='etsy',
    })),
  }), [filtered, labels])

  const options = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display:false },
      tooltip: {
        mode:'index', intersect:false, backgroundColor:'#3D3E3B', padding:10,
        titleFont:{ size:12, family:"'General Sans',sans-serif" }, bodyFont:{ size:12, family:"'General Sans',sans-serif" },
        cornerRadius:8,
      },
    },
    scales: {
      x: { grid:{ display:false }, border:{ display:false }, ticks:{ font:{ size:11, family:"'General Sans',sans-serif" }, color:'#93938A' } },
      y: { grid:{ color:'rgba(61,62,59,0.06)' }, border:{ display:false }, ticks:{ font:{ size:11, family:"'General Sans',sans-serif" }, color:'#93938A', maxTicksLimit:5 } },
    },
  }), [])

  return <div style={{ position:'relative', height:150 }}><Line data={chartData} options={options} /></div>
})

