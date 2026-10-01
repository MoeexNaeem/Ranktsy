import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AutomationRun } from '@/lib/models'
import { expandNiche } from '@/lib/automation/orchestrator'
import { normalizeConfig } from '@/lib/automation/config'
import { requireAutomationUser } from '@/lib/automation/guard'
import { withUsage } from '@/lib/track'

// "Automate Etsy Shop": create a batch run. Admin-only for now.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ITEMS = 25

async function handlePOST(req: NextRequest) {
  const { error, user } = await requireAutomationUser()
  if (error || !user) return error

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const mode = body.mode === 'niche' ? 'niche' : body.mode === 'products' ? 'products' : 'keywords'
  const geo = String(body.geo || 'US').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'US'
  const count = Math.max(1, Math.min(MAX_ITEMS, Number(body.count) || 5))
  const cfg = normalizeConfig(body.config)

  // Publishing needs enough to make a draft Etsy will accept.
  if (cfg.publish.enabled) {
    if (!cfg.publish.shopId) return NextResponse.json({ success: false, error: 'Pick a shop on the Shop node.' }, { status: 400 })
    if (cfg.details.type === 'physical' && !cfg.delivery.shippingProfileId) {
      return NextResponse.json({ success: false, error: 'Physical listings need a shipping profile. Pick one on the Delivery node (or switch Details to Digital).' }, { status: 400 })
    }
  }

  await connectDB()

  type NewItem = { idx: number; keyword: string; status: 'pending'; hint?: string; fromPhotos?: boolean; imageCount?: number; fileCount?: number }
  let items: NewItem[] = []
  let keywords: string[] = []
  if (mode === 'products') {
    // The seller's own products: photos + files stay in their browser and are sent
    // per item by the client; the run records what to expect for each.
    const products = (Array.isArray(body.products) ? body.products : []).slice(0, MAX_ITEMS) as Record<string, unknown>[]
    items = products.map((p, idx) => {
      const hint = String(p.hint ?? '').trim().slice(0, 200)
      return {
        idx, keyword: hint || `product ${idx + 1}`, status: 'pending' as const, hint: hint || undefined, fromPhotos: true,
        imageCount: Math.max(0, Math.min(20, Number(p.imageCount) || 0)),
        fileCount: Math.max(0, Math.min(5, Number(p.fileCount) || 0)),
      }
    }).filter(i => i.hint || i.imageCount)
    if (!items.length) return NextResponse.json({ success: false, error: 'Add at least one product with photos (or a short note).' }, { status: 400 })
    if (cfg.details.type === 'download' && cfg.publish.enabled && cfg.publish.uploadFiles && items.some(i => !i.fileCount)) {
      return NextResponse.json({ success: false, error: 'Digital listings need their download file. Add a file to every product, or turn off "Upload digital files" on the Create Draft node.' }, { status: 400 })
    }
    keywords = items.map(i => i.keyword)
  } else if (mode === 'niche') {
    const niche = String(body.niche || '').trim()
    if (niche.length < 2) return NextResponse.json({ success: false, error: 'Enter a niche.' }, { status: 400 })
    keywords = await expandNiche(niche, count, geo)
    if (!keywords.length) return NextResponse.json({ success: false, error: 'Could not generate product ideas. Check the automation AI key, or use keyword mode.' }, { status: 502 })
  } else {
    const seeds = Array.isArray(body.seeds) ? body.seeds : []
    keywords = [...new Set(seeds.map(s => String(s).trim().toLowerCase()).filter(s => s.length >= 2))].slice(0, count)
    if (!keywords.length) return NextResponse.json({ success: false, error: 'Enter at least one keyword (one per line).' }, { status: 400 })
  }
  if (mode !== 'products') items = keywords.map((keyword, idx) => ({ idx, keyword, status: 'pending' as const }))

  const run = await AutomationRun.create({
    userId: user.id,
    status: 'pending',
    mode,
    niche: mode === 'niche' ? String(body.niche || '').trim() : undefined,
    geo,
    // Legacy flat fields kept in sync so older code paths / admin views still read them.
    publishToEtsy: cfg.publish.enabled,
    shopId: cfg.publish.shopId ?? undefined,
    taxonomyId: cfg.category.taxonomyId ?? undefined,
    listingType: cfg.details.type,
    whoMade: cfg.details.whoMade,
    quantity: cfg.price.quantity,
    config: cfg as unknown as Record<string, unknown>,
    items,
  })

  return NextResponse.json({ success: true, data: { id: String(run._id), items: items.length, keywords } })
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const POST = withUsage(handlePOST)
