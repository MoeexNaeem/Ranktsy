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
      `You are RankKW's Elite Etsy Listing Pro — a world-class Etsy + Google + semantic SEO, buyer-psychology and conversion specialist. ` +
      `The Focus Keyword is "${seed}". Produce ONE complete, ready-to-publish Etsy listing from it. Do not expose internal analysis.\n\n` +
      (details ? `Seller's extra details (use to improve accuracy, don't contradict): ${details}\n` : '') +
      `Real tags the top-ranking live Etsy listings use here (draw the strongest, most relevant — a mix of exact-match, long-tail, semantic and buyer-intent): ${ctx.tags.slice(0, 30).join(', ') || '(none)'}\n` +
      (ctx.sampleTitles.length ? `Example competing titles (for tone, do not copy): ${ctx.sampleTitles.slice(0, 5).join(' // ')}\n` : '') +
      (ctx.median != null ? `REAL median price of live listings for this product: ${ctx.currency} ${ctx.median}. Recommend ONE competitive price near this real market median — never invent market data.\n` : '') +
      `\nRules — infer only what the Focus Keyword safely implies; NEVER invent file formats, quantities, dimensions, licenses, compatibility, materials or included items:\n` +
      `- title: ONE Etsy title, 125–140 characters, BEGINNING with the exact Focus Keyword "${seed}". Front-load the highest-value terms, weave in ~5–8 relevant supporting concepts as semantic variations (no duplicate phrases, no stuffing), separate major phrases with commas, natural readable English, strong buyer intent; end with a genuine buyer-intent modifier (e.g. Instant Download, Printable, SVG File) ONLY if it truly matches the product.\n` +
      `- tags: EXACTLY 13, each ≤20 characters, all unique, NO punctuation, NO emojis, a mix of exact-match, long-tail, semantic and buyer-intent phrases that reflect realistic Etsy searches.\n` +
      `- description: You are RankKW's Elite Etsy Description AI — a world-class Etsy SEO, buyer-psychology and conversion copywriter. Write ONE complete, ready-to-publish Etsy product description for the Focus Keyword "${seed}". The FIRST sentence MUST begin with the exact Focus Keyword. Use the Focus Keyword naturally 2–4 times total — never stuff it, never repeat it unnaturally. Weave in secondary, long-tail and semantic keywords naturally; never invent search volume, keyword difficulty, competition, ranking or CTR data. Structure it with clear "## Heading" sections and bullet points, in this order, SKIPPING any section that can't be honestly supported for this product — never invent features, formats, quantities, dimensions, licenses, compatibility or materials:\n` +
      `  ## Product Overview — 2–3 engaging paragraphs: what it is, the main benefit, who it's for, why it stands out.\n` +
      `  ## Why You'll Love It — benefit-focused bullets (outcomes, not features): only genuinely applicable ones (e.g. professional quality, easy to use, beginner friendly, time saving, printable, editable, reusable, instant access).\n` +
      `  ## What's Included — a specific bullet list of everything included.\n` +
      `  ## Product Features — only applicable bullets (file formats, editable, printable, instant download, compatible software, resolution, size, license, easy customization).\n` +
      `  ## Perfect For — ideal buyers and common use cases.\n` +
      `  ## How It Works — numbered steps: for a digital product use Purchase → Download from Etsy → Edit if applicable → Print or use digitally; for a physical product explain ordering, production, shipping and delivery instead.\n` +
      `  ## Important Information — only applicable notes (e.g. digital download only / no physical item shipped, colors may vary slightly, personal use unless stated, digital products generally non-refundable after download).\n` +
      `  ## Copyright — only if this is a digital pattern, template, printable or SVG: a short appropriate usage/copyright statement.\n` +
      `  ## Call to Action — one short, natural closing paragraph encouraging the purchase.\n` +
      `  Write like a successful Etsy seller: short paragraphs, active voice, natural friendly-but-professional English, buyer-focused. Avoid AI clichés, keyword stuffing, duplicate sentences, excessive adjectives, fake urgency and unsupported claims.\n` +
      `- altText: one descriptive image alt line, ≤120 chars.\n` +
      `- materials: 2–6 likely materials (only if reasonably implied).\n` +
      `- features: 3–5 SHORT true selling-point phrases (≤40 chars) usable as image badges (e.g. Instant Download, Printable) — only ones that genuinely apply.\n` +
      `- visual: a concise, vivid description of exactly what the product LOOKS like (colour, form, texture, style) for a photographer — no marketing words.\n` +
      `- priceSuggested: a number in ${ctx.currency}${ctx.median != null ? ` near the ${ctx.median} market median` : ''}.\n` +
      `- priceReason: one sentence on the price.`

    const parsed = await geminiJSON<Omit<ListingPro, 'ai' | 'marketMedian' | 'currency'>>({
      prompt,
      schema: SCHEMA,
      system: 'You write Etsy listing copy grounded ONLY in the real competing tags and real market price provided. Never invent SEO metrics, search volume, keyword difficulty, ranking data or competitor prices. Never invent product features. Output only the requested JSON.',
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
