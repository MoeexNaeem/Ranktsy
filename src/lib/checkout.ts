import toast from 'react-hot-toast'

/**
 * Start a Lemon Squeezy checkout for a plan slug. Not logged in → send to login;
 * otherwise redirect to the full hosted checkout page. Shared by the pricing
 * cards and the upgrade modal.
 */
export async function startCheckout(slug: string): Promise<void> {
  try {
    const res = await fetch('/api/lemonsqueezy/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: slug }),
    })
    if (res.status === 401) {
      window.location.href = `/login?redirect=${encodeURIComponent('/pricing')}`
      return
    }
    const j = await res.json().catch(() => null) as { success?: boolean; url?: string; error?: string } | null
    if (j?.success && j.url) window.location.href = j.url
    else toast.error(j?.error || 'Could not start checkout. Please try again.')
  } catch {
    toast.error('Could not start checkout. Please try again.')
  }
}
