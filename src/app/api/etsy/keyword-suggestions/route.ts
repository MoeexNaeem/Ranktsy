import { NextRequest, NextResponse } from 'next/server'
import { getKeywordSuggestions, type KeywordSuggestionRow } from '@/lib/snapshots'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Phrases ETSY ITSELF suggested for a term, gathered from real results pages.
 *
 * Etsy's related-search row and its autocomplete name the words Etsy shoppers
 * actually use. Neither is exposed by any Etsy API, and Google's keyword ideas
 * describe a different population (web searchers, not Etsy buyers), so these are
 * the only Etsy-native keyword expansions available.
 *
 * Served purely from our own store: no upstream call, no quota, no failure mode
 * beyond "we have not seen this term yet".
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<{ suggestions: KeywordSuggestionRow[] }>>> {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 })

  const suggestions = await getKeywordSuggestions(q)
  return NextResponse.json({ success: true, data: { suggestions } })
}
