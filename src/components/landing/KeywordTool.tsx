'use client'
import { useState, useCallback, useRef } from 'react'
import { useKeywordSearch } from '@/hooks/useKeywords'
import { useAppStore }      from '@/store/app'
import { KeywordTable }     from '@/components/dashboard/KeywordTable'
import { Reveal } from './Reveal'
import { C } from '@/utils'

const SUGG = ['silver necklace','handmade candles','boho jewelry','vintage poster','custom mug']

export function KeywordTool() {
  const ref   = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const addR  = useAppStore(s => s.addRecentSearch)
  const { data, isLoading, isError } = useKeywordSearch(q)

  const go = useCallback(() => {
    const v = ref.current?.value.trim() ?? ''; if (v.length < 2) return
    setQ(v); addR(v)
  }, [addR])

  return (
    <section id="keywords" style={{ padding: '120px 40px', background: C.canvas }}>
      <Reveal style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily:"'General Sans',monospace", textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: C.ink, marginBottom: 18 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />Keyword Tool
        </div>
        <h2 style={{ fontSize: 'clamp(34px,4.6vw,56px)', fontWeight: 500, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1.0, marginBottom: 16, maxWidth: 760 }}>
          Try it live — search any keyword.
        </h2>
        {/* This tool calls the same live Etsy API the dashboard does — it never
            showed demo data. The old copy said it did, which is both untrue and
            the worst possible claim to make to an Etsy API reviewer. */}
        <p style={{ fontSize: 18, color: '#6E6E64', lineHeight: 1.5, letterSpacing: '-0.14px', maxWidth: 520, marginBottom: 48 }}>
          Enter any product keyword for real numbers measured live from the official Etsy API — no sign-up, no demo data.
        </p>

        <div className="rpad-card" style={{ background: C.paper, border: `1px solid ${C.hairInk}`, borderRadius: 24, padding: 28 }}>
          {/* Input row. `minWidth: 0` on the input is load-bearing: a flex item
              defaults to min-width:auto and so refuses to shrink below its
              placeholder's intrinsic width, which pushed this row (and with it the
              whole page's scroll width) past the viewport on phones. */}
          <div className="rstack-sm" style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
            <input ref={ref} type="text" className="kw-input rfull-sm"
              placeholder="e.g. handmade candles, silver ring, boho jewelry..."
              onKeyDown={e=>e.key==='Enter'&&go()}
              style={{ flex: 1, minWidth: 0, padding: '14px 18px', border: `1px solid ${C.hair}`, borderRadius: 100, fontSize: 15, fontFamily: 'inherit', background: C.canvas, outline: 'none', color: '#000', transition: 'border-color 0.2s' }}
              onFocus={e=>(e.currentTarget.style.borderColor=C.ink)}
              onBlur={e=>(e.currentTarget.style.borderColor=C.hair)}
            />
            <button onClick={go} className="rfull-sm"
              style={{ background: C.orange, border: 'none', color: '#fff', padding: '14px 30px', borderRadius: 28, fontSize: 14.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e=>(e.currentTarget.style.opacity='0.88')}
              onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
              Search keywords →
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div id="loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 0', fontSize: 14, color: C.charcoal }}>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                {[0,1,2].map(i=>(
                  <span key={i} className="shimmer" style={{ width: 6, height: 6, borderRadius: '50%', background: C.charcoal, display: 'inline-block', animationDelay:`${i*0.15}s` }}/>
                ))}
              </div>
              <span>Analyzing keyword data...</span>
            </div>
          )}

          {/* Error */}
          {isError && <p style={{ textAlign:'center', color:'#c00', padding:'24px 0', fontSize:14 }}>Failed to load. Please try again.</p>}

          {/* Results */}
          {data && !isLoading && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <p style={{ fontSize:15, fontWeight:500, color:C.charcoal }}>Keywords related to &ldquo;{data.query}&rdquo;</p>
                <span style={{ fontSize:12, color:'#b3b3b3', fontFamily:"'General Sans',monospace" }}>{data.related.length} keywords found</span>
              </div>
              <div style={{ background: C.paper, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.hair}` }}>
                <KeywordTable rows={data.related} />
              </div>
            </div>
          )}

          {/* Suggestions */}
          {!data && !isLoading && !isError && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>Try one of these popular searches:</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {SUGG.map(s => (
                  <button key={s}
                    onClick={()=>{ if(ref.current) ref.current.value=s; setQ(s); addR(s) }}
                    style={{ fontSize: 12.5, fontFamily:"'General Sans',monospace", color: C.orange, background: 'transparent', border: `1px solid ${C.orange}`, padding: '5px 14px', borderRadius: 100, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=C.orange; e.currentTarget.style.color='#fff' }}
                    onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=C.orange }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Reveal>
    </section>
  )
}
