import crypto from 'crypto'

/**
 * Lemon Squeezy server helpers - create a hosted/overlay checkout for a variant,
 * and verify inbound webhook signatures. All secrets come from env; nothing here
 * is exposed to the client.
 */
const API = 'https://api.lemonsqueezy.com/v1'

export function isLemonConfigured(): boolean {
  return Boolean(process.env.LS_API_KEY && process.env.LS_STORE_ID)
}

interface CheckoutArgs {
  variantId: string
  userId: string
  email: string
  name?: string
  plan: string
  redirectUrl: string
}

/** Create a checkout and return its URL (embeddable via Lemon.js). */
export async function createCheckoutUrl(a: CheckoutArgs): Promise<string | null> {
  const key = process.env.LS_API_KEY
  const storeId = process.env.LS_STORE_ID
  if (!key || !storeId) return null

  const res = await fetch(`${API}/checkouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          // Prefill + attach who's buying so the webhook can map the subscription
          // back to our user. LS returns `custom` verbatim in the webhook meta.
          checkout_data: {
            email: a.email,
            name: a.name || undefined,
            custom: { user_id: a.userId, plan: a.plan },
          },
          product_options: { redirect_url: a.redirectUrl },
          // Full hosted checkout page (not the cramped Lemon.js overlay).
          checkout_options: { embed: false },
        },
        relationships: {
          store:   { data: { type: 'stores', id: String(storeId) } },
          variant: { data: { type: 'variants', id: String(a.variantId) } },
        },
      },
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    console.error('[LS checkout]', res.status, await res.text().catch(() => ''))
    return null
  }
  const j = await res.json().catch(() => null) as { data?: { attributes?: { url?: string } } } | null
  return j?.data?.attributes?.url ?? null
}

/**
 * The variant a subscription is on, read from Lemon Squeezy. Invoice webhooks
 * (subscription_payment_*) carry no variant, so this is how a payment that
 * arrives before its subscription_created event still maps to the right plan.
 */
export async function subscriptionVariantId(subscriptionId: string): Promise<string | null> {
  const key = process.env.LS_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`${API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/vnd.api+json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const j = await res.json().catch(() => null) as { data?: { attributes?: { variant_id?: number | string } } } | null
    const v = j?.data?.attributes?.variant_id
    return v == null ? null : String(v)
  } catch {
    return null
  }
}

/** Verify the `X-Signature` HMAC-SHA256 of the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LS_WEBHOOK_SECRET
  if (!secret || !signature) return false
  try {
    const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const a = Buffer.from(digest, 'hex')
    const b = Buffer.from(signature, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
