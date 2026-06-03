'use client'
import { memo, useCallback } from 'react'
import { C } from '@/utils'
import type { TrendPlatform } from '@/types'

const PLAT: { key:TrendPlatform; label:string; color:string }[] = [
  { key:'etsy',   label:'Etsy',   color:C.forest },
  { key:'google', label:'Google', color:C.mutedYellow },
  { key:'amazon', label:'Amazon', color:C.mutedTeal },
  { key:'ebay',   label:'eBay',   color:C.frosted },
]

interface Props { active:TrendPlatform[]; onChange:(p:TrendPlatform[])=>void }

export const PlatformToggle = memo(function PlatformToggle({ active, onChange }:Props) {
  const toggle = useCallback((k:TrendPlatform) => {
    onChange(active.includes(k) ? active.filter(p=>p!==k) : [...active,k])
  }, [active, onChange])

  return (
    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
      {PLAT.map(({key,label,color}) => (
        <button key={key} onClick={()=>toggle(key)}
          style={{ display:'flex', alignItems:'center', gap:5, fontSize:10.5, fontFamily:"'IBM Plex Mono',monospace", background:'none', border:'none', cursor:'pointer', padding:0, opacity:active.includes(key)?1:0.3, transition:'opacity 0.15s' }}>
          <span style={{ width:10, height:10, borderRadius:2, background:color, display:'inline-block', flexShrink:0 }}/>
          {label}
        </button>
      ))}
    </div>
  )
})
