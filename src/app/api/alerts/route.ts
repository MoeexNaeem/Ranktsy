import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TrackedKeyword } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { fetchMetrics } from '@/lib/alerts'

export const runtime = 'nodejs'

const MAX_PER_USER = Number(process.env.MAX_TRACKED_KEYWORDS) || 30

// List the keywords this user is watching for alerts.
export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  await connectDB()
  const rows = await TrackedKeyword.find({ userId: auth.id }).sort({ createdAt: -1 }).lean()
  const items = rows.map(r => ({
    id: String(r._id),
    keyword: r.keyword,
    country: r.country,
    volume: r.baseVolume ?? null,
    competition: r.baseCompetition ?? null,
    difficulty: r.baseDifficulty ?? null,
    lastCheckedAt: r.lastCheckedAt ?? null,
  }))
  return NextResponse.json({ success: true, data: { items, max: MAX_PER_USER } })
}

// Track a keyword. Captures the current metrics as the baseline to compare against.
export async function POST(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const keyword = String(body.keyword ?? '').trim().toLowerCase()
  const country = String(body.country ?? 'GLO').trim().toUpperCase() || 'GLO'
  if (keyword.length < 2) return NextResponse.json({ success: false, error: 'Keyword is required.' }, { status: 400 })
  if (keyword.length > 120) return NextResponse.json({ success: false, error: 'Keyword is too long.' }, { status: 400 })

  await connectDB()
  const existing = await TrackedKeyword.findOne({ userId: auth.id, keyword, country }).select('_id').lean()
  if (!existing) {
    const count = await TrackedKeyword.countDocuments({ userId: auth.id })
    if (count >= MAX_PER_USER) {
      return NextResponse.json({ success: false, error: `You can track up to ${MAX_PER_USER} keywords. Remove one first.` }, { status: 400 })
    }
  }

  const m = await fetchMetrics(keyword, country).catch(() => ({ volume: null, competition: null, difficulty: null }))
  const doc = await TrackedKeyword.findOneAndUpdate(
    { userId: auth.id, keyword, country },
    { $set: { baseVolume: m.volume, baseCompetition: m.competition, baseDifficulty: m.difficulty, lastCheckedAt: new Date() } },
    { upsert: true, new: true },
  ).lean<{ _id: unknown }>()

  return NextResponse.json({ success: true, data: { id: String(doc._id), keyword, country, ...m } })
}
