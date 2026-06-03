import { memo } from 'react'
import { C } from '@/utils'

export const MiniTrend = memo(function MiniTrend({ data }:{ data:number[] }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:24 }}>
      {data.map((v,i) => (
        <div key={i} style={{ width:4, borderRadius:1, height:`${Math.round((v/max)*100)}%`, background:i>=data.length-3?C.forest:C.frosted, flexShrink:0 }}/>
      ))}
    </div>
  )
})
