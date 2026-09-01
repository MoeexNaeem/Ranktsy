import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TrackedKeyword } from '@/lib/models'
import { fetchMetrics, describeChange } from '@/lib/alerts'
import { notifyUser } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// How many trackers to re-check per run. Bounds API cost (checks are cache-first, but
// this caps the worst case). Oldest-checked first, so all keywords rotate through.
const BATCH = Number(process.env.ALERTS_BATCH) || 40

/**
 * Keyword-alerts job. Re-checks tracked keywords and raises an in-app notification when
 * volume, competition, or difficulty moves enough. The baseline resets to the current
 * value only when we notify, so gradual drift accumulates until it crosses a threshold.
 * Schedule hourly or daily. Auth: CRON_SECRET via `Authorization: Bearer <secret>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ success: false, error: 'CRON_SECRET is not configured.' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const due = await TrackedKeyword.find().sort({ lastCheckedAt: 1 }).limit(BATCH)

  let checked = 0, notified = 0
  for (const t of due) {
    checked++
    try {
      const cur = await fetchMetrics(t.keyword, t.country)
      const base = { volume: t.baseVolume ?? null, competition: t.baseCompetition ?? null, difficulty: t.baseDifficulty ?? null }
      const msgs = describeChange(base, cur)
      if (msgs.length) {
        await notifyUser(t.userId, `Keyword alert: ${t.keyword}`, msgs.join('. '), '/dashboard?tab=alerts', 'alert')
        t.baseVolume = cur.volume; t.baseCompetition = cur.competition; t.baseDifficulty = cur.difficulty
        t.lastNotifiedAt = new Date()
        notified++
      }
      t.lastCheckedAt = new Date()
      await t.save()
    } catch {
      t.lastCheckedAt = new Date()
      await t.save().catch(() => {})
    }
  }

  return NextResponse.json({ success: true, data: { checked, notified } })
}
