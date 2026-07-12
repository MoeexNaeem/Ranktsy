'use client'
import { useEffect } from 'react'
import { C } from '@/utils'

export default function Error({ error, reset }: { error:Error&{digest?:string}; reset:()=>void }) {
  useEffect(()=>{ console.error(error) },[error])
  return (
    <main style={{ minHeight:'100vh', background:C.snow, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:24 }}>
      <div style={{ fontSize:42, marginBottom:16 }}>⚠️</div>
      <h1 style={{ fontSize:32, fontWeight:500, color:C.ink, letterSpacing:'-0.03em', marginBottom:10 }}>Something went wrong</h1>
      <p style={{ fontSize:13, color:'#888', marginBottom:28, fontFamily:"'General Sans',monospace" }}>{error.message}</p>
      <button onClick={reset} style={{ background:C.charcoal, color:C.snow, border:'none', padding:'10px 24px', borderRadius:999, fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Try again</button>
    </main>
  )
}
