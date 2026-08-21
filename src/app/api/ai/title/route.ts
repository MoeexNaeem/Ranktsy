import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { geminiJSON, isGeminiConfigured, type GeminiMeta } from '@/lib/gemini'
import { normalizeGeo } from '@/lib/google-ads'
import { buildGrounding, titlePrompt, TITLE_SYSTEM, TITLE_SCHEMA } from '@/lib/ai/etsy-prompts'
import { AI_BUSY, AI_UNAVAILABLE, AI_FAILED } from '@/lib/ai/messages'
import { withApiGuard } from '@/lib/api-guard'
import type { ApiResponse, AiTitleResult } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60
export const GET = withApiGuard(getHandler, { limit: 20, windowMs: 60_000 })

/** AI Title generator — 10 Etsy titles, grounded in real Google + Etsy data. */
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<AiTitleResult>>> {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('q')?.trim().toLowerCase()
  const geo = normalizeGeo(searchParams.get('geo'))
  if (!keyword || keyword.length < 2) return NextResponse.json({ success: false, error: 'Keyword must be at least 2 characters' }, { status: 400 })
  if (!isGeminiConfigured()) return NextResponse.json({ success: false, error: AI_UNAVAILABLE }, { status: 503 })

  const key = cacheKey('ai-title', 'v1', geo, keyword)
  const cached = memCache.get<AiTitleResult>(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const g = await buildGrounding(keyword, geo)
    const meta: GeminiMeta = {}
    const result = await geminiJSON<AiTitleResult>({
      system: TITLE_SYSTEM, prompt: titlePrompt(keyword, g.text), schema: TITLE_SCHEMA,
      temperature: 0.85, maxOutputTokens: 8192,
    }, meta)
    if (!result || !result.titles?.length) {
      if (meta.reason === 'quota') return NextResponse.json({ success: false, error: AI_BUSY }, { status: 503 })
      return NextResponse.json({ success: false, error: AI_FAILED }, { status: 502 })
    }
    result.focusKeyword = keyword
    memCache.set(key, result, CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    console.error('[AI/title] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not generate titles.' }, { status: 502 })
  }
}
