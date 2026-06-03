import { C } from '@/utils'

const VARIANTS: Record<string,React.CSSProperties> = {
  green:  { background:`${C.forest}14`, color:C.forest },
  yellow: { background:`${C.mutedYellow}20`, color:'#7a7320' },
  teal:   { background:`${C.mutedTeal}22`, color:C.mutedTeal },
  pale:   { background:C.pale, color:C.forest },
  ghost:  { background:C.warmGray, color:'#666' },
}

export function Badge({ children, variant='green', style }: { children:React.ReactNode; variant?:string; style?:React.CSSProperties }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:999, fontSize:10, fontWeight:500, ...VARIANTS[variant], ...style }}>
      {children}
    </span>
  )
}
