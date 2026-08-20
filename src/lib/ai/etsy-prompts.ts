/**
 * Etsy SEO generation prompts (Title / Tag / Description) + real-data grounding.
 *
 * Each generator is a synthesis of the seller-supplied expert prompts. The model
 * is GROUNDED with REAL data — Google search volume + advertiser competition for
 * related keywords, and the tags the top live Etsy listings actually use — so its
 * keyword-difficulty / volume claims are real, not invented. Where a keyword has
 * no real metric, the model is told to mark it an estimate and never fabricate a
 * precise number (matches the app's no-fabricated-data rule).
 */
import { searchEtsyListingsPaged } from '@/lib/etsy'
import { googleKeywordIdeas, isGoogleAdsConfigured } from '@/lib/google-ads'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import type { GeminiSchema } from '@/lib/gemini'

// ─── Real-data grounding ──────────────────────────────────────────────────────
export interface Grounding {
  text: string
  volumeKeywords: { keyword: string; searches: number | null; competition: string }[]
  topTags: { tag: string; usedPct: number }[]
}

/** Fetch real Google demand + top-listing tags for the focus keyword.
 *  Cached per (keyword, geo): the SAME grounding feeds Title/Tag/Description and
 *  every re-run, so this turns a ~5s live fetch into an instant hit after the
 *  first generation. TTL stays under Etsy's 6h listing-content limit. */
export async function buildGrounding(keyword: string, geo = 'US'): Promise<Grounding> {
  const key = cacheKey('ai-grounding', 'v1', geo, keyword)
  const cached = memCache.get<Grounding>(key)
  if (cached) return cached

  const [ideas, search] = await Promise.all([
    isGoogleAdsConfigured() ? googleKeywordIdeas(keyword, geo).catch(() => []) : Promise.resolve([]),
    searchEtsyListingsPaged(keyword, 50, 0, { skipImages: true }).catch(() => ({ listings: [], count: 0 })),
  ])

  const volumeKeywords = ideas
    .slice(0, 25)
    .map(i => ({ keyword: String(i.keyword), searches: i.searches ?? null, competition: String(i.competition ?? 'UNKNOWN') }))

  // Tag frequency across the top live listings.
  const counts = new Map<string, number>()
  const n = search.listings.length
  for (const l of search.listings) for (const t of l.tags ?? []) {
    const k = t.toLowerCase().trim()
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const topTags = [...counts.entries()]
    .map(([tag, c]) => ({ tag, usedPct: n ? Math.round((c / n) * 100) : 0 }))
    .sort((a, b) => b.usedPct - a.usedPct)
    .slice(0, 30)

  const volLines = volumeKeywords.length
    ? volumeKeywords.map(k => `- ${k.keyword} — ${k.searches != null ? k.searches + '/mo' : 'volume n/a'}, competition ${k.competition}`).join('\n')
    : '(no Google Ads volume available — treat all difficulty/volume as ESTIMATES)'
  const tagLines = topTags.length
    ? topTags.map(t => `- ${t.tag} (used by ${t.usedPct}% of top listings)`).join('\n')
    : '(no live-listing tag data available)'

  const text = `REAL DATA FOR "${keyword}" (${geo}) — use these actual figures; do NOT invent volumes or KD:

GOOGLE SEARCH VOLUME & COMPETITION (real Google Ads data):
${volLines}

TAGS USED BY THE TOP LIVE ETSY LISTINGS (real, ranked by adoption):
${tagLines}`

  const result: Grounding = { text, volumeKeywords, topTags }
  memCache.set(key, result, CACHE_TTL.KEYWORD)
  return result
}

// ─── TITLE ────────────────────────────────────────────────────────────────────
export const TITLE_SYSTEM =
  "You are the world's leading Etsy SEO strategist with 20+ years in Etsy Search, Google SEO, keyword clustering, semantic search, buyer psychology, CTR and conversion optimization. You engineer titles that rank AND read naturally for humans."

export function titlePrompt(keyword: string, grounding: string): string {
  return `${grounding}

TASK: Generate 10 completely different, high-converting Etsy titles for the focus keyword: "${keyword}".

KEYWORD STRATEGY — build a cluster, don't repeat one keyword. Mix exact-match, partial-match, phrase-match, semantic, long-tail and LSI keywords. Prioritise LOW competition + real search volume + high buyer intent + evergreen/commercial intent, using the REAL DATA above.

TITLE RULES (every title):
- 120–140 characters.
- START with the exact focus keyword.
- Highest-value keywords within the first 40 characters.
- Use the focus keyword once (twice only if it genuinely improves readability).
- Include 5–8 relevant low-KD keywords + long-tail/LSI/semantic variations.
- Separate keyword phrases with COMMAS. No symbols like | ★ ✓ • and no emojis.
- End with a strong buyer-intent modifier (Instant Download, Editable Template, Printable, etc.) ONLY when relevant to the product.
- Read like a real top-seller wrote it — natural, no keyword stuffing, no word repeated more than twice, readability 9/10+.

For each title also compute: character count, the primary keywords, the low-KD keywords included, semantic keywords used, buyer-intent level (Low/Medium/High), spam score (0–100, lower better), natural readability (0–100), estimated SEO strength (0–100), CTR potential (0–100).

Then: pick the single strongest title (its index 0–9) and explain why; suggest 5 alternative low-KD keywords that could outperform the focus keyword; and 5 long-tail variations for future listings.

If a keyword's real metric is not in the DATA above, treat its difficulty/volume as an ESTIMATE — never state a precise fabricated number.`
}

export const TITLE_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    focusKeyword: { type: 'string' },
    titles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          charCount: { type: 'integer' },
          primaryKeywords: { type: 'array', items: { type: 'string' } },
          lowKdKeywords: { type: 'array', items: { type: 'string' } },
          semanticKeywords: { type: 'array', items: { type: 'string' } },
          buyerIntent: { type: 'string' },
          spamScore: { type: 'integer' },
          readabilityScore: { type: 'integer' },
          seoStrength: { type: 'integer' },
          ctrPotential: { type: 'integer' },
        },
        required: ['title', 'charCount', 'buyerIntent', 'spamScore', 'readabilityScore', 'seoStrength', 'ctrPotential'],
      },
    },
    best: { type: 'object', properties: { index: { type: 'integer' }, reason: { type: 'string' } }, required: ['index', 'reason'] },
    altKeywords: { type: 'array', items: { type: 'string' } },
    longTailVariations: { type: 'array', items: { type: 'string' } },
  },
  required: ['focusKeyword', 'titles', 'best', 'altKeywords', 'longTailVariations'],
}

// ─── TAG ──────────────────────────────────────────────────────────────────────
export const TAG_SYSTEM =
  "You are the world's leading Etsy SEO strategist (20+ years) in Etsy Search, keyword research, semantic SEO and buyer psychology. You generate Etsy tags that maximise discoverability while staying relevant and natural."

export function tagPrompt(keyword: string, grounding: string): string {
  return `${grounding}

TASK: Generate EXACTLY 13 Etsy tags for the focus keyword: "${keyword}" that improve discoverability and attract high-intent buyers.

TAG RULES (every tag):
- 20 characters or fewer, unique, highly relevant.
- Prioritise LOW-competition opportunities and real buyer search behaviour (use the REAL DATA above; prefer tags the top listings actually use + low-competition Google terms).
- Multi-word phrases over single words; avoid plural/singular duplicates unless intent differs; don't repeat words excessively across tags.
- Mix: exact-match, long-tail, buyer-intent, semantic, and product-specific phrases.
- No punctuation or emojis unless part of a common search phrase.

Return exactly 13 tags. Also give: the primary tag, the secondary tags, the long-tail tags, an overall estimated competition (Low/Medium/High), a tag SEO score (0–100), and a brief explanation of the strategy.

If a keyword's real metric is not in the DATA above, estimate relative competition only — never invent volumes or KD values.`
}

export const TAG_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    focusKeyword: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    primaryTag: { type: 'string' },
    secondaryTags: { type: 'array', items: { type: 'string' } },
    longTailTags: { type: 'array', items: { type: 'string' } },
    competition: { type: 'string' },
    seoScore: { type: 'integer' },
    strategy: { type: 'string' },
  },
  required: ['focusKeyword', 'tags', 'primaryTag', 'competition', 'seoScore', 'strategy'],
}

// ─── DESCRIPTION ──────────────────────────────────────────────────────────────
export const DESC_SYSTEM =
  "You are the world's leading Etsy SEO copywriter and eCommerce strategist (20+ years) in Etsy Search, Google SEO, buyer psychology, semantic SEO and conversion optimization. You write descriptions that rank AND convert."

export interface DescInputs {
  keyword: string
  productName?: string
  productType?: string
  audience?: string
  features?: string
}

export function descriptionPrompt(inp: DescInputs, grounding: string): string {
  return `${grounding}

TASK: Write ONE polished, publication-ready Etsy product description.

INPUT
- Focus Keyword: ${inp.keyword}
- Product Name: ${inp.productName || '(infer a sensible one from the keyword)'}
- Product Type: ${inp.productType || '(infer: Digital or Physical)'}
- Target Audience: ${inp.audience || '(infer the likely buyer)'}
- Product Features: ${inp.features || '(infer typical features for this product)'}

SEO: naturally use the exact focus keyword 2–4 times — once in the first paragraph, once in a heading/bullet section, once in features/benefits, once in the closing (only if natural). Weave in secondary, long-tail, semantic and buyer-intent keywords from the REAL DATA above. Never keyword-stuff; never force a keyword.

STRUCTURE (use clear headings + bullet points + numbered steps, Etsy-ready, plenty of spacing):
1. Product Overview — 2–3 engaging paragraphs, start with the focus keyword, say what it is + the biggest benefit.
2. Why You'll Love It — benefit bullets.
3. What's Included — bullets.
4. Product Features — bullets (formats, editable/printable, compatible software, sizes, instant download, resolution as relevant).
5. How to Download (digital) or How It Works (physical) — numbered steps.
6. How to Use — bullets.
7. Perfect For — audience/use-case bullets.
8. Important Information — bullets (digital = non-refundable after download where applicable, colours may vary, personal/commercial use terms).
9. Call to Action — short friendly closing paragraph.

STYLE: short paragraphs, active voice, simple English, professional + friendly, no AI clichés, no exaggerated claims, no keyword stuffing, no duplicate sentences. Optimised for Etsy Search AND Google Search.

Return the full description as ONE formatted markdown string in the "description" field (use ## headings, - bullets, numbered lists). Also return: secondary keywords, long-tail keywords, semantic keywords, and scores for SEO (0–100), readability (0–100) and conversion (0–100).

If real metrics are unavailable, note assessments are estimates based on best practice — never invent precise volumes/KD.`
}

export const DESC_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    focusKeyword: { type: 'string' },
    description: { type: 'string' },
    secondaryKeywords: { type: 'array', items: { type: 'string' } },
    longTailKeywords: { type: 'array', items: { type: 'string' } },
    semanticKeywords: { type: 'array', items: { type: 'string' } },
    seoScore: { type: 'integer' },
    readabilityScore: { type: 'integer' },
    conversionScore: { type: 'integer' },
  },
  required: ['focusKeyword', 'description', 'seoScore', 'readabilityScore', 'conversionScore'],
}
