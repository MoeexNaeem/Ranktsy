import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AutomationRun } from '@/lib/models'
import { requireAutomationUser } from '@/lib/automation/guard'
import { normalizeConfig } from '@/lib/automation/config'
import { getValidEtsyAuth } from '@/lib/etsy-tokens'
import { uploadListingImage, uploadListingFile, isEtsyAuthExpired } from '@/lib/etsy'
import { withUsage } from '@/lib/track'

/**
 * Upload ONE photo or digital file to a product's draft. The client sends each
 * file in its own request (multipart: idx, kind=image|file, rank, file) right
 * after /step created the draft, so no request is bigger than one file and the
 * seller's originals never have to be stored on our side.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

const MAX_IMAGES = 20
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif'])
const MAX_FILES = 5
const MAX_FILE_BYTES = 20 * 1024 * 1024   // Etsy's per-file cap for digital downloads

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAutomationUser()
  if (error || !user) return error

  let form: FormData
  try { form = await req.formData() } catch {
    return NextResponse.json({ success: false, error: 'Expected an upload.' }, { status: 400 })
  }
  const idx = Number(form.get('idx'))
  const kind = form.get('kind') === 'file' ? 'file' : 'image'
  const rank = Math.max(1, Math.floor(Number(form.get('rank')) || 1))
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) return NextResponse.json({ success: false, error: 'No file.' }, { status: 400 })

  if (kind === 'image') {
    if (rank > MAX_IMAGES) return NextResponse.json({ success: false, error: `Etsy allows up to ${MAX_IMAGES} photos.` }, { status: 400 })
    if (!IMAGE_TYPES.has(file.type)) return NextResponse.json({ success: false, error: 'Photos must be JPG, PNG or GIF.' }, { status: 400 })
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ success: false, error: 'Each photo must be under 10 MB.' }, { status: 400 })
  } else {
    if (rank > MAX_FILES) return NextResponse.json({ success: false, error: `Etsy allows up to ${MAX_FILES} digital files.` }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ success: false, error: 'Each digital file must be under 20 MB.' }, { status: 400 })
  }

  const { id } = await params
  await connectDB()
  const run = await AutomationRun.findOne({ _id: id, userId: user.id })
  if (!run) return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 })
  const item = run.items.find(i => i.idx === idx)
  if (!item?.listingId) return NextResponse.json({ success: false, error: 'This product has no draft yet.' }, { status: 400 })
  const cfg = normalizeConfig(run.config)
  if (kind === 'file' && cfg.details.type !== 'download') {
    return NextResponse.json({ success: false, error: 'Digital files can only be attached to Digital listings.' }, { status: 400 })
  }

  const auth = await getValidEtsyAuth(user.id, cfg.publish.shopId ?? run.shopId)
  if (!auth) return NextResponse.json({ success: false, error: 'Etsy shop not connected.' }, { status: 400 })

  try {
    const data = new Uint8Array(await file.arrayBuffer())
    if (kind === 'image') {
      await uploadListingImage(auth.accessToken, auth.shopId, item.listingId, {
        data, filename: file.name || `photo-${rank}.jpg`, contentType: file.type, rank,
        altText: rank === 1 ? item.altText : (item.title ? `${item.title.split(',')[0]}, photo ${rank}` : undefined),
      })
    } else {
      await uploadListingFile(auth.accessToken, auth.shopId, item.listingId, { data, filename: file.name || `file-${rank}`, contentType: file.type, rank })
    }
    const field = kind === 'image' ? 'items.$.imagesUploaded' : 'items.$.filesUploaded'
    await AutomationRun.updateOne({ _id: run._id, 'items.idx': idx }, { $inc: { [field]: 1 } })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (isEtsyAuthExpired(e)) {
      return NextResponse.json({ success: false, error: 'Etsy declined the upload. Reconnect the shop in My Shop (needs listing write access).' }, { status: 403 })
    }
    const msg = e instanceof Error ? e.message.replace(/^Etsy upload\w+ \d+: /, '').slice(0, 220) : 'Upload failed.'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}

export const POST = withUsage(handlePOST)
