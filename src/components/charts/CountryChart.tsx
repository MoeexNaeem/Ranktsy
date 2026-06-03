'use client'
import { memo, useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, type ChartOptions } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import type { CountryData } from '@/types'

ChartJS.register(ArcElement, Tooltip, Legend)

export const CountryChart = memo(function CountryChart({ data }:{ data:CountryData[] }) {
  const chartData = useMemo(() => ({
    labels:   data.map(d=>d.country),
    datasets: [{ data:data.map(d=>d.percentage), backgroundColor:data.map(d=>d.color), borderWidth:0 }],
  }), [data])

  const options = useMemo<ChartOptions<'doughnut'>>(() => ({
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    plugins: {
      legend: { display:true, position:'right', labels:{ font:{ size:10, family:"'IBM Plex Mono',monospace" }, color:'#666', boxWidth:8, boxHeight:8, padding:8 } },
    },
  }), [])

  return <div style={{ position:'relative', height:108 }}><Doughnut data={chartData} options={options} /></div>
})
