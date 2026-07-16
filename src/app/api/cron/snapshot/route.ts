import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TrackedShop, ShopSnapshot } from '@/lib/models'
import { getEtsyShop } from '@/lib/etsy'
import { dayKey } from '@/lib/snapshots'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily snapshot job — guarantees a row for every tracked shop even when nobody
 * browses it. Ordinary traffic already captures shops opportunistically (see
 * lib/snapshots.ts); this closes the gap for shops users are tracking but not
 * actively viewing.
 *
 * Schedule once per day. On Vercel, add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/snapshot", "schedule": "0 3 * * *" }] }
 *
 * Auth: set CRON_SECRET and send `Authorization: Bearer <secret>`. Vercel Cron
 * sends this header automatically. Without CRON_SECRET set, the route refuses to
 * run rather than sitting open — an unauthenticated endpoint that burns the Etsy
 * rate budget is a liability.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET is not configured — refusing to run unauthenticated.' },
      { status: 503 },
    )
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const day = dayKey()
  try {
    await connectDB()

    // Distinct shops across all users — two users tracking the same shop is one fetch.
    const tracked = await TrackedShop.find({}).select('shopId shopName').lean()
    const unique = [...new Map(tracked.map(t => [t.shopId, t])).values()]

    // Skip shops already captured today so a re-run is cheap and idempotent.
    const done = await ShopSnapshot.find({ day, shopId: { $in: unique.map(u => u.shopId) } })
      .select('shopId').lean()
    const doneIds = new Set(done.map(d => d.shopId))
    const todo = unique.filter(u => !doneIds.has(u.shopId))

    let captured = 0
    const failed: number[] = []

    // Sequential on purpose: getEtsyShop already goes through the shared rate
    // gate, and a nightly job has no reason to contend with live user requests.
    for (const t of todo) {
      try {
        await getEtsyShop(t.shopId)   // records the snapshot as a side-effect
        captured++
      } catch (e) {
        console.error(`[Cron] shop ${t.shopId} failed:`, e)
        failed.push(t.shopId)
      }
    }

    return NextResponse.json({
      success: true,
      data: { day, tracked: unique.length, alreadyCaptured: doneIds.size, captured, failed: failed.length, failedIds: failed },
    })
  } catch (e) {
    console.error('[Cron] snapshot job failed:', e)
    return NextResponse.json({ success: false, error: 'Snapshot job failed' }, { status: 500 })
  }
}
