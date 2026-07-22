import { NextRequest, NextResponse } from 'next/server'
import { searchEtsyListings } from '@/lib/etsy'
import { geminiJSON, isGeminiConfigured } from '@/lib/gemini'

export const runtime = 'nodejs'

/**
 * AI Listing Helper — generates an SEO-optimized Etsy title, 13 tags, and a
 * description for a product.
 *
 * • If a Gemini key is set, Gemini writes the copy, GROUNDED in the real tags of
 *   the top live Etsy listings for the seed keyword — the model is given the
 *   actual competing tags/titles and told to work from them. It writes copy; it
 *   never invents analytics.
 * • With no key it falls back to a rule-based generator built from the same live
 *   Etsy tag data — so the tool is useful immediately and upgrades to full AI the
 *   moment a key is added. The UI needs no change either way.
 */

interface ListingResult {
  titles:      string[]
  tags:        string[]
  description: string
  altText:     string
  ai:          boolean
}

const cap = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase())

// ─── Pull the real tags buyers-facing listings already rank with ──────────────
async function liveTagContext(seed: string): Promise<{ tags: string[]; sampleTitles: string[] }> {
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
  const tags = Object.entries(counts)
    .sort((a, b) => b[1].v / b[1].c - a[1].v / a[1].c)
    .map(([t]) => t)
  return { tags, sampleTitles: listings.slice(0, 8).map(l => l.title).filter(Boolean) }
}

// ─── Rule-based fallback (no API key) ─────────────────────────────────────────
function joinUntil(parts: string[], sep: string, max = 140): string {
  let out = ''
  for (const p of parts) {
    const next = out ? out + sep + p : p
    if (next.length > max) break
    out = next
  }
  return out
}

function fallbackResult(seed: string, details: string, tagPool: string[]): ListingResult {
  const seedL = seed.toLowerCase()
  // Etsy tags are capped at 20 characters — keep the seed only if it fits, else
  // lead with the strongest live tags (which are already ≤20 chars).
  const tags = [seedL, ...tagPool]
    .filter(t => t.length <= 20)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 13)
  const titles = [
    cap(joinUntil([seedL, ...tagPool], ' | ')),
    cap(joinUntil([seedL, ...tagPool], ', ')),
    cap(joinUntil([tagPool[0] ?? seedL, seedL, ...tagPool.slice(1)], ' ')),
  ].filter((v, i, a) => v && a.indexOf(v) === i)

  const feats = tagPool.slice(0, 4).map(cap)
  const description =
    `${cap(seedL)}${details ? ` — ${details}` : ''}.\n\n` +
    `Thoughtfully made and ready to gift. ${feats.length ? `Loved for its ${feats.slice(0, 3).join(', ').toLowerCase()}.` : ''}\n\n` +
    `• Handcrafted with care\n• Makes a memorable gift\n• Ships securely and on time\n\n` +
    `Keywords: ${tags.slice(0, 8).join(', ')}.`

  return { titles, tags, description, altText: cap(joinUntil([seedL, ...tagPool], ' ', 120)), ai: false }
}

// ─── Gemini-powered generation (grounded in real Etsy tags) ───────────────────
// Enforce Etsy's hard caps in the schema itself so the model can't hand back an
// invalid listing: titles ≤140, exactly 13 tags ≤20 chars each.
const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    titles:      { type: 'array', items: { type: 'string', maxLength: 140 }, minItems: 3, maxItems: 3 },
    tags:        { type: 'array', items: { type: 'string', maxLength: 20 }, minItems: 13, maxItems: 13 },
    description: { type: 'string' },
    altText:     { type: 'string', maxLength: 120 },
  },
  required: ['titles', 'tags', 'description', 'altText'],
} as const

async function aiResult(seed: string, details: string, ctx: { tags: string[]; sampleTitles: string[] }): Promise<ListingResult | null> {
  const prompt =
    `You are an expert Etsy SEO copywriter. Write an optimized listing for this product.\n\n` +
    `Product: ${seed}\n` +
    (details ? `Extra details: ${details}\n` : '') +
    `\nReal tags currently used by top-ranking Etsy listings for this niche (use the strongest, most relevant ones): ${ctx.tags.slice(0, 30).join(', ') || '(none found)'}\n` +
    (ctx.sampleTitles.length ? `Example competing titles: ${ctx.sampleTitles.slice(0, 5).join(' // ')}\n` : '') +
    `\nRules:\n` +
    `- titles: 3 distinct title options, each a complete Etsy title, MAX 140 characters, front-load the most-searched keywords.\n` +
    `- tags: exactly 13 tags, each MAX 20 characters, multi-word long-tail phrases, no single-letter/numeric-only tags, no duplicates, no '#'.\n` +
    `- description: 90–160 words, scannable, buyer-focused: a short intro line, then bullet points, then a natural keyword line.\n` +
    `- altText: one concise image alt-text line, MAX 120 chars.`

  const parsed = await geminiJSON<Omit<ListingResult, 'ai'>>({
    prompt,
    schema: LISTING_SCHEMA,
    system: 'You write Etsy listing copy grounded in the real competing tags provided. Never invent statistics.',
    temperature: 0.8,
    // Headroom for the model's default thinking + the full JSON (see gemini.ts).
    maxOutputTokens: 4096,
  })
  if (!parsed) return null   // model failed / unconfigured → caller uses fallback

  // Belt and braces: re-clamp to Etsy's caps even though the schema requested them.
  return {
    titles:      (parsed.titles ?? []).map(t => t.slice(0, 140)).slice(0, 3),
    tags:        (parsed.tags ?? []).map(t => t.toLowerCase().trim().slice(0, 20)).filter(Boolean).slice(0, 13),
    description: parsed.description ?? '',
    altText:     (parsed.altText ?? '').slice(0, 120),
    ai:          true,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const seed = String(body.seed ?? '').trim()
  const details = String(body.details ?? '').trim().slice(0, 300)
  if (seed.length < 2) {
    return NextResponse.json({ success: false, error: 'Describe your product (2+ characters).' }, { status: 400 })
  }

  try {
    const ctx = await liveTagContext(seed)

    // No key, or the model failed/rate-limited (geminiJSON returns null) → the
    // rule-based generator still gives a useful, real-tag-grounded result.
    if (isGeminiConfigured()) {
      const data = await aiResult(seed, details, ctx)
      if (data && (data.tags.length || data.titles.length)) {
        return NextResponse.json({ success: true, data })
      }
    }
    return NextResponse.json({ success: true, data: fallbackResult(seed, details, ctx.tags) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
