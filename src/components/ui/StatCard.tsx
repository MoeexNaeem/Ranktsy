import { C } from '@/utils'

export function StatCard({ label, value, sub, fillPct, fillColor=C.charcoal, style }: {
  label:string; value:string; sub?:string; fillPct?:number; fillColor?:string; style?:React.CSSProperties
}) {
  return (
    <div style={{ background:C.warmGray, borderRadius:14, padding:'14px 16px', ...style }}>
      <p style={{ fontSize:9.5, fontFamily:"'General Sans',monospace", color:'#999', textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:4 }}>{label}</p>
      <p style={{ fontSize:20, fontWeight:500, color:fillColor, letterSpacing:'-0.5px' }}>{value}</p>
      {sub && <p style={{ fontSize:10.5, color:'#bbb', marginTop:2 }}>{sub}</p>}
      {fillPct!==undefined && (
        <div style={{ height:3, background:'rgba(0,0,0,0.07)', borderRadius:999, marginTop:7, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${fillPct}%`, background:fillColor, borderRadius:999, transition:'width 0.7s ease' }}/>
        </div>
      )}
    </div>
  )
}
