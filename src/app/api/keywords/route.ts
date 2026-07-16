import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { KeywordHistory } from '@/lib/models'
import { getKeywordCore } from '@/lib/keywords'
import { getCurrentUser } from '@/lib/auth/session'
import type { ApiResponse, KeywordSearchResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Keyword CORE — the fast path (~3 Etsy calls, ~1–2s).
 *
 * Returns everything the page needs to paint: stats, listings, search analysis
 * and the related keyword list. Related rows come back with `competition: null`
 * until /api/keywords/related probes each one for real; near matches live at
 * /api/keywords/near-matches. The client fires all three in parallel so the page
 * renders immediately instead of waiting ~13s for the full fan-out.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<KeywordSearchResponse>>> {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim().toLowerCase()

  if (!query || query.length < 2) {
    return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  try {
    const data = await getKeywordCore(query)

    // Search history is a side-effect of the request, not part of it.
    getCurrentUser()
      .then(user => connectDB().then(() => KeywordHistory.create({ keyword: query, userId: user?.id })))
      .catch(() => {})

    return NextResponse.json({ success: true, data, cached: !!data.cachedAt })
  } catch (err) {
    console.error('[Keywords] Etsy API error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch keyword data from Etsy. Check your ETSY_API_KEY.' },
      { status: 502 },
    )
  }
}
