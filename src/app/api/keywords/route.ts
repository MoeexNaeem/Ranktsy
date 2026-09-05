import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { KeywordHistory, SavedKeyword } from '@/lib/models'
import { getKeywordCore } from '@/lib/keywords'
import { normalizeGeo } from '@/lib/google-ads'
import { getCurrentUser } from '@/lib/auth/session'
import { guardSearch } from '@/lib/searchGate'
import { consumeDailySearch } from '@/lib/quota'
import { withUsage } from '@/lib/track'
import { recordSearch, recordCacheHit, recordApiHit, peekApiCalls } from '@/lib/usage'
import type { ApiResponse, KeywordSearchResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Keyword CORE - the fast path (~3 Etsy calls, ~1–2s).
 *
 * Returns everything the page needs to paint: stats, listings, search analysis
 * and the related keyword list. Related rows come back with `competition: null`
 * until /api/keywords/related probes each one for real; near matches live at
 * /api/keywords/near-matches. The client fires all three in parallel so the page
 * renders immediately instead of waiting ~13s for the full fan-out.
 */
export const GET = withUsage(async (req: NextRequest): Promise<NextResponse<ApiResponse<KeywordSearchResponse>>> => {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()
  const geo = normalizeGeo(searchParams.get('geo'))

  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  // Rate gate: 25 searches/hour per user, then a reCAPTCHA to continue.
  const gate = await guardSearch<KeywordSearchResponse>(req)
  if (gate) return gate

  // Per-plan DAILY search quota (independent of the hourly bot gate).
  const authUser = await getCurrentUser().catch(() => null)
  if (authUser) {
    await connectDB()
    const q = await consumeDailySearch(authUser.id)
    if (q && !q.allowed) {
      return NextResponse.json(
        { success: false, code: 'plan_limit', metric: 'searches', plan: q.plan, limit: q.limit,
          error: `You've reached your daily limit of ${q.limit} keyword search${q.limit === 1 ? '' : 'es'} on the ${q.plan} plan. Upgrade to keep researching.` },
        { status: 402 },
      )
    }
  }

  try {
    const before = peekApiCalls()
    const data = await getKeywordCore(query, geo)

    // Usage analytics: one search, and whether it was served from cache/DB (no API
    // calls) or required a live fetch.
    recordSearch()
    if (peekApiCalls() > before) recordApiHit(); else recordCacheHit()

    // Search history is a side-effect of the request, not part of it.
    // We record two things, both fire-and-forget so a write hiccup never fails the
    // search: (1) KeywordHistory (per-user recent searches) and (2) SavedKeyword,
    // the admin-facing store of every keyword users run, tagged with the local
    // Asia/Karachi calendar day so the admin date filter matches the team's day.
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date())
    getCurrentUser()
      .then(user => connectDB().then(() => Promise.all([
        KeywordHistory.create({ keyword: query, userId: user?.id }),
        SavedKeyword.create({ keyword: query, geo, userId: user?.id ?? null, userEmail: user?.email ?? null, day, createdAt: new Date() }),
      ])))
      .catch(() => {})

    return NextResponse.json({ success: true, data, cached: !!data.cachedAt })
  } catch (err) {
    console.error('[Keywords] Etsy API error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch keyword data from Etsy. Check your ETSY_API_KEY.' },
      { status: 502 },
    )
  }
})
