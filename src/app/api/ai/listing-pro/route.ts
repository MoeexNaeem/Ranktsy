import { NextRequest, NextResponse } from 'next/server'
import { searchEtsyListings, dominantCurrencyPrices } from '@/lib/etsy'
import { geminiJSON, isGeminiConfigured } from '@/lib/gemini'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Etsy Listing Pro — the text half of a complete, ready-to-publish listing:
 * one optimized title, 13 tags, a full description, materials, a suggested price,
 * and a `visual` blurb the image routes use to render matching product photos.
 *
 * Grounded like the rest of the app: tags come from the REAL live listings for
 * the seed, and the price is anchored to the REAL median of those listings.
 * Gemini writes the copy and suggests a price within that market — it never
 * invents the market itself.
 */
export interface ListingPro {
  title: string
  tags: string[]
  description: string
  altText: string
  materials: string[]
  features: string[]          // short phrases, also used as image callouts
  visual: string              // concise appearance description → feeds image gen
  priceSuggested: number | null
  priceReason: string
  marketMedian: number | null // REAL median of live listings (anchor)
  currency: string
  ai: boolean
}

const SCHEMA = {
  type: 'object',
  properties: {
    title:          { type: 'string', maxLength: 140 },
    tags:           { type: 'array', items: { type: 'string', maxLength: 20 }, minItems: 13, maxItems: 13 },
    description:    { type: 'string' },
    altText:        { type: 'string', maxLength: 120 },
    materials:      { type: 'array', items: { type: 'string' }, maxItems: 8 },
    features:       { type: 'array', items: { type: 'string', maxLength: 40 }, minItems: 3, maxItems: 5 },
    visual:         { type: 'string', maxLength: 400 },
    priceSuggested: { type: 'number' },
    priceReason:    { type: 'string', maxLength: 200 },
  },
  required: ['title', 'tags', 'description', 'altText', 'features', 'visual', 'priceSuggested', 'priceReason'],
} as const

async function liveContext(seed: string) {
  const listings = await searchEtsyListings(seed, 40).catch(() => [])
  const counts: Record<string, { c: number; v: number }> = {}
  for (const l of listings) {
    for (const t of l.tags ?? []) {
      const k = t.toLowerCase().trim()
      if (k.length < 3 || k.length > 20) continue
      if (!counts[k]) counts[k] = { c: 0, v: 0 }
      counts[k].c++; counts[k].v += l.views ?? 0
    }
  }
  const tags = Object.entries(counts).sort((a, b) => b[1].v / b[1].c - a[1].v / a[1].c).map(([t]) => t)
  const { currency, prices } = dominantCurrencyPrices(listings)
  const sorted = [...prices].sort((a, b) => a - b)
  const median = sorted.length ? parseFloat(sorted[Math.floor((sorted.length - 1) / 2)].toFixed(2)) : null
  return { tags, currency, median, sampleTitles: listings.slice(0, 6).map(l => l.title).filter(Boolean) }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ListingPro>>> {
  const body = await req.json().catch(() => ({}))
  const seed = String(body.product ?? body.seed ?? '').trim()
  const details = String(body.details ?? '').trim().slice(0, 400)
  if (seed.length < 2) {
    return NextResponse.json({ success: false, error: 'Describe your product (2+ characters).' }, { status: 400 })
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json({ success: false, error: 'AI is not configured (set the Gemini API key).' }, { status: 503 })
  }

  try {
    const ctx = await liveContext(seed)
    const prompt =
      `You are an expert Etsy SEO copywriter and product photographer's art director. Write ONE complete, ready-to-publish Etsy listing.\n\n` +
      `Product: ${seed}\n` +
      (details ? `Seller's extra details: ${details}\n` : '') +
      `\nReal tags top-ranking Etsy listings use here (draw the strongest, most relevant): ${ctx.tags.slice(0, 30).join(', ') || '(none)'}\n` +
      (ctx.sampleTitles.length ? `Example competing titles: ${ctx.sampleTitles.slice(0, 5).join(' // ')}\n` : '') +
      (ctx.median != null ? `Real median price of live listings for this product: ${ctx.currency} ${ctx.median}. Suggest a competitive price NEAR this real market median.\n` : '') +
      `\nReturn:\n` +
      `- title: ONE Etsy title, MAX 140 chars, front-load the most-searched keywords.\n` +
      `- tags: EXACTLY 13, each MAX 20 chars, long-tail multi-word phrases, no duplicates, no '#'.\n` +
      `- description: 100–170 words — a hooky intro line, then scannable bullet points, then a natural keyword line.\n` +
      `- altText: one image alt line, MAX 120 chars.\n` +
      `- materials: 2–6 likely materials.\n` +
      `- features: 3–5 SHORT selling-point phrases (≤40 chars) suitable as image callout labels.\n` +
      `- visual: a vivid but concise description of exactly what the product LOOKS like (colour, form, texture, style) for a photographer — no marketing words.\n` +
      `- priceSuggested: a number in ${ctx.currency}${ctx.median != null ? ` near the ${ctx.median} market median` : ''}.\n` +
      `- priceReason: one sentence on the price.`

    const parsed = await geminiJSON<Omit<ListingPro, 'ai' | 'marketMedian' | 'currency'>>({
      prompt,
      schema: SCHEMA,
      system: 'You write Etsy listing copy grounded in the real competing tags and real market price provided. Never invent statistics.',
      temperature: 0.85,
      maxOutputTokens: 4096,
    })
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'The AI model was unavailable or rate-limited. Try again.' }, { status: 502 })
    }

    const data: ListingPro = {
      title:          parsed.title.slice(0, 140),
      tags:           (parsed.tags ?? []).map(t => t.toLowerCase().trim().slice(0, 20)).filter(Boolean).slice(0, 13),
      description:    parsed.description ?? '',
      altText:        (parsed.altText ?? '').slice(0, 120),
      materials:      parsed.materials ?? [],
      features:       (parsed.features ?? []).slice(0, 5),
      visual:         parsed.visual ?? seed,
      priceSuggested: typeof parsed.priceSuggested === 'number' ? parseFloat(parsed.priceSuggested.toFixed(2)) : null,
      priceReason:    parsed.priceReason ?? '',
      marketMedian:   ctx.median,
      currency:       ctx.currency,
      ai:             true,
    }
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[Listing Pro] failed:', err)
    return NextResponse.json({ success: false, error: 'Generation failed.' }, { status: 502 })
  }
}
