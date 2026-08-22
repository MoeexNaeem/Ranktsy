'use client'
import { useState, type CSSProperties } from 'react'
import { startCheckout } from '@/lib/checkout'

/**
 * A deal's call-to-action. When `plan` is set it starts a Lemon Squeezy
 * checkout for that plan (the same flow the pricing page uses) - sending the
 * buyer straight to the hosted checkout. If the visitor isn't logged in we
 * bounce them to login and return here. When no `plan` is given it's a plain
 * link to `url`.
 */
export function DealCta({ plan, url, label, style }: { plan?: string; url?: string; label: string; style?: CSSProperties }) {
  const [loading, setLoading] = useState(false)

  const base: CSSProperties = {
    display: 'inline-block', textAlign: 'center', textDecoration: 'none', cursor: 'pointer',
    background: '#FB5E09', color: '#fff', border: 'none', borderRadius: 100,
    padding: '14px 30px', fontSize: 16, fontWeight: 600, fontFamily: 'inherit', letterSpacing: '-0.01em',
    ...style,
  }

  if (plan) {
    return (
      <button type="button" disabled={loading} style={{ ...base, opacity: loading ? 0.85 : 1 }}
        onClick={async () => {
          setLoading(true)
          const r = await startCheckout(plan)
          if (r === 'needs_login') {
            const back = encodeURIComponent(window.location.pathname + window.location.search)
            window.location.href = `/login?redirect=${back}`
          } else if (r === 'error') {
            setLoading(false)
          }
          // On 'redirecting' we're leaving the page - keep the spinner.
        }}>
        {loading ? 'Starting checkout…' : label}
      </button>
    )
  }

  const href = url || '/pricing'
  const external = /^https?:\/\//i.test(href)
  return (
    <a href={href} style={base} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{label}</a>
  )
}
