import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { KeywordHistory, SavedKeyword } from '@/lib/models'
import { getKeywordCore } from '@/lib/keywords'
import { recordObservedListings } from '@/lib/snapshots'
import { getListingReviewStats } from '@/lib/etsy'
import { normalizeGeo } from '@/lib/google-ads'
import { getCurrentUser } from '@/lib/auth/session'
import { guardSearch } from '@/lib/searchGate'
import { consumeDailySearch, peekDailySearch } from '@/lib/quota'
import { canAfford, consumeCredits, recordCharge, CREDIT_COST } from '@/lib/credits'
import { PLAN_LABELS } from '@/lib/plans'
import { withUsage } from '@/lib/track'
import { recordSearch, recordCacheHit, recordApiHit, peekApiCalls } from '@/lib/usage'
import { upstreamFailure } from '@/lib/upstream-errors'
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

  // Two meters, both CHECKED here and only COUNTED once a result is delivered, so
  // an upstream failure never costs the user anything: the per-plan searches/day
  // cap, and CREDIT_COST credits (same flat price as every other metered tool).
  const authUser = await getCurrentUser().catch(() => null)
  if (authUser) {
    await connectDB()
    const q = await peekDailySearch(authUser.id)
    if (q && !q.allowed) {
      return NextResponse.json(
        { success: false, code: 'plan_limit', metric: 'searches', plan: q.plan, limit: q.limit,
          error: `You've reached your daily limit of ${q.limit} keyword search${q.limit === 1 ? '' : 'es'} on the ${q.plan} plan. Upgrade to keep researching.` },
        { status: 402 },
      )
    }
    const afford = await canAfford(authUser.id, CREDIT_COST)
    if (afford && !afford.ok) {
      return NextResponse.json({
        success: false, code: 'credit_limit', plan: afford.plan,
        error: `You've used all ${afford.limit} of today's credits on the ${PLAN_LABELS[afford.plan]} plan. Upgrade for a higher daily allowance, or come back tomorrow.`,
        state: { credits: afford.credits, limit: afford.limit, usedToday: afford.usedToday, plan: afford.plan },
      }, { status: 402 })
    }
  }

  try {
    const before = peekApiCalls()
    const data = await getKeywordCore(query, geo)

    // Seed tracking: every search enrolls this keyword's ranking listings into the
    // snapshot set, so they start accruing history TODAY (not only when someone
    // happens to browse them). Fire-and-forget - never blocks or fails the search.
    // This is what makes Market Activity fill in faster the more the tool is used.
    if (data.listings?.length) {
      void recordObservedListings(data.listings
        .filter(l => l.listing_id && l.shop_id)
        .map(l => ({
          listingId: l.listing_id,
          shopId: l.shop_id as number,
          title: l.title,
          tags: l.tags,
          price: l.price?.amount ? l.price.amount / (l.price.divisor || 100) : null,
          currency: l.price?.currency_code,
          views: l.views,
          favorers: l.num_favorers,
        }))).catch(() => {})
    }

    // Usage analytics: one search, and whether it was served from cache/DB (no API
    // calls) or required a live fetch.
    const wasLive = peekApiCalls() > before
    recordSearch()
    if (wasLive) recordApiHit(); else recordCacheHit()

    // Seed REVIEW counts for the top listings on a fresh (uncached) search. Etsy's
    // search endpoint omits review counts, so without this Sales and Reviews in
    // Market Activity stay 0 forever. Fire-and-forget, top 10 only, live searches
    // only, so the extra Etsy-call cost stays bounded; reviewCount merges into
    // today's snapshot (upsert on listingId+day) and its day-over-day growth then
    // drives real sales/reviews.
    if (wasLive && data.listings?.length) {
      const top = data.listings.filter(l => l.listing_id && l.shop_id).slice(0, 10)
      void (async () => {
        const rows = await Promise.all(top.map(async l => {
          const rs = await getListingReviewStats(l.listing_id).catch(() => null)
          return rs?.count != null ? { listingId: l.listing_id, shopId: l.shop_id as number, reviewCount: rs.count } : null
        }))
        const valid = rows.filter((r): r is { listingId: number; shopId: number; reviewCount: number } => !!r)
        if (valid.length) await recordObservedListings(valid)
      })().catch(() => {})
    }

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

    // A 200 is not the same as a usable answer. Charge only for a result the user
    // can actually act on: the keyword's own stats, plus either ranking listings
    // or related keywords. A hollow shell (marketplace unreachable, nothing found)
    // is delivered for free.
    const usable = !!data?.stats && (data.listings?.length > 0 || data.related?.length > 0)

    // Charged here because this is the last point the server can be certain the
    // answer is good; if the client then fails to receive or render it, it calls
    // /api/credits/refund and recordCharge is what lets that be reversed.
    const [counted, charged] = authUser && usable
      ? await Promise.all([
          consumeDailySearch(authUser.id).catch(() => null),
          consumeCredits(authUser.id, CREDIT_COST).catch(() => null),
        ])
      : [null, null]
    if (authUser && usable) {
      await recordCharge(authUser.id, 'keywords', charged?.allowed ? CREDIT_COST : 0, !!counted?.allowed)
    }

    return NextResponse.json({
      success: true, data, cached: !!data.cachedAt,
      searches: counted ? { used: counted.used, limit: Number.isFinite(counted.limit) ? counted.limit : null } : undefined,
      state: charged ? { credits: charged.credits, limit: charged.limit, usedToday: charged.usedToday, plan: charged.plan } : undefined,
    })
  } catch (err) {
    // Uncounted: the user asked for a result and did not get one.
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
})
