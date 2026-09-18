import { NextRequest, NextResponse } from 'next/server'
import { getListingRankHistory, getKeywordRankCoverage } from '@/lib/snapshots'
import type { ApiResponse, ListingRankHistory } from '@/types'

export const runtime = 'nodejs'

interface RankHistoryResponse {
  history: ListingRankHistory | null
  coverage: { keyword: string; days: number; listings: number; fromDay: string | null } | null
}

/**
 * Where a listing has ranked for a keyword over time, from OUR captures
 * (see /api/etsy/observe). Etsy exposes today's order and no history at all, so
 * a listing we have not captured for this keyword returns `history: null` and
 * the client must say "tracking started" rather than imply a rank of zero.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<RankHistoryResponse>>> {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('q') ?? ''
  const id = parseInt(searchParams.get('id') ?? '', 10)
  const days = Math.min(Math.max(Number(searchParams.get('days') ?? 90), 7), 400)
  if (!keyword.trim()) return NextResponse.json({ success: false, error: 'Missing keyword' }, { status: 400 })
  if (!id || Number.isNaN(id)) return NextResponse.json({ success: false, error: 'Missing or invalid listing id' }, { status: 400 })

  const [history, coverage] = await Promise.all([
    getListingRankHistory(keyword, id, days),
    getKeywordRankCoverage(keyword, days),
  ])
  return NextResponse.json({ success: true, data: { history, coverage } })
}
