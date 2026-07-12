import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchEtsyListings } from '@/lib/etsy'

export const runtime = 'nodejs'

/**
 * AI Listing Helper — generates an SEO-optimized Etsy title, 13 tags, and a
 * description for a product.
 *
 * • If ANTHROPIC_API_KEY is set, it uses Claude (structured JSON output) grounded
 *   in the real tags of the top live Etsy listings for the seed keyword.
 * • If no key is set yet, it falls back to a rule-based generator built from the
 *   same live Etsy tag data — so the tool is useful immediately and upgrades to
 *   full AI the moment a key is added. No behaviour change is needed in the UI.
 */

const MODEL = process.env.AI_MODEL || 'claude-opus-4-8'

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

// ─── Claude-powered generation ────────────────────────────────────────────────
async function aiResult(seed: string, details: string, ctx: { tags: string[]; sampleTitles: string[] }): Promise<ListingResult> {
  const client = new Anthropic()

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      titles:      { type: 'array', items: { type: 'string' } },
      tags:        { type: 'array', items: { type: 'string' } },
      description: { type: 'string' },
      altText:     { type: 'string' },
    },
    required: ['titles', 'tags', 'description', 'altText'],
  }

  const prompt =
    `You are an expert Etsy SEO copywriter. Write an optimized listing for this product.\n\n` +
    `Product: ${seed}\n` +
    (details ? `Extra details: ${details}\n` : '') +
    `\nReal tags currently used by top-ranking Etsy listings for this niche (use the strongest, most relevant ones): ${ctx.tags.slice(0, 30).join(', ') || '(none found)'}\n` +
    (ctx.sampleTitles.length ? `Example competing titles: ${ctx.sampleTitles.slice(0, 5).join(' // ')}\n` : '') +
    `\nRules:\n` +
    `- titles: 3 distinct title options, each a complete Etsy title, MAX 140 characters, front-load the most-searched keywords.\n` +
    `- tags: exactly 13 tags, each MAX 20 characters, multi-word long-tail phrases, no single-letter/numeric-only tags, no duplicates, no '#'.\n` +
    `- description: 90–160 words, scannable, buyer-focused, with a short intro line then bullet points, then a natural keyword line.\n` +
    `- altText: one concise image alt-text line, MAX 120 chars.\n` +
    `Return only the JSON.`

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }],
  })

  const text = res.content.find(b => b.type === 'text')
  const raw = text && 'text' in text ? text.text : '{}'
  const parsed = JSON.parse(raw) as Omit<ListingResult, 'ai'>
  return {
    titles:      (parsed.titles ?? []).slice(0, 3),
    tags:        (parsed.tags ?? []).slice(0, 13),
    description: parsed.description ?? '',
    altText:     parsed.altText ?? '',
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ success: true, data: fallbackResult(seed, details, ctx.tags) })
    }

    try {
      const data = await aiResult(seed, details, ctx)
      // Guard against an empty AI payload — fall back rather than returning nothing.
      if (!data.tags.length && !data.titles.length) {
        return NextResponse.json({ success: true, data: fallbackResult(seed, details, ctx.tags) })
      }
      return NextResponse.json({ success: true, data })
    } catch (aiErr) {
      console.error('[AI Listing] Claude call failed, using fallback:', aiErr)
      return NextResponse.json({ success: true, data: fallbackResult(seed, details, ctx.tags) })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }
}
