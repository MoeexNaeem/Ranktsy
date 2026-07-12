import Link from 'next/link'
import { C } from '@/utils'

export default function NotFound() {
  return (
    <main style={{ minHeight:'100vh', background:C.snow, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:24 }}>
      <div style={{ fontSize:52, marginBottom:16 }}>🌱</div>
      <h1 style={{ fontSize:34, fontWeight:500, color:C.ink, letterSpacing:'-0.03em', marginBottom:10 }}>Page not found</h1>
      <p style={{ fontSize:14, color:'#888', marginBottom:28, maxWidth:300 }}>The page you're looking for doesn't exist or has been moved.</p>
      <Link href="/" style={{ background:C.charcoal, color:C.snow, padding:'10px 24px', borderRadius:999, fontSize:14, fontWeight:500, textDecoration:'none' }}>Back to home</Link>
    </main>
  )
}
