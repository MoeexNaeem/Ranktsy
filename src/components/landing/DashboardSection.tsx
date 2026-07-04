'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { SectionTag } from './Sections'
import { Reveal } from './Reveal'
import { C } from '@/utils'

const Dashboard = dynamic(
  () => import('@/components/dashboard/Dashboard').then(m=>({default:m.Dashboard})),
  { ssr: false, loading: () => <div style={{ height:540, background:'#e8e7e2', borderRadius:14 }} className="shimmer" /> }
)

const TABS = ['Keywords','Trends','Shop Analytics']

export function DashboardSection() {
  const [active, setActive] = useState(0)
  const go = useCallback((i:number)=>setActive(i),[])
  return (
    <section id="dashboard" style={{ padding:'96px 40px', background:C.paper }}>
      <Reveal style={{ maxWidth:1200, margin:'0 auto' }}>
        <SectionTag>Dashboard</SectionTag>
        <h2 style={{ fontSize:'clamp(30px,4vw,46px)', fontWeight:300, color:C.ink, letterSpacing:'-1.2px', lineHeight:1.08, marginBottom:16, maxWidth:720 }}>
          A command center for your Etsy shop.
        </h2>
        <p style={{ fontSize:18, color:'#3a4444', marginBottom:32, maxWidth:500, lineHeight:1.5, letterSpacing:'-0.14px' }}>
          Everything in one place. Track keywords, competitors, trends, and shop performance in real time.
        </p>
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>go(i)} style={{
              padding:'9px 18px', borderRadius:100, fontSize:13, fontWeight:500, cursor:'pointer',
              fontFamily:'inherit', transition:'all 0.18s',
              background:active===i ? C.ink : 'transparent',
              color:active===i ? '#fff' : '#3a4444',
              border:`1px solid ${active===i ? C.ink : C.hairInk}`,
            }}
            onMouseEnter={e=>{ if(active!==i) e.currentTarget.style.color=C.ink }}
            onMouseLeave={e=>{ if(active!==i) e.currentTarget.style.color='#3a4444' }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ background:C.paper, border:`1px solid ${C.hairInk}`, borderRadius:24, overflow:'hidden' }}>
          <Dashboard />
        </div>
      </Reveal>
    </section>
  )
}
