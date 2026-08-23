import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { connectDB } from '@/lib/db'
import { AutomationRun } from '@/lib/models'
import { serializeRun } from '@/lib/automation/serialize'
import { generateListing } from '@/lib/automation/orchestrator'
import { getValidEtsyAuth } from '@/lib/etsy-tokens'
import { createDraftListing } from '@/lib/etsy'

/**
 * Advance a run by ONE product: generate the listing, optionally push it to Etsy
 * as a draft, mark the item done/error, and report the whole run back. The client
 * calls this repeatedly until the run is done (a proper queue/worker can call the
 * exact same endpoint later — the run is fully resumable).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await connectDB()
  const run = await AutomationRun.findOne({ _id: id, userId: user.id })
  if (!run) return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 })

  // Terminal states just echo back.
  if (run.status === 'done' || run.status === 'error' || run.status === 'canceled') {
    return NextResponse.json({ success: true, data: serializeRun(run.toObject()) })
  }

  const item = run.items.find(i => i.status === 'pending')
  if (!item) {
    run.status = 'done'
    await run.save()
    return NextResponse.json({ success: true, data: serializeRun(run.toObject()) })
  }

  run.status = 'running'
  item.status = 'running'
  await run.save()

  try {
    const listing = await generateListing(item.keyword, run.geo, run.options)
    if (!listing) {
      item.status = 'error'
      item.error = 'AI generation failed'
    } else {
      item.title = listing.title
      item.tags = listing.tags
      item.description = listing.description
      item.price = listing.price ?? undefined

      if (run.publishToEtsy && run.taxonomyId) {
        if (!listing.price || listing.price <= 0) {
          item.status = 'error'
          item.error = 'No price generated — draft not created'
        } else {
          const auth = await getValidEtsyAuth(user.id, run.shopId)
          if (!auth) {
            item.status = 'error'
            item.error = 'Etsy shop not connected'
          } else {
            try {
              const created = await createDraftListing(auth.accessToken, auth.shopId, {
                title: listing.title,
                description: listing.description,
                tags: listing.tags,
                price: listing.price,
                quantity: run.quantity,
                taxonomyId: run.taxonomyId,
                type: run.listingType,
                whoMade: run.whoMade,
              })
              item.listingId = created.listingId
              item.listingUrl = created.url
              item.status = 'done'
            } catch (e) {
              item.status = 'error'
              item.error = 'Etsy: ' + (e instanceof Error ? e.message.replace(/^Etsy createListing \d+: /, '').slice(0, 220) : 'upload failed')
            }
          }
        }
      } else {
        item.status = 'done'   // draft not requested — content generated only
      }
    }
  } catch (e) {
    item.status = 'error'
    item.error = e instanceof Error ? e.message.slice(0, 220) : 'error'
  }

  run.status = run.items.some(i => i.status === 'pending') ? 'running' : 'done'
  await run.save()
  return NextResponse.json({ success: true, data: serializeRun(run.toObject()) })
}
