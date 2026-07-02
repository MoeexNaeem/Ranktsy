import { C } from '@/utils'

const VARIANTS: Record<string,React.CSSProperties> = {
  green:  { background:`${C.charcoal}14`, color:C.charcoal },
  yellow: { background:`${C.orangeLight}20`, color:'#7a7320' },
  teal:   { background:`${C.charcoal}22`, color:C.charcoal },
  pale:   { background:C.orange, color:C.snow },
  ghost:  { background:C.warmGray, color:'#666' },
}

export function Badge({ children, variant='green', style }: { children:React.ReactNode; variant?:string; style?:React.CSSProperties }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:999, fontSize:10, fontWeight:500, ...VARIANTS[variant], ...style }}>
      {children}
    </span>
  )
}
