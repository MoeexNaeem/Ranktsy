'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { SectionTag } from './Sections'
import { C } from '@/utils'

const Dashboard = dynamic(
  () => import('@/components/dashboard/Dashboard').then(m=>({default:m.Dashboard})),
  { ssr: false, loading: () => <div style={{ height:540, background:'rgba(255,255,255,0.07)', borderRadius:14 }} className="shimmer" /> }
)

const TABS = ['Keywords','Trends','Shop Analytics']

export function DashboardSection() {
  const [active, setActive] = useState(0)
  const go = useCallback((i:number)=>setActive(i),[])
  return (
    <section id="dashboard" style={{ padding:'96px 48px', background:C.forest }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <SectionTag light>Dashboard</SectionTag>
        <h2 style={{ fontSize:'clamp(28px,3.5vw,40px)', fontWeight:300, color:C.snow, letterSpacing:'-1px', lineHeight:1.1, marginBottom:16 }}>
          A command center for your Etsy shop
        </h2>
        <p style={{ fontSize:16, color:'rgba(252,252,247,0.6)', marginBottom:32, maxWidth:480, lineHeight:1.6 }}>
          Everything in one place. Track keywords, competitors, trends, and shop performance in real-time.
        </p>
        <div style={{ display:'flex', gap:8, marginBottom:32 }}>
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>go(i)} style={{
              padding:'10px 24px', borderRadius:999, fontSize:13, fontWeight:400, cursor:'pointer',
              fontFamily:'inherit', border:'none', transition:'all 0.2s',
              background:active===i ? C.snow : 'rgba(255,255,255,0.1)',
              color:active===i ? C.forest : 'rgba(252,252,247,0.6)',
            }}
            onMouseEnter={e=>{ if(active!==i) e.currentTarget.style.background='rgba(255,255,255,0.15)'; if(active!==i) e.currentTarget.style.color=C.snow }}
            onMouseLeave={e=>{ if(active!==i) e.currentTarget.style.background='rgba(255,255,255,0.1)'; if(active!==i) e.currentTarget.style.color='rgba(252,252,247,0.6)' }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ background:C.snow, borderRadius:16, overflow:'hidden' }}>
          <Dashboard />
        </div>
      </div>
    </section>
  )
}
