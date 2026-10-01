/**
 * "Automate Etsy Shop" orchestrator (admin-only for now).
 *
 * The per-product pipeline fills EVERY section of Etsy's "Add a listing" form so
 * the seller only supplies photos (and, for digital items, the files):
 *
 *   photos (optional) → Gemini vision identifies the product → focus keyword
 *   → REAL market grounding (Google demand, top-listing tags, categories, prices)
 *   → category (most common among the top live listings, or the seller's pick)
 *   → the category's own attributes (Craft type, Occasion, Celebration, ...)
 *   → one AI call writes title / 13 tags / description / materials / styles /
 *     alt text / attribute choices, all validated against Etsy's rules here.
 *
 * Publishing to the shop as a draft is handled by the /step route (it owns the
 * Etsy auth); photos and digital files are uploaded per item by /media.
 *
 * Uses DEDICATED automation AI keys when configured (AUTOMATION_GEMINI_API_KEY),
 * so a heavy batch's cost is isolated and can't drain the main app's quota.
 */
import { buildGrounding } from '@/lib/ai/etsy-prompts'
import { geminiJSON, isGeminiConfigured, type GeminiMeta, type GeminiRefImage } from '@/lib/gemini'
import { getSellerTaxonomy, getTaxonomyProperties, type TaxonomyProperty } from '@/lib/etsy'
import { memCache } from '@/lib/cache'
import { cleanTag, cleanWord, finalPrice, type AutomationConfig } from '@/lib/automation/config'

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

export interface GeneratedAttribute { propertyId: number; name: string; valueIds: number[]; values: string[] }

export interface GeneratedListing {
  keyword: string
  title: string
  tags: string[]
  description: string
  price: number | null
  currency: string | null
  taxonomyId: number
  taxonomyPath: string | null
  materials: string[]
  styles: string[]
  altText: string
  attributes: GeneratedAttribute[]
  personalizationInstructions: string | null
  warnings: string[]
}

export interface ProductInput {
  /** Focus keyword (keyword/niche modes) or the seller's short hint (photo mode). */
  keyword: string
  /** Downscaled product photos for the vision step (photo mode only). */
  images?: GeminiRefImage[]
  /** Names of the digital files, a strong hint for what a digital product is. */
  fileNames?: string[]
  fromPhotos?: boolean
}

export class ListingError extends Error {}

/* ── Taxonomy path lookup (id → "Art & Collectibles › Prints › Digital Prints") ── */
async function taxonomyPaths(): Promise<Map<number, string>> {
  const key = 'automation:taxonomy-paths:v1'
  const hit = memCache.get<[number, string][]>(key)
  if (hit) return new Map(hit)
  const flat = await getSellerTaxonomy().catch(() => [])
  const entries = flat.map(t => [t.id, t.fullPath] as [number, string])
  if (entries.length) memCache.set(key, entries, 60 * 60 * 24)
  return new Map(entries)
}

/* ── Step 1 (photo mode): look at the photos, name the product ─────────────── */
async function identifyProduct(input: ProductInput, kind: AutomationConfig['details']['type']): Promise<{ keyword: string; facts: string }> {
  const out = await geminiJSON<{ keyword: string; productType: string; facts: string[] }>({
    system: 'You identify products from an Etsy seller\'s own photos so a listing can be written for them. Describe only what is actually visible or stated. Never guess brand names.',
    prompt:
      `The seller is listing a ${kind === 'download' ? 'DIGITAL download (the photos are previews / mockups of the file)' : 'PHYSICAL item'} on Etsy.\n` +
      (input.keyword ? `Seller's note about the product: "${input.keyword}".\n` : '') +
      (input.fileNames?.length ? `Digital file names: ${input.fileNames.slice(0, 5).join(', ')}.\n` : '') +
      `Return JSON:\n` +
      `- keyword: the 2-5 word phrase an Etsy buyer would type to find EXACTLY this product (lowercase, no brand names).\n` +
      `- productType: what the product is, in a few words.\n` +
      `- facts: 4-10 short, concrete facts visible in the photos (materials, colors, style, size cues, what's included, theme, occasion).`,
    schema: {
      type: 'object',
      properties: { keyword: { type: 'string' }, productType: { type: 'string' }, facts: { type: 'array', items: { type: 'string' } } },
      required: ['keyword', 'facts'],
    },
    images: input.images,
    temperature: 0.3,
    maxOutputTokens: 1024,
    apiKeys: autoKeys(),
  })
  const keyword = String(out?.keyword ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!keyword) throw new ListingError('Could not recognise the product in the photos. Add a short note (what it is) and retry.')
  const facts = [out?.productType, ...(out?.facts ?? [])].filter(Boolean).map(f => `- ${f}`).join('\n')
  return { keyword, facts }
}

/** Compact the category's attributes for the prompt (id + allowed values). */
function attributePromptBlock(props: TaxonomyProperty[]): string {
  return props.map(p =>
    `- propertyId ${p.propertyId} "${p.name}"${p.multi ? ` (pick up to ${p.maxValues ?? 3})` : ' (pick 1)'}: ` +
    p.values.slice(0, 80).map(v => `${v.id}=${v.name}`).join('; '),
  ).join('\n')
}

/** Generate ONE complete, real-data-grounded Etsy listing. Throws ListingError with a human reason. */
export async function generateListing(input: ProductInput, geo: string, cfg: AutomationConfig): Promise<GeneratedListing> {
  if (!isAutomationAiReady()) throw new ListingError('AI is not configured (set AUTOMATION_GEMINI_API_KEY).')
  const warnings: string[] = []

  // 1. What is it?
  let keyword = input.keyword.trim().toLowerCase()
  let facts = ''
  if (input.fromPhotos) {
    if (input.images?.length) {
      const id = await identifyProduct(input, cfg.details.type)
      keyword = id.keyword
      facts = id.facts
    } else if (!keyword) {
      throw new ListingError('This product has no photos and no note. Add photos or a short description.')
    }
  }
  if (!keyword) throw new ListingError('No product keyword.')

  // 2. Real market data.
  const g = await buildGrounding(keyword, geo)

  // 3. Category: the seller's pick, or where the top live listings actually sit.
  const paths = await taxonomyPaths()
  let taxonomyId: number | null = cfg.category.mode === 'fixed' ? cfg.category.taxonomyId : null
  if (!taxonomyId) {
    taxonomyId = g.taxonomies[0]?.id ?? null
    if (!taxonomyId) throw new ListingError(`No live listings found for "${keyword}" to infer a category from. Pick a category on the Category node.`)
  }
  const taxonomyPath = cfg.category.mode === 'fixed' && cfg.category.taxonomyPath ? cfg.category.taxonomyPath : (paths.get(taxonomyId) ?? null)

  // 4. That category's attributes (Craft type, Occasion, Celebration, ...).
  let props: TaxonomyProperty[] = []
  if (cfg.attributes.mode === 'auto') {
    props = await getTaxonomyProperties(taxonomyId).catch(() => {
      warnings.push('Could not load this category\'s attributes from Etsy, skipped them.')
      return []
    })
  }
  // Properties the seller pinned are not asked of the AI.
  const askProps = props.filter(p => !cfg.attributes.fixed[String(p.propertyId)]).slice(0, 18)

  // 5. Write the listing.
  const titleRule = cfg.title.style === 'benefit-first'
    ? 'Lead with the main buyer benefit, but include the focus keyword within the first 40 characters.'
    : 'Front-load the focus keyword at the very start of the title.'
  const tagRule = cfg.tags.focus === 'broad' ? 'Favor broad, high-volume tags.'
    : cfg.tags.focus === 'mixed' ? 'Mix broad high-volume tags with specific long-tail tags.'
    : 'Favor specific long-tail tags (lower competition).'
  const descWords = cfg.description.length === 'concise' ? 80 : cfg.description.length === 'detailed' ? 250 : 150
  const needsPersonalization = cfg.details.personalization !== 'off' && !cfg.details.personalizationInstructions
  const priceLine = g.price
    ? `REAL PRICES of the top ${g.price.sample} live listings (${g.price.currency}): 25th pct ${g.price.p25.toFixed(2)}, median ${g.price.median.toFixed(2)}, 75th pct ${g.price.p75.toFixed(2)}.`
    : 'No live price data available.'
  const always = cfg.tags.always.filter(Boolean)
  const tagSlots = Math.max(0, 13 - always.length)

  const schemaProps: Record<string, unknown> = {
    title:       { type: 'string' },
    tags:        { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    price:       { type: 'number' },
    altText:     { type: 'string' },
    materials:   { type: 'array', items: { type: 'string' } },
    styles:      { type: 'array', items: { type: 'string' } },
    attributes:  { type: 'array', items: { type: 'object', properties: { propertyId: { type: 'integer' }, valueIds: { type: 'array', items: { type: 'integer' } } }, required: ['propertyId', 'valueIds'] } },
  }
  if (needsPersonalization) schemaProps.personalizationInstructions = { type: 'string' }

  const meta: GeminiMeta = {}
  const result = await geminiJSON<{
    title: string; tags: string[]; description: string; price?: number; altText?: string
    materials?: string[]; styles?: string[]; attributes?: { propertyId: number; valueIds: number[] }[]
    personalizationInstructions?: string
  }>({
    system: 'You are an elite Etsy SEO listing writer. Produce ONE complete, ready-to-publish Etsy listing. Use ONLY the real, provided data. Never invent search volume, sales, ranking or competition numbers, and never claim product details that are not supported by the photos/facts given.',
    prompt:
      `Focus keyword: "${keyword}". Listing type: ${cfg.details.type === 'download' ? 'DIGITAL DOWNLOAD (nothing is shipped)' : 'PHYSICAL item'}.\n` +
      (taxonomyPath ? `Etsy category: ${taxonomyPath}.\n` : '') +
      (facts ? `\nFACTS FROM THE SELLER'S PHOTOS:\n${facts}\n` : '') +
      (input.fromPhotos && input.keyword ? `Seller's note: "${input.keyword}".\n` : '') +
      (input.fileNames?.length ? `Files the buyer receives: ${input.fileNames.slice(0, 5).join(', ')}.\n` : '') +
      `\nREAL market data (interpret it, do not fabricate anything):\n${g.text}\n${priceLine}\n\n` +
      `Return a JSON object:\n` +
      `- title: a compelling Etsy title, max ${cfg.title.maxLength} characters. ${titleRule}${cfg.title.mustInclude ? ` It MUST contain "${cfg.title.mustInclude}".` : ''} Separate phrases with commas, no emojis or symbols like | ★.\n` +
      `- tags: EXACTLY ${tagSlots} multi-word Etsy tags, each 20 characters or fewer, letters/numbers/spaces only, buyer-intent, no duplicates, aligned with the real high-adoption tags above. ${tagRule}${always.length ? ` Do NOT repeat these (already added): ${always.join(', ')}.` : ''}\n` +
      `- description: a ${cfg.description.tone} Etsy description of about ${descWords} words in short paragraphs and bullet lines (use "- " bullets, plain text, no markdown headings or bold). The FIRST sentence must begin with the focus keyword.${cfg.details.type === 'download' ? ' Include a "What you will receive" bullet list and note that nothing physical is shipped.' : ''}\n` +
      `- price: a sensible price NUMBER${g.price ? ` in ${g.price.currency}, anchored to the real median above` : ''} (no currency symbol).\n` +
      `- altText: one sentence (max 250 chars) describing the main product photo for screen readers.\n` +
      `- materials: ${cfg.tags.materials ? 'up to 8 materials or components the product is made of / contains (single words or short phrases, letters only)' : 'an empty array'}.\n` +
      `- styles: ${cfg.tags.styles ? 'up to 2 style words (e.g. "Boho", "Minimalist")' : 'an empty array'}.\n` +
      (askProps.length
        ? `- attributes: for each Etsy attribute below that clearly applies to THIS product, choose value ids ONLY from its list (skip the attribute if unsure):\n${attributePromptBlock(askProps)}\n`
        : '- attributes: an empty array.\n') +
      (needsPersonalization ? `- personalizationInstructions: one short instruction telling the buyer what to enter for personalization (max 250 chars).\n` : ''),
    schema: { type: 'object', properties: schemaProps, required: ['title', 'tags', 'description'] },
    images: input.images?.slice(0, 3),
    temperature: 0.75,
    maxOutputTokens: 6144,
    apiKeys: autoKeys(),
  }, meta)

  if (!result || !result.title || !Array.isArray(result.tags)) {
    throw new ListingError(meta.reason === 'quota' ? 'AI quota exhausted, try again later.' : 'AI generation failed, retry this product.')
  }

  // 6. Enforce Etsy's rules on everything the model returned.
  let title = String(result.title).replace(/[|★✓•]/g, ',').replace(/\s+/g, ' ').trim()
  if (title.length > cfg.title.maxLength) title = title.slice(0, cfg.title.maxLength).replace(/[\s,]+\S*$/, '').trim()

  const tags: string[] = []
  for (const t of [...always, ...(result.tags ?? []), ...g.topTags.map(x => x.tag)]) {
    const c = cleanTag(String(t))
    if (c && !tags.includes(c)) tags.push(c)
    if (tags.length === 13) break
  }

  const materials = cfg.tags.materials ? [...new Set((result.materials ?? []).map(m => cleanWord(String(m))).filter(Boolean))].slice(0, 13) : []
  const styles = cfg.tags.styles ? [...new Set((result.styles ?? []).map(s => cleanWord(String(s))).filter(Boolean))].slice(0, 2) : []

  const description = [String(result.description ?? '').trim(), cfg.description.footer].filter(Boolean).join('\n\n')

  // Attributes: keep only real property/value ids, respect single vs multi, then
  // lay the seller's pinned values on top.
  const byId = new Map(props.map(p => [p.propertyId, p]))
  const attributes: GeneratedAttribute[] = []
  const pushAttr = (p: TaxonomyProperty, ids: number[]) => {
    const valid = ids.filter(v => p.values.some(x => x.id === v))
    const limit = p.multi ? Math.max(1, p.maxValues ?? 5) : 1
    const keep = [...new Set(valid)].slice(0, limit)
    if (!keep.length) return
    attributes.push({ propertyId: p.propertyId, name: p.name, valueIds: keep, values: keep.map(v => p.values.find(x => x.id === v)!.name) })
  }
  for (const a of result.attributes ?? []) {
    const p = byId.get(Number(a.propertyId))
    if (p && !cfg.attributes.fixed[String(p.propertyId)]) pushAttr(p, (a.valueIds ?? []).map(Number))
  }
  for (const [pid, ids] of Object.entries(cfg.attributes.fixed)) {
    const p = byId.get(Number(pid))
    if (p) pushAttr(p, ids)
  }

  // Price: real market median when it's in USD, else the model's market-anchored number.
  const aiPrice = typeof result.price === 'number' ? result.price : Number(result.price)
  const base = g.price && g.price.currency === 'USD' ? g.price.median : (Number.isFinite(aiPrice) && aiPrice > 0 ? aiPrice : null)
  const price = finalPrice(base, cfg.price)
  if (price == null) warnings.push('No market price found, set a Fixed price on the Price node.')

  return {
    keyword,
    title,
    tags,
    description,
    price,
    currency: cfg.price.strategy === 'fixed' ? null : (g.price?.currency ?? null),
    taxonomyId,
    taxonomyPath,
    materials,
    styles,
    altText: String(result.altText ?? title).slice(0, 250),
    attributes,
    personalizationInstructions: needsPersonalization ? (String(result.personalizationInstructions ?? '').slice(0, 256) || null) : null,
    warnings,
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
