import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListingsPaged, getListingById } from '@/lib/etsy'
import { guardSearch } from '@/lib/searchGate'
import type { ApiResponse, KeywordGap, GapTag, GapWord, EtsyListing } from '@/types'

export const runtime = 'nodejs'

// Words that carry no SEO signal - dropped from the title-word gap.
const STOP = new Set([
  'with','from','this','that','your','have','will','been','they','their','what','when','and','the','for',
  'you','are','our','out','set','made','made','more','than','into','a','an','of','in','on','to','by','is',
  'it','or','as','at','my','me','we','us','be','so','no','up','handmade','gift','gifts','custom','personalized',
])

function tokens(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))
}

/**
 * Keyword Gap Analysis.
 *
 * Reads the live listings that rank for a keyword and reports, as real counts,
 * the tags and title-words the winners share. If the caller supplies their own
 * listing, it flags exactly which of those the listing is missing - the "hidden
 * keywords" they should add. Nothing is estimated: adoption is a count, views
 * are Etsy's own numbers.
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<KeywordGap>>> {
  const { searchParams } = new URL(req.url)
  let query = (searchParams.get('q')?.trim().toLowerCase()) || ''
  const listingParam = searchParams.get('listing')?.trim()   // a keyword OR a listing URL/id

  const gate = await guardSearch<KeywordGap>(req)
  if (gate) return gate

  try {
    // Resolve the caller's own listing FIRST - it's both the analysis target and,
    // when no keyword was typed, the source we derive the search keyword from. That
    // lets a single input box accept either a keyword or a listing URL/ID.
    let target: EtsyListing | null = null
    if (listingParam) {
      const m = listingParam.match(/listing\/(\d+)/) || listingParam.match(/(\d{6,})/)
      const id = m ? Number(m[1]) : NaN
      if (id) target = await getListingById(id).catch(() => null)
    }

    // Only a listing was given → use its first few meaningful title words as the keyword.
    if (query.length < 2 && target) query = tokens(target.title).slice(0, 3).join(' ')
    if (query.length < 2) {
      return NextResponse.json({ success: false, error: 'Enter a keyword, or paste a valid Etsy listing URL.' }, { status: 400 })
    }

    // Cache the keyword scan (expensive) separately from the per-listing overlay
    // (cheap), so trying different listings against one keyword is fast.
    const scanKey = cacheKey('gap', 'v1', 'scan', query)
    let scan = memCache.get<{ listings: EtsyListing[]; count: number }>(scanKey)
    if (!scan) {
      scan = await searchEtsyListingsPaged(query, 100, 0, { skipImages: true })
      memCache.set(scanKey, scan, CACHE_TTL.KEYWORD)
    }

    const yourTags = new Set((target?.tags ?? []).map(t => t.toLowerCase().trim()))
    const yourWords = new Set(target ? tokens(target.title) : [])

    const { listings, count } = scan
    const n = listings.length
    if (!n) {
      return NextResponse.json({ success: false, error: 'Etsy returned no listings for this keyword.' }, { status: 404 })
    }

    // ── Tag adoption + engagement across the winners ──
    const tagAgg = new Map<string, { used: number; views: number }>()
    for (const l of listings) {
      const views = l.views ?? 0
      for (const t of new Set((l.tags ?? []).map(x => x.toLowerCase().trim()).filter(Boolean))) {
        const cur = tagAgg.get(t) ?? { used: 0, views: 0 }
        cur.used++; cur.views += views
        tagAgg.set(t, cur)
      }
    }
    const tags: GapTag[] = [...tagAgg.entries()]
      .map(([tag, v]) => ({
        tag,
        used: v.used,
        usedPct: Math.round((v.used / n) * 100),
        avgViews: Math.round(v.views / v.used),
        yoursMissing: target ? !yourTags.has(tag) : false,
      }))
      // Rank by adoption first, then by the engagement of listings using it.
      .sort((a, b) => b.used - a.used || b.avgViews - a.avgViews)
      .slice(0, 40)

    // ── Title-word adoption ──
    const wordAgg = new Map<string, number>()
    for (const l of listings) {
      for (const w of new Set(tokens(l.title))) wordAgg.set(w, (wordAgg.get(w) ?? 0) + 1)
    }
    const titleWords: GapWord[] = [...wordAgg.entries()]
      .filter(([, c]) => c >= 2)
      .map(([word, c]) => ({
        word,
        inTitles: c,
        inTitlesPct: Math.round((c / n) * 100),
        yoursMissing: target ? !yourWords.has(word) : false,
      }))
      .sort((a, b) => b.inTitles - a.inTitles)
      .slice(0, 30)

    // ── The actionable shortlist: high-adoption tags your listing lacks ──
    const topMissingTags = target
      ? tags.filter(t => t.yoursMissing && t.usedPct >= 15).slice(0, 12)
      : []

    return NextResponse.json({
      success: true,
      data: {
        query,
        sampled: n,
        totalResults: count,
        hasTarget: !!target,
        targetTitle: target?.title ?? null,
        targetTagCount: target ? (target.tags?.length ?? 0) : null,
        tags,
        titleWords,
        topMissingTags,
      },
    })
  } catch (e) {
    console.error('[Keyword Gap] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not analyse this keyword.' }, { status: 502 })
  }
}
