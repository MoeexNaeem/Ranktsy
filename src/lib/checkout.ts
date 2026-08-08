import toast from 'react-hot-toast'

export type CheckoutResult = 'redirecting' | 'needs_login' | 'error'

/**
 * Start a Lemon Squeezy checkout for a plan slug.
 * - not logged in → returns 'needs_login' (caller shows a login prompt)
 * - success → navigates to the hosted checkout and returns 'redirecting'
 *   (the caller should KEEP its loader on, since the page is leaving)
 * - failure → toasts and returns 'error'
 */
export async function startCheckout(slug: string): Promise<CheckoutResult> {
  try {
    const res = await fetch('/api/lemonsqueezy/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: slug }),
    })
    if (res.status === 401) return 'needs_login'
    const j = await res.json().catch(() => null) as { success?: boolean; url?: string; error?: string } | null
    if (j?.success && j.url) {
      window.location.href = j.url
      return 'redirecting'
    }
    toast.error(j?.error || 'Could not start checkout. Please try again.')
    return 'error'
  } catch {
    toast.error('Could not start checkout. Please try again.')
    return 'error'
  }
}
