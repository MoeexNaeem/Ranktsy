/**
 * "Automate Etsy Shop" orchestrator (HIDDEN / admin-only for now).
 *
 * The per-product pipeline: take a keyword → pull REAL market grounding (Google
 * demand + the tags the top live listings use) → generate one complete,
 * SEO-optimized listing (title / 13 tags / description / price). Publishing to
 * the shop as a draft is handled by the /step route (it owns the Etsy auth).
 *
 * Uses DEDICATED automation AI keys when configured (AUTOMATION_GEMINI_API_KEY),
 * so a heavy batch's cost is isolated and can't drain the main app's quota.
 */
import { buildGrounding } from '@/lib/ai/etsy-prompts'
import { geminiJSON, isGeminiConfigured, type GeminiMeta } from '@/lib/gemini'

/** Dedicated Gemini keys for automation only. Empty → falls back to shared keys. */
export function automationGeminiKeys(): string[] {
  const raw = [
    process.env.AUTOMATION_GEMINI_API_KEY,
    ...(process.env.AUTOMATION_GEMINI_API_KEYS?.split(',') ?? []),
  ]
  return raw.map(k => (k ?? '').trim()).filter(Boolean)
}
function autoKeys(): string[] | undefined {
  const k = automationGeminiKeys()
  return k.length ? k : undefined
}

export function isAutomationAiReady(): boolean {
  return automationGeminiKeys().length > 0 || isGeminiConfigured()
}

export interface GeneratedListing {
  title: string
  tags: string[]
  description: string
  price: number | null
}

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    title:       { type: 'string' },
    tags:        { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    price:       { type: 'number' },
  },
  required: ['title', 'tags', 'description'],
} as const

/** Per-node generation options set on the workflow's nodes (all optional). */
export interface ListingOptions {
  titleStyle?: string     // 'keyword-first' | 'benefit-first'
  tagFocus?: string       // 'long-tail' | 'broad' | 'mixed'
  descLength?: string     // 'concise' | 'standard' | 'detailed'
  priceStrategy?: string  // 'median' | 'undercut' | 'premium'
}

/** Generate ONE complete, real-data-grounded listing for a keyword. */
export async function generateListing(keyword: string, geo = 'US', options?: ListingOptions | Record<string, unknown> | null): Promise<GeneratedListing | null> {
  if (!isAutomationAiReady()) return null
  const o = (options ?? {}) as ListingOptions
  const g = await buildGrounding(keyword, geo)

  const titleRule = o.titleStyle === 'benefit-first'
    ? 'Lead with the main buyer benefit, but include the focus keyword within the first 40 characters.'
    : 'Front-load the focus keyword at the very start of the title.'
  const tagRule = o.tagFocus === 'broad'
    ? 'Favor broad, high-volume tags.'
    : o.tagFocus === 'mixed' ? 'Mix broad high-volume tags with specific long-tail tags.'
    : 'Favor specific long-tail tags (lower competition).'
  const descRule = o.descLength === 'concise' ? 'Keep the description concise (~80 words).'
    : o.descLength === 'detailed' ? 'Write a detailed description (~250 words).'
    : 'Write a standard-length description (~150 words).'

  const meta: GeminiMeta = {}
  const result = await geminiJSON<GeneratedListing>({
    system: 'You are an elite Etsy SEO listing writer. Produce ONE complete, ready-to-publish Etsy listing. Use ONLY the real, provided data — never invent search volume, sales, ranking or competition numbers.',
    prompt:
      `Focus keyword: "${keyword}".\n\n` +
      `REAL market data (interpret it, do not fabricate anything):\n${g.text}\n\n` +
      `Return a JSON object:\n` +
      `- title: a compelling Etsy title, max 140 characters. ${titleRule}\n` +
      `- tags: EXACTLY 13 multi-word Etsy tags, each 20 characters or fewer, buyer-intent, no duplicates, aligned with the real high-adoption tags above. ${tagRule}\n` +
      `- description: a persuasive, well-structured Etsy description in short paragraphs and bullet lines; the FIRST sentence must begin with the focus keyword. ${descRule}\n` +
      `- price: a sensible USD price NUMBER aligned to the market (no currency symbol).`,
    schema: LISTING_SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.82,
    maxOutputTokens: 4096,
    apiKeys: autoKeys(),
  }, meta)

  if (!result || !result.title || !Array.isArray(result.tags) || !result.tags.length) return null
  let price = typeof result.price === 'number' ? result.price : (result.price ? Number(result.price) : null)
  // Apply the pricing strategy from the Price node.
  if (price != null && Number.isFinite(price)) {
    if (o.priceStrategy === 'undercut') price = Math.round(price * 0.9 * 100) / 100
    else if (o.priceStrategy === 'premium') price = Math.round(price * 1.15 * 100) / 100
  }
  return {
    title: String(result.title).slice(0, 140),
    tags: result.tags.map(t => String(t).slice(0, 20)).filter(Boolean).slice(0, 13),
    description: String(result.description ?? ''),
    price,
  }
}

/** Expand a niche into N distinct, specific, buyer-searched product keywords. */
export async function expandNiche(niche: string, count: number, geo = 'US'): Promise<string[]> {
  if (!isAutomationAiReady()) return []
  void geo
  const out = await geminiJSON<{ ideas: string[] }>({
    system: 'You propose distinct, specific, buyer-searched Etsy product keywords for a niche.',
    prompt: `Niche: "${niche}". Propose ${Math.min(count, 25)} DISTINCT, specific Etsy product keyword phrases (2-4 words each) that buyers actually search, varied across the niche. Return JSON { "ideas": string[] }.`,
    schema: { type: 'object', properties: { ideas: { type: 'array', items: { type: 'string' } } }, required: ['ideas'] } as unknown as Record<string, unknown>,
    temperature: 0.95,
    apiKeys: autoKeys(),
  })
  const ideas = (out?.ideas ?? []).map(s => String(s).trim().toLowerCase()).filter(s => s.length >= 2)
  return [...new Set(ideas)].slice(0, count)
}
