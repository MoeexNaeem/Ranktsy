'use client'
import { useState, useCallback, useMemo } from 'react'
import { useKeywordSearch, useTrends } from '@/hooks/useKeywords'
import { useAppStore }    from '@/store/app'
import { KeywordTable }   from './KeywordTable'
import { TrendChart }     from '@/components/charts/TrendChart'
import { CountryChart }   from '@/components/charts/CountryChart'
import { PlatformToggle } from './PlatformToggle'
import { C, formatNumber, formatPercent } from '@/utils'
import type { TrendPlatform } from '@/types'

const TABS = ['Keywords','Trends','Shop Analytics'] as const
type Tab = typeof TABS[number]

const NAV = [
  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>, label:'Keys' },
  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>, label:'List' },
  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>, label:'Comp' },
  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, label:'Insight' },
  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>, label:'Trends' },
]

function Skel({ h=72 }: { h?: number }) {
  return <div className="shimmer" style={{ height:h, background:'#ddd', borderRadius:8 }} />
}

export function Dashboard() {
  const [input,  setInput]  = useState('silver necklace')
  const [query,  setQuery]  = useState('silver necklace')
  const [tab,    setTab]    = useState<Tab>('Keywords')
  const [plats,  setPlats]  = useState<TrendPlatform[]>(['etsy','google'])
  const addR = useAppStore(s=>s.addRecentSearch)

  const { data:kw, isLoading, isError } = useKeywordSearch(query)
  const { data:tr }                     = useTrends(query)

  const search = useCallback(()=>{ const q=input.trim(); if(q.length<2)return; setQuery(q); addR(q) },[input,addR])

  const stats = useMemo(()=>{
    if(!kw) return null
    const {avgSearches,avgClicks,avgCtr} = kw.stats
    return [
      {label:'Avg. Searches',value:formatNumber(avgSearches),sub:'per month',pct:Math.min((avgSearches/80000)*100,100),color:C.forest},
      {label:'Avg. Clicks',  value:formatNumber(avgClicks),  sub:'per month',pct:Math.min((avgClicks/60000)*100,100),  color:C.mutedYellow},
      {label:'Avg. CTR',     value:formatPercent(avgCtr),    sub:'click-through',pct:avgCtr,                          color:C.mutedTeal},
    ]
  },[kw])

  const TOOL_ICON = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>

  return (
    <div style={{ background:C.snow, borderRadius:16, overflow:'hidden', border:'1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ display:'flex', height:540 }}>

        {/* Sidebar */}
        <div style={{ width:52, background:C.warmGray, borderRight:'1px solid rgba(0,0,0,0.07)', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:5, flexShrink:0 }}>
          {NAV.map((n,i)=>(
            <button key={n.label} title={n.label} style={{ width:36, height:36, borderRadius:8, border:'none', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, cursor:'pointer', fontSize:7.5, fontFamily:'inherit', background:i===0?C.forest:'transparent', color:i===0?C.snow:'#999' }}>
              <span style={{ color:i===0?C.snow:'#999', display:'flex' }}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
          <button title="Tools" style={{ width:36, height:36, borderRadius:8, border:'none', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, cursor:'pointer', fontSize:7.5, fontFamily:'inherit', background:'transparent', color:'#999', marginTop:'auto' }}>
            <span style={{ display:'flex' }}>{TOOL_ICON}</span><span>Tools</span>
          </button>
        </div>

        {/* Main */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'1px solid rgba(0,0,0,0.06)', flexShrink:0 }}>
            <div style={{ display:'flex', background:C.warmGray, borderRadius:8, overflow:'hidden', border:'1px solid rgba(0,0,0,0.08)', flex:1, maxWidth:340 }}>
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Search any keyword..."
                style={{ background:'transparent', border:'none', padding:'7px 11px', fontSize:12.5, fontFamily:'inherit', outline:'none', flex:1, color:'#1a1a1a' }} />
              <button onClick={search} style={{ background:C.forest, border:'none', color:C.snow, padding:'0 13px', fontSize:11.5, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Search</button>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:10.5, background:C.pale, color:C.forest, padding:'3px 10px', borderRadius:999, fontFamily:"'IBM Plex Mono',monospace" }}>Etsy US</span>
              <span style={{ fontSize:10, color:'#bbb', fontFamily:"'IBM Plex Mono',monospace" }}>Live data</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', padding:'0 14px', borderBottom:'1px solid rgba(0,0,0,0.06)', flexShrink:0 }}>
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ fontSize:12, fontWeight:500, padding:'9px 13px', border:'none', borderBottom:`2px solid ${tab===t?C.forest:'transparent'}`, cursor:'pointer', fontFamily:'inherit', background:'transparent', color:tab===t?C.forest:'#aaa', marginBottom:-1, transition:'color 0.15s' }}>{t}</button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', padding:'13px 14px' }}>

            {tab==='Keywords' && (
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:9 }}>
                  {isLoading||!stats ? [0,1,2].map(i=><Skel key={i} h={74} />) : stats.map(s=>(
                    <div key={s.label} style={{ background:C.warmGray, borderRadius:10, padding:'11px 13px' }}>
                      <p style={{ fontSize:9.5, fontFamily:"'IBM Plex Mono',monospace", color:'#999', textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:4 }}>{s.label}</p>
                      <p style={{ fontSize:20, fontWeight:600, color:s.color, letterSpacing:'-0.5px' }}>{s.value}</p>
                      <p style={{ fontSize:10.5, color:'#bbb', marginTop:2 }}>{s.sub}</p>
                      <div style={{ height:3, background:'rgba(0,0,0,0.07)', borderRadius:999, marginTop:7, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${s.pct}%`, background:s.color, borderRadius:999, transition:'width 0.7s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:9 }}>
                  <div style={{ background:C.warmGray, borderRadius:10, padding:'11px 13px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
                      <p style={{ fontSize:11, fontWeight:500, color:C.forest }}>Search Trend</p>
                      {tr && <PlatformToggle active={plats} onChange={setPlats} />}
                    </div>
                    {tr ? <TrendChart data={tr.trends} activePlatforms={plats} /> : <Skel h={108} />}
                  </div>
                  <div style={{ background:C.warmGray, borderRadius:10, padding:'11px 13px' }}>
                    <p style={{ fontSize:11, fontWeight:500, color:C.forest, marginBottom:9 }}>Searchers by Country</p>
                    {tr ? <CountryChart data={tr.countries} /> : <Skel h={108} />}
                  </div>
                </div>

                {/* Table */}
                {isLoading && <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'22px 0', fontSize:13, color:C.forest }}>
                  {[0,1,2].map(i=><span key={i} className="shimmer" style={{ width:6,height:6,borderRadius:'50%',background:C.forest,display:'inline-block',animationDelay:`${i*0.15}s` }}/>)} Analyzing...
                </div>}
                {isError && <p style={{ color:'#c00', textAlign:'center', fontSize:13, padding:'18px 0' }}>Failed. Please retry.</p>}
                {kw && <div>
                  <p style={{ fontSize:11.5, fontWeight:500, color:C.forest, marginBottom:7 }}>Keywords related to &ldquo;{kw.query}&rdquo;</p>
                  <KeywordTable rows={kw.related} />
                </div>}
              </div>
            )}

            {tab==='Trends' && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'75%', gap:9, textAlign:'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                <p style={{ fontSize:14, fontWeight:500, color:C.forest }}>Full Trend Analytics</p>
                <p style={{ fontSize:13, color:'#888', maxWidth:270 }}>Connect your Etsy shop to unlock 24-month trend data across all listings.</p>
                <button style={{ marginTop:10, fontSize:12.5, background:C.forest, color:C.snow, border:'none', padding:'9px 20px', borderRadius:999, cursor:'pointer', fontFamily:'inherit' }}>Connect Etsy Shop →</button>
              </div>
            )}

            {tab==='Shop Analytics' && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'75%', gap:9, textAlign:'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <p style={{ fontSize:14, fontWeight:500, color:C.forest }}>Shop Analytics</p>
                <p style={{ fontSize:13, color:'#888', maxWidth:270 }}>Connect your Etsy shop via OAuth to see views, favourites, revenue and conversion trends.</p>
                <button style={{ marginTop:10, fontSize:12.5, background:C.forest, color:C.snow, border:'none', padding:'9px 20px', borderRadius:999, cursor:'pointer', fontFamily:'inherit' }}>Authorize with Etsy →</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
