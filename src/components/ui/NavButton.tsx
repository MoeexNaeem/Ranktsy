'use client'
import { useTransition, type ReactNode, type CSSProperties, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

/**
 * A link-styled button that shows a spinner from the moment it's clicked until the
 * destination route actually commits. App Router navigations can take a beat while
 * the next page's data loads, so wrapping router.push in a transition lets us keep
 * the caller informed instead of leaving a dead-looking button. Drop-in for a
 * <Link> where a loading affordance matters (dashboard / admin entry points).
 */
function Spinner({ color = '#fff', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}

export function NavButton({
  href, children, style, className, spinnerColor = '#fff', spinnerSize, onNavigate,
  onMouseEnter, onMouseLeave, title,
}: {
  href: string
  children: ReactNode
  style?: CSSProperties
  className?: string
  spinnerColor?: string
  spinnerSize?: number
  onNavigate?: () => void
  onMouseEnter?: (e: MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: (e: MouseEvent<HTMLButtonElement>) => void
  title?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className={className}
      title={title}
      disabled={pending}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => { onNavigate?.(); start(() => router.push(href)) }}
      style={{ ...style, position: 'relative', cursor: pending ? 'progress' : (style?.cursor ?? 'pointer') }}
    >
      <span style={{ visibility: pending ? 'hidden' : 'visible', display: 'inline-flex', alignItems: 'center', gap: (style as CSSProperties)?.gap }}>{children}</span>
      {pending && <Spinner color={spinnerColor} size={spinnerSize} />}
    </button>
  )
}
