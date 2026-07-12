import { memo } from 'react'
import { C } from '@/utils'

export const MiniTrend = memo(function MiniTrend({ data }:{ data:number[] }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:2.5, height:34 }}>
      {data.map((v,i) => (
        <div key={i} style={{ width:5, borderRadius:2, height:`${Math.max(12, Math.round((v/max)*100))}%`, background:i>=data.length-3?C.orange:'#D9D6CC', flexShrink:0 }}/>
      ))}
    </div>
  )
})
