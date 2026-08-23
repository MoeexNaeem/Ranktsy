import { Icon } from '@/components/ui/Icon'
import Link from 'next/link'
import { C } from '@/utils'

export default function NotFound() {
  return (
    <main style={{ minHeight:'100vh', background:C.snow, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:24 }}>
      <div style={{ marginBottom:16, display:'flex', justifyContent:'center' }}><Icon name="sprout" size={52} color={C.stone} /></div>
      <h1 style={{ fontSize:34, fontWeight:500, color:C.ink, letterSpacing:'-0.03em', marginBottom:10 }}>Page not found (404)</h1>
      <p style={{ fontSize:14, color:'#888', marginBottom:22, maxWidth:340, lineHeight:1.6 }}>
        This page doesn&apos;t exist or has moved. Try one of these instead:
      </p>
      {/* Recovery links — machine-readable pointers so agents (and people) can find
          the way back: sitemap, resource index (llms.txt), and the main sections. */}
      <nav aria-label="Where to go next" style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', maxWidth:520, marginBottom:26 }}>
        {[
          { href:'/', label:'Home' },
          { href:'/blogs', label:'Blog' },
          { href:'/pricing', label:'Pricing' },
          { href:'/etsy-keyword-research', label:'Keyword research' },
          { href:'/sitemap.xml', label:'Sitemap' },
          { href:'/llms.txt', label:'Resource index (llms.txt)' },
        ].map(l => (
          <a key={l.href} href={l.href} style={{ fontSize:13.5, color:C.ink, background:'#fff', border:'1px solid #e4e2da', padding:'8px 14px', borderRadius:999, textDecoration:'none' }}>{l.label}</a>
        ))}
      </nav>
      <Link href="/" style={{ background:C.charcoal, color:C.snow, padding:'10px 24px', borderRadius:999, fontSize:14, fontWeight:500, textDecoration:'none' }}>Back to home</Link>
    </main>
  )
}
