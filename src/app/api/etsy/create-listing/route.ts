import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getValidEtsyAuth } from '@/lib/etsy-tokens'
import { createDraftListing, isEtsyAuthExpired, type CreateListingInput } from '@/lib/etsy'
import { withUsage } from '@/lib/track'
import type { ApiResponse } from '@/types'

/**
 * Push an AI-generated listing to the signed-in seller's OWN Etsy shop as a DRAFT.
 *
 * Draft only - it lands in the seller's "Drafts" on Etsy for them to review and
 * publish; nothing goes live from here. Needs a connected shop AND the `listings_w`
 * scope (added Aug 2026) - sellers connected before that must reconnect once.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withUsage(async (req: NextRequest): Promise<NextResponse<ApiResponse<{ listingId: number; url: string; state: string }>>> => {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Please log in.' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const shopId = typeof body.shopId === 'string' || typeof body.shopId === 'number' ? String(body.shopId) : undefined

  const auth = await getValidEtsyAuth(user.id, shopId)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Connect your Etsy shop first (My Shop → Connect).' }, { status: 400 })
  }

  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const price = Number(body.price)
  const taxonomyId = Number(body.taxonomyId)
  const quantity = Number(body.quantity ?? 1)

  if (title.length < 3) return NextResponse.json({ success: false, error: 'A title is required.' }, { status: 400 })
  if (description.length < 3) return NextResponse.json({ success: false, error: 'A description is required.' }, { status: 400 })
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ success: false, error: 'Enter a valid price.' }, { status: 400 })
  if (!Number.isInteger(taxonomyId) || taxonomyId <= 0) return NextResponse.json({ success: false, error: 'Pick a category (taxonomy) for the listing.' }, { status: 400 })

  const type = (['physical', 'download', 'both'] as const).includes(body.type as never) ? body.type as CreateListingInput['type'] : 'physical'
  const whoMade = (['i_did', 'someone_else', 'collective'] as const).includes(body.whoMade as never) ? body.whoMade as CreateListingInput['whoMade'] : 'i_did'

  const input: CreateListingInput = {
    title, description, price, quantity, taxonomyId, type, whoMade,
    whenMade: typeof body.whenMade === 'string' ? body.whenMade : 'made_to_order',
    isSupply: !!body.isSupply,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    materials: Array.isArray(body.materials) ? body.materials.map(String) : [],
    shippingProfileId: Number(body.shippingProfileId) || undefined,
  }

  try {
    const created = await createDraftListing(auth.accessToken, auth.shopId, input)
    return NextResponse.json({ success: true, data: created })
  } catch (err) {
    // A 403 here almost always means the shop was connected before listings_w
    // existed, so the token lacks write permission - tell them how to fix it.
    if (isEtsyAuthExpired(err)) {
      return NextResponse.json({ success: false, error: 'Etsy declined the upload. Reconnect your shop in My Shop to grant listing permission, then try again.' }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : 'Upload failed.'
    // Surface Etsy's own validation text (it names the missing field) but keep it short.
    return NextResponse.json({ success: false, error: `Etsy rejected the listing. ${msg.replace(/^Etsy createListing \d+: /, '').slice(0, 300)}` }, { status: 502 })
  }
})
