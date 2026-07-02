import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { C } from '@/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary'|'ghost'|'outline'|'pale'
  size?:    'sm'|'md'|'lg'
}

const BASE: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', justifyContent:'center',
  fontFamily:'inherit', fontWeight:500, cursor:'pointer', transition:'opacity 0.18s',
  border:'none',
}

const VARIANTS: Record<string,React.CSSProperties> = {
  primary: { background:C.charcoal, color:C.snow, borderRadius:999 },
  ghost:   { background:'transparent', color:C.charcoal, border:`1px solid ${C.charcoal}`, borderRadius:0 },
  outline: { background:'transparent', color:C.snow, border:'1px solid rgba(252,252,247,0.3)', borderRadius:999 },
  pale:    { background:C.orange, color:C.snow, borderRadius:999 },
}
const SIZES: Record<string,React.CSSProperties> = {
  sm: { fontSize:12, padding:'6px 14px', gap:5 },
  md: { fontSize:13.5, padding:'9px 22px', gap:7 },
  lg: { fontSize:15, padding:'14px 34px', gap:8 },
}

export const Button = forwardRef<HTMLButtonElement,ButtonProps>(
  ({ variant='primary', size='md', style, children, ...props }, ref) => (
    <button ref={ref} style={{ ...BASE, ...VARIANTS[variant], ...SIZES[size], ...style }}
      onMouseEnter={e=>(e.currentTarget.style.opacity='0.82')}
      onMouseLeave={e=>(e.currentTarget.style.opacity='1')}
      {...props}>
      {children}
    </button>
  )
)
Button.displayName = 'Button'
