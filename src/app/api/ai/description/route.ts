import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { geminiJSON, isGeminiConfigured } from '@/lib/gemini'
import { normalizeGeo } from '@/lib/google-ads'
import { buildGrounding, descriptionPrompt, DESC_SYSTEM, DESC_SCHEMA } from '@/lib/ai/etsy-prompts'
import { withUsage } from '@/lib/track'
import type { ApiResponse, AiDescResult } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60
export const POST = withUsage(postHandler)

/** AI Description generator — full Etsy-ready description, grounded in real data. */
async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<AiDescResult>>> {
  const body = await req.json().catch(() => ({})) as {
    q?: string; productName?: string; productType?: string; audience?: string; features?: string; geo?: string
  }
  const keyword = body.q?.trim().toLowerCase()
  const geo = normalizeGeo(body.geo)
  if (!keyword || keyword.length < 2) return NextResponse.json({ success: false, error: 'Keyword must be at least 2 characters' }, { status: 400 })
  if (!isGeminiConfigured()) return NextResponse.json({ success: false, error: 'AI is not configured (Gemini API key missing).' }, { status: 503 })

  // Cache key includes the extra inputs so different products don't collide.
  const inputSig = [body.productName, body.productType, body.audience, body.features].map(s => (s ?? '').trim().toLowerCase()).join('|')
  const key = cacheKey('ai-desc', 'v1', geo, keyword, inputSig)
  const cached = memCache.get<AiDescResult>(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const g = await buildGrounding(keyword, geo)
    const result = await geminiJSON<AiDescResult>({
      system: DESC_SYSTEM,
      prompt: descriptionPrompt({ keyword, productName: body.productName, productType: body.productType, audience: body.audience, features: body.features }, g.text),
      schema: DESC_SCHEMA, temperature: 0.8, maxOutputTokens: 8192,
    })
    if (!result || !result.description) {
      return NextResponse.json({ success: false, error: 'AI generation failed — please try again.' }, { status: 502 })
    }
    result.focusKeyword = keyword
    memCache.set(key, result, CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    console.error('[AI/description] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not generate description.' }, { status: 502 })
  }
}
