import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AutomationRun, type IAutomationRun } from '@/lib/models'
import { serializeRun } from '@/lib/automation/serialize'
import { generateListing, ListingError } from '@/lib/automation/orchestrator'
import { normalizeConfig, buildSku, whenMadeValue } from '@/lib/automation/config'
import { requireAutomationUser } from '@/lib/automation/guard'
import { getValidEtsyAuth } from '@/lib/etsy-tokens'
import { createDraftListing, updateListingProperty, setListingSku } from '@/lib/etsy'
import { withUsage } from '@/lib/track'
import type { GeminiRefImage } from '@/lib/gemini'

/**
 * Advance a run by ONE product: generate the full listing, optionally create it
 * in the shop as a draft (with its attributes + SKU), mark the item done/error,
 * and report the whole run back. The client calls this repeatedly until the run
 * is done, then uploads that item's photos / digital files via /media. A proper
 * queue/worker can call the exact same endpoint later; the run is resumable.
 *
 * Body (all optional): { idx: number (the product the previews belong to),
 * images: [{data, mimeType}] (downscaled previews for the AI, photo mode),
 * fileNames: string[], retryIdx: number }.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

const MAX_PREVIEWS = 4
const MAX_PREVIEW_CHARS = 900_000 // ~650 KB per downscaled preview, base64

/** Runs created before the full-config builder only have the flat legacy fields. */
function configOf(run: IAutomationRun) {
  if (run.config) return normalizeConfig(run.config)
  const o = (run.options ?? {}) as Record<string, unknown>
  return normalizeConfig({
    category: { mode: run.taxonomyId ? 'fixed' : 'auto', taxonomyId: run.taxonomyId },
    title: { style: o.titleStyle },
    description: { length: o.descLength },
    tags: { focus: o.tagFocus },
    price: { strategy: o.priceStrategy, quantity: run.quantity },
    details: { type: run.listingType, whoMade: run.whoMade },
    publish: { enabled: run.publishToEtsy, shopId: run.shopId },
  })
}

function etsyReason(e: unknown): string {
  return e instanceof Error ? e.message.replace(/^Etsy \w+ \d+: /, '').slice(0, 220) : 'request failed'
}

async function handlePOST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAutomationUser()
  if (error || !user) return error

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const images: GeminiRefImage[] = (Array.isArray(body.images) ? body.images : [])
    .slice(0, MAX_PREVIEWS)
    .map(i => i as Record<string, unknown>)
    .filter(i => typeof i.data === 'string' && i.data.length <= MAX_PREVIEW_CHARS && /^image\/(jpeg|png|webp)$/.test(String(i.mimeType)))
    .map(i => ({ data: String(i.data), mimeType: String(i.mimeType) }))
  const fileNames = (Array.isArray(body.fileNames) ? body.fileNames : []).slice(0, 5).map(f => String(f).slice(0, 120))

  const { id } = await params
  await connectDB()
  const run = await AutomationRun.findOne({ _id: id, userId: user.id })
  if (!run) return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 })

  // Retry one failed product: put it back in the queue and reopen the run.
  const retryIdx = body.retryIdx != null ? Number(body.retryIdx) : null
  if (retryIdx != null) {
    const it = run.items.find(i => i.idx === retryIdx)
    if (it && it.status === 'error' && !it.listingId) {
      it.status = 'pending'
      it.error = undefined
      run.status = 'running'
    }
  }

  // Terminal states just echo back.
  if (run.status === 'done' || run.status === 'error' || run.status === 'canceled') {
    return NextResponse.json({ success: true, data: serializeRun(run.toObject()) })
  }

  const wantIdx = retryIdx ?? (body.idx != null ? Number(body.idx) : null)
  const item = (wantIdx != null ? run.items.find(i => i.idx === wantIdx && i.status === 'pending') : undefined)
    ?? run.items.find(i => i.status === 'pending')
  if (!item) {
    run.status = run.items.some(i => i.status === 'pending') ? 'running' : 'done'
    await run.save()
    return NextResponse.json({ success: true, data: serializeRun(run.toObject()) })
  }

  const cfg = configOf(run)
  run.status = 'running'
  item.status = 'running'
  await run.save()

  try {
    const listing = await generateListing({
      keyword: item.fromPhotos ? (item.hint ?? '') : item.keyword,
      // Previews are only trusted for the product they were sent for.
      images: item.fromPhotos && (wantIdx == null || wantIdx === item.idx) ? images : undefined,
      fileNames: wantIdx == null || wantIdx === item.idx ? fileNames : [],
      fromPhotos: !!item.fromPhotos,
    }, run.geo, cfg)

    item.keyword = listing.keyword
    item.title = listing.title
    item.tags = listing.tags
    item.description = listing.description
    item.price = listing.price ?? undefined
    item.currency = listing.currency ?? undefined
    item.taxonomyId = listing.taxonomyId
    item.taxonomyPath = listing.taxonomyPath ?? undefined
    item.materials = listing.materials
    item.styles = listing.styles
    item.altText = listing.altText
    item.attributes = listing.attributes
    const warnings = [...listing.warnings]
    const sku = buildSku(cfg.price.sku, { n: item.idx + 1, keyword: listing.keyword })
    if (sku) item.sku = sku

    if (!cfg.publish.enabled) {
      item.status = 'done'   // content generated only, no draft requested
    } else if (!listing.price) {
      item.status = 'error'
      item.error = 'No price, draft not created. Set a Fixed price on the Price node.'
    } else {
      const auth = await getValidEtsyAuth(user.id, cfg.publish.shopId ?? undefined)
      if (!auth) {
        item.status = 'error'
        item.error = 'Etsy shop not connected (reconnect it in My Shop).'
      } else {
        const physical = cfg.details.type === 'physical'
        const personalization = cfg.details.personalization === 'off' ? null : {
          required: cfg.details.personalization === 'required',
          instructions: cfg.details.personalizationInstructions || listing.personalizationInstructions || undefined,
          charCountMax: cfg.details.personalizationMax,
        }
        try {
          const created = await createDraftListing(auth.accessToken, auth.shopId, {
            title: listing.title,
            description: listing.description,
            tags: listing.tags,
            materials: listing.materials,
            styles: listing.styles,
            price: listing.price,
            quantity: cfg.price.quantity,
            taxonomyId: listing.taxonomyId,
            type: cfg.details.type,
            whoMade: cfg.details.whoMade,
            whenMade: whenMadeValue(cfg.details.whenMade),
            isSupply: cfg.details.isSupply,
            shouldAutoRenew: cfg.details.autoRenew,
            personalization,
            shopSectionId: cfg.delivery.shopSectionId ?? undefined,
            returnPolicyId: cfg.delivery.returnPolicyId ?? undefined,
            ...(physical ? {
              shippingProfileId: cfg.delivery.shippingProfileId ?? undefined,
              readinessStateId: cfg.delivery.readinessStateId ?? undefined,
              itemWeight: cfg.delivery.weight ?? undefined,
              itemWeightUnit: cfg.delivery.weightUnit,
              itemLength: cfg.delivery.length ?? undefined,
              itemWidth: cfg.delivery.width ?? undefined,
              itemHeight: cfg.delivery.height ?? undefined,
              itemDimensionsUnit: cfg.delivery.dimUnit,
            } : {}),
          })
          item.listingId = created.listingId
          item.listingUrl = created.url
          item.status = 'done'

          // Attributes + SKU are best-effort extras: a failure is reported on the
          // item but never throws away the draft that was just created.
          for (const a of listing.attributes) {
            try { await updateListingProperty(auth.accessToken, auth.shopId, created.listingId, a) }
            catch (e) { warnings.push(`Attribute "${a.name}" not set: ${etsyReason(e)}`) }
          }
          if (sku) {
            try { await setListingSku(auth.accessToken, created.listingId, { sku, price: listing.price, quantity: cfg.price.quantity }) }
            catch (e) { warnings.push(`SKU not set: ${etsyReason(e)}`) }
          }
        } catch (e) {
          item.status = 'error'
          item.error = 'Etsy: ' + etsyReason(e)
        }
      }
    }
    item.warnings = warnings.length ? warnings.slice(0, 12) : undefined
  } catch (e) {
    item.status = 'error'
    item.error = e instanceof ListingError ? e.message : (e instanceof Error ? e.message.slice(0, 220) : 'error')
  }

  run.status = run.items.some(i => i.status === 'pending') ? 'running' : 'done'
  await run.save()
  return NextResponse.json({ success: true, data: { ...serializeRun(run.toObject()), lastIdx: item.idx } })
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const POST = withUsage(handlePOST)
