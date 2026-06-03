'use client'
import { useState, useCallback, useRef } from 'react'
import { useKeywordSearch } from '@/hooks/useKeywords'
import { useAppStore }      from '@/store/app'
import { KeywordTable }     from '@/components/dashboard/KeywordTable'
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
    <section id="keywords" style={{ padding: '96px 48px', background: C.snow }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily:"'IBM Plex Mono',monospace", textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: C.forest, marginBottom: 16 }}>
          <span style={{ width: 24, height: 1, background: C.forest, display: 'inline-block' }} />Keyword Tool
        </div>
        <h2 style={{ fontSize: 'clamp(28px,3.5vw,40px)', fontWeight: 300, letterSpacing: '-1px', color: C.forest, lineHeight: 1.1, marginBottom: 16 }}>
          Try it live — search any keyword
        </h2>
        <p style={{ fontSize: 16, color: '#666', lineHeight: 1.6, maxWidth: 480, marginBottom: 48 }}>
          Enter any product keyword to see live Etsy analytics. (Demo data shown — connect your Etsy shop for real stats.)
        </p>

        <div style={{ background: C.warmGray, borderRadius: 16, padding: 32 }}>
          {/* Input row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            <input ref={ref} type="text" className="kw-input"
              placeholder="e.g. handmade candles, silver ring, boho jewelry..."
              onKeyDown={e=>e.key==='Enter'&&go()}
              style={{ flex: 1, padding: '14px 20px', border: '1.5px solid rgba(28,58,19,0.2)', borderRadius: 8, fontSize: 15, fontFamily: 'inherit', background: C.snow, outline: 'none', color: '#000', transition: 'border-color 0.2s' }}
              onFocus={e=>(e.currentTarget.style.borderColor=C.forest)}
              onBlur={e=>(e.currentTarget.style.borderColor='rgba(28,58,19,0.2)')}
            />
            <button onClick={go}
              style={{ background: C.forest, border: 'none', color: C.snow, padding: '14px 32px', borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'opacity 0.2s' }}
              onMouseEnter={e=>(e.currentTarget.style.opacity='0.85')}
              onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
              Search keywords →
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div id="loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 0', fontSize: 14, color: C.forest }}>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                {[0,1,2].map(i=>(
                  <span key={i} className="shimmer" style={{ width: 6, height: 6, borderRadius: '50%', background: C.forest, display: 'inline-block', animationDelay:`${i*0.15}s` }}/>
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
                <p style={{ fontSize:15, fontWeight:500, color:C.forest }}>Keywords related to &ldquo;{data.query}&rdquo;</p>
                <span style={{ fontSize:12, color:'#b3b3b3', fontFamily:"'IBM Plex Mono',monospace" }}>{data.related.length} keywords found</span>
              </div>
              <div style={{ background: C.snow, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)' }}>
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
                    style={{ fontSize: 12, fontFamily:"'IBM Plex Mono',monospace", color: C.forest, background: 'rgba(211,250,153,0.4)', border: 'none', padding: '5px 13px', borderRadius: 999, cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background=C.pale)}
                    onMouseLeave={e=>(e.currentTarget.style.background='rgba(211,250,153,0.4)')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
