import { C } from '@/utils'

export function LoadingDots({ style }:{ style?:React.CSSProperties }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, ...style }}>
      {[0,1,2].map(i=>(
        <span key={i} className="shimmer" style={{ width:6, height:6, background:C.forest, borderRadius:'50%', display:'inline-block', animationDelay:`${i*0.15}s` }}/>
      ))}
    </span>
  )
}

export function Skeleton({ style }:{ style?:React.CSSProperties }) {
  return <div className="shimmer" style={{ background:'#ddd', borderRadius:8, ...style }}/>
}
