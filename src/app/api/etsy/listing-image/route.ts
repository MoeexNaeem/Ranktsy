import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getValidEtsyAuth } from '@/lib/etsy-tokens'
import { uploadListingImage, isEtsyAuthExpired } from '@/lib/etsy'
import type { ApiResponse } from '@/types'

/**
 * Attach the seller's own photos to a draft created by /api/etsy/create-listing.
 *
 * Takes multipart/form-data: `listingId` (the draft's id), optional `shopId`, and
 * one or more `image` file parts (sent in display order). Uploads each to Etsy so
 * the draft becomes a photo-complete listing the seller can review and publish.
 * Draft only - nothing goes live here. Needs a connected shop with `listings_w`.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IMAGES = 10
const MAX_BYTES = 10 * 1024 * 1024 // Etsy's per-image cap
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif'])

export const POST = async (req: NextRequest): Promise<NextResponse<ApiResponse<{ uploaded: number }>>> => {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Please log in.' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Expected image upload data.' }, { status: 400 })
  }

  const listingId = Number(form.get('listingId'))
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return NextResponse.json({ success: false, error: 'Missing listing id.' }, { status: 400 })
  }
  const shopId = typeof form.get('shopId') === 'string' && form.get('shopId') ? String(form.get('shopId')) : undefined

  const files = form.getAll('image').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) {
    return NextResponse.json({ success: false, error: 'Add at least one photo.' }, { status: 400 })
  }
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ success: false, error: `Etsy allows up to ${MAX_IMAGES} photos per listing.` }, { status: 400 })
  }
  for (const f of files) {
    if (!ALLOWED.has(f.type)) return NextResponse.json({ success: false, error: 'Photos must be JPG, PNG or GIF.' }, { status: 400 })
    if (f.size > MAX_BYTES) return NextResponse.json({ success: false, error: 'Each photo must be under 10MB.' }, { status: 400 })
  }

  const auth = await getValidEtsyAuth(user.id, shopId)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Connect your Etsy shop first (My Shop → Connect).' }, { status: 400 })
  }

  let uploaded = 0
  try {
    // Sequential, not parallel: Etsy rate-limits (10/sec) and ranks images by
    // upload order, so uploading one at a time keeps the display order stable.
    for (let i = 0; i < files.length; i++) {
      const buf = new Uint8Array(await files[i].arrayBuffer())
      await uploadListingImage(auth.accessToken, auth.shopId, listingId, {
        data: buf,
        filename: files[i].name || `image-${i + 1}.jpg`,
        contentType: files[i].type,
        rank: i + 1,
      })
      uploaded++
    }
    return NextResponse.json({ success: true, data: { uploaded } })
  } catch (err) {
    if (isEtsyAuthExpired(err)) {
      return NextResponse.json({ success: false, error: 'Etsy declined the photo upload. Reconnect your shop in My Shop, then try again.' }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : 'Photo upload failed.'
    // Partial success is possible (some photos landed before one failed) - report it.
    const detail = uploaded > 0 ? `${uploaded} of ${files.length} photos uploaded. ` : ''
    return NextResponse.json({ success: false, error: `${detail}${msg.replace(/^Etsy uploadImage \d+: /, '').slice(0, 240)}` }, { status: 502 })
  }
}
