import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { geminiJSON, isGeminiConfigured, type GeminiMeta } from '@/lib/gemini'
import { normalizeGeo } from '@/lib/google-ads'
import { buildGrounding, descriptionPrompt, DESC_SYSTEM, DESC_SCHEMA } from '@/lib/ai/etsy-prompts'
import { withUsage } from '@/lib/track'
import type { ApiResponse, AiDescResult } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60
export const POST = withUsage(postHandler)

// Three deliberately different angles so the user gets real variety to choose from,
// not three near-identical rewrites. Generated in parallel (latency ≈ one call).
const VARIANTS: { angle: string; temperature: number }[] = [
  { angle: 'Benefit-led & persuasive — open on the transformation/outcome the buyer gets; confident and conversion-focused.', temperature: 0.75 },
  { angle: 'Warm & story-driven — open with a relatable scenario or gifting moment; friendly and emotive, but still concise and scannable.', temperature: 0.9 },
  { angle: 'Crisp & scannable — short sentences, heavier on bullets and clear structure, minimal fluff, straight to the value.', temperature: 1.0 },
]

/** AI Description generator — three full Etsy-ready descriptions, grounded in real data. */
async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<AiDescResult[]>>> {
  const body = await req.json().catch(() => ({})) as {
    q?: string; productName?: string; productType?: string; audience?: string; features?: string; geo?: string
  }
  const keyword = body.q?.trim().toLowerCase()
  const geo = normalizeGeo(body.geo)
  if (!keyword || keyword.length < 2) return NextResponse.json({ success: false, error: 'Keyword must be at least 2 characters' }, { status: 400 })
  if (!isGeminiConfigured()) return NextResponse.json({ success: false, error: 'AI is not configured (Gemini API key missing).' }, { status: 503 })

  // Cache key includes the extra inputs so different products don't collide. Bumped
  // to v2 because the payload shape changed from one description to an array of three.
  const inputSig = [body.productName, body.productType, body.audience, body.features].map(s => (s ?? '').trim().toLowerCase()).join('|')
  const key = cacheKey('ai-desc', 'v2', geo, keyword, inputSig)
  const cached = memCache.get<AiDescResult[]>(key)
  if (cached) return NextResponse.json({ success: true, data: cached, cached: true })

  try {
    const g = await buildGrounding(keyword, geo)
    const basePrompt = descriptionPrompt({ keyword, productName: body.productName, productType: body.productType, audience: body.audience, features: body.features }, g.text)

    const meta: GeminiMeta = {}
    const settled = await Promise.all(VARIANTS.map(v =>
      geminiJSON<AiDescResult>({
        system: DESC_SYSTEM,
        prompt: `${basePrompt}\n\nVARIANT ANGLE: ${v.angle}\nMake this version DISTINCT from the other versions — vary the opening, the structure emphasis and the wording; do not reuse the same sentences.`,
        schema: DESC_SCHEMA, temperature: v.temperature, maxOutputTokens: 8192,
      }, meta).catch(() => null)
    ))

    const results = settled.filter((r): r is AiDescResult => !!r && !!r.description)
    results.forEach(r => { r.focusKeyword = keyword })
    if (results.length === 0) {
      if (meta.reason === 'quota') return NextResponse.json({ success: false, error: 'AI is temporarily unavailable — the AI provider’s quota is used up. Please try again later.' }, { status: 503 })
      return NextResponse.json({ success: false, error: 'AI generation failed — please try again.' }, { status: 502 })
    }
    memCache.set(key, results, CACHE_TTL.KEYWORD)
    return NextResponse.json({ success: true, data: results })
  } catch (e) {
    console.error('[AI/description] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not generate description.' }, { status: 502 })
  }
}
