'use client'
import { memo, useCallback } from 'react'
import { C } from '@/utils'
import type { TrendPlatform } from '@/types'

// Only platforms we actually have data for (Etsy via the official API; Google via
// the Google Ads Keyword Planner when configured). No phantom Amazon/eBay toggles.
const PLAT: { key:TrendPlatform; label:string; color:string }[] = [
  { key:'etsy',   label:'Etsy',   color:C.orange },
  { key:'google', label:'Google', color:C.charcoal },
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
          style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:500, fontFamily:"'General Sans',sans-serif", background:'none', border:'none', cursor:'pointer', padding:0, opacity:active.includes(key)?1:0.35, transition:'opacity 0.15s' }}>
          <span style={{ width:10, height:10, borderRadius:2, background:color, display:'inline-block', flexShrink:0 }}/>
          {label}
        </button>
      ))}
    </div>
  )
})
