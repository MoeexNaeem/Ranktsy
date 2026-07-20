import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey, CACHE_TTL } from '@/lib/cache'
import { searchEtsyListingsPaged, getListingById } from '@/lib/etsy'
import { geminiJSON, isGeminiConfigured } from '@/lib/gemini'
import type { ApiResponse, AiOptimization, AiSuggestion, EtsyListing } from '@/types'

export const runtime = 'nodejs'

/**
 * AI Improvement Suggestions + One-Click Optimization.
 *
 * The audit finds the gaps → Gemini writes the fixes. This route takes a real
 * listing plus the REAL audit findings the client already computed, re-runs the
 * keyword-gap scan server-side (same cache as /api/keywords/gap, so it's warm),
 * and asks Gemini for a prioritised fix list + a complete rewritten listing.
 *
 * Compliance boundary: Gemini writes COPY from MEASURED findings. Every number
 * in its input (tag adoption %, char counts, check details) was computed from
 * Etsy's API; the model is told to cite only those and never invent statistics.
 * With no key (or a 429), a rule-based path still returns real, useful fixes.
 */

// The audit findings the client computed — passed through as prompt context.
interface Finding { label: string; status: 'pass' | 'warn' | 'fail'; detail: string }

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'gift', 'gifts', 'handmade', 'custom', 'personalized'])

// Fallback grounding seed when no keyword is given: the listing's own leading
// title words (what it's ostensibly trying to rank for).
function seedFromTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w)).slice(0, 3).join(' ')
}

// ─── Keyword-gap scan (shares /api/keywords/gap's cache) ──────────────────────
async function missingHighValueTags(keyword: string, yourTags: Set<string>): Promise<{ sampled: number; missing: { tag: string; usedPct: number }[] }> {
  const scanKey = cacheKey('gap', 'v1', 'scan', keyword)
  let scan = memCache.get<{ listings: EtsyListing[]; count: number }>(scanKey)
  if (!scan) {
    scan = await searchEtsyListingsPaged(keyword, 100, 0, { skipImages: true })
    memCache.set(scanKey, scan, CACHE_TTL.KEYWORD)
  }
  const n = scan.listings.length
  if (!n) return { sampled: 0, missing: [] }

  const counts = new Map<string, number>()
  for (const l of scan.listings) {
    for (const t of new Set((l.tags ?? []).map(x => x.toLowerCase().trim()).filter(Boolean))) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  const missing = [...counts.entries()]
    .map(([tag, used]) => ({ tag, usedPct: Math.round((used / n) * 100) }))
    .filter(t => t.usedPct >= 15 && !yourTags.has(t.tag))
    .sort((a, b) => b.usedPct - a.usedPct)
    .slice(0, 12)
  return { sampled: n, missing }
}

// ─── Shared post-processing ───────────────────────────────────────────────────
const dedupe = (tags: string[]) => tags
  .map(t => t.toLowerCase().trim().slice(0, 20)).filter(Boolean)
  .filter((v, i, a) => a.indexOf(v) === i)

function diffTags(current: string[], next: string[]): { tagsToAdd: string[]; tagsToRemove: string[] } {
  const cur = new Set(current.map(t => t.toLowerCase().trim()))
  const nxt = new Set(next)
  return {
    tagsToAdd:    next.filter(t => !cur.has(t)),
    tagsToRemove: [...cur].filter(t => !nxt.has(t)),
  }
}

// ─── Rule-based fallback (no key / Gemini failed) ─────────────────────────────
// Still real and useful: the suggestions ARE the audit findings, and the tag set
// is the listing's own tags topped up with the measured missing high-value tags.
function fallbackResult(
  listing: EtsyListing, findings: Finding[],
  grounding: { keyword: string; sampled: number; missingTags: { tag: string; usedPct: number }[] },
): AiOptimization {
  const suggestions: AiSuggestion[] = findings
    .filter(f => f.status !== 'pass')
    .map(f => ({
      priority: (f.status === 'fail' ? 'high' : 'medium') as AiSuggestion['priority'],
      area: f.label,
      issue: f.detail,
      action: `Fix “${f.label}” — ${f.detail}`,
    }))
  if (grounding.missingTags.length) {
    suggestions.unshift({
      priority: 'high',
      area: 'Tags',
      issue: `${grounding.missingTags.length} high-adoption tags for “${grounding.keyword}” are missing from your listing.`,
      action: `Add: ${grounding.missingTags.map(t => `${t.tag} (${t.usedPct}%)`).join(', ')}.`,
    })
  }

  const currentTags = listing.tags ?? []
  const tags = dedupe([...currentTags, ...grounding.missingTags.map(t => t.tag)]).slice(0, 13)

  // Title: only extend a too-short title, and only with the measured missing
  // tags — no invented phrasing.
  let title = listing.title
  if (title.length < 70) {
    for (const t of grounding.missingTags) {
      const next = `${title} | ${t.tag}`
      if (next.length > 140) break
      title = next
    }
  }

  const high = suggestions.filter(s => s.priority === 'high').length
  return {
    ai: false,
    summary: `${suggestions.length} fix${suggestions.length === 1 ? '' : 'es'} found (${high} high-priority). AI copywriting is unavailable right now — these are rule-based fixes built directly from your audit results.`,
    suggestions,
    title,
    tags,
    ...diffTags(currentTags, tags),
    description: listing.description ?? '',
    grounding,
  }
}

// ─── Gemini path ──────────────────────────────────────────────────────────────
const OPTIMIZE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', maxLength: 300 },
    suggestions: {
      type: 'array', minItems: 1, maxItems: 8,
      items: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          area:     { type: 'string', maxLength: 40 },
          issue:    { type: 'string', maxLength: 200 },
          action:   { type: 'string', maxLength: 280 },
        },
        required: ['priority', 'area', 'issue', 'action'],
      },
    },
    title:       { type: 'string', maxLength: 140 },
    tags:        { type: 'array', items: { type: 'string', maxLength: 20 }, minItems: 13, maxItems: 13 },
    description: { type: 'string' },
  },
  required: ['summary', 'suggestions', 'title', 'tags', 'description'],
} as const

async function aiResult(
  listing: EtsyListing, findings: Finding[],
  grounding: { keyword: string; sampled: number; missingTags: { tag: string; usedPct: number }[] },
): Promise<AiOptimization | null> {
  const issues = findings.filter(f => f.status !== 'pass')
  const prompt =
    `You are an expert Etsy SEO consultant. A listing was audited against real, measured data. ` +
    `Turn the findings below into (a) a prioritised fix list and (b) a complete optimized rewrite.\n\n` +
    `CURRENT LISTING (real):\n` +
    `Title (${listing.title.length}/140 chars): ${listing.title}\n` +
    `Tags (${(listing.tags ?? []).length}/13): ${(listing.tags ?? []).join(', ') || '(none)'}\n` +
    `Description (${(listing.description ?? '').length} chars):\n${(listing.description ?? '').slice(0, 1200) || '(empty)'}\n\n` +
    `AUDIT FINDINGS (each measured from Etsy's API — cite these, do not invent new statistics):\n` +
    (issues.length ? issues.map(f => `- [${f.status.toUpperCase()}] ${f.label}: ${f.detail}`).join('\n') : '- (no failing checks)') + '\n\n' +
    (grounding.sampled
      ? `KEYWORD GAP — measured across the top ${grounding.sampled} live listings ranking for "${grounding.keyword}". ` +
        `High-adoption tags this listing is MISSING (tag — % of winners using it):\n` +
        (grounding.missingTags.length ? grounding.missingTags.map(t => `- ${t.tag} — ${t.usedPct}%`).join('\n') : '- (none — tag coverage is already strong)') + '\n\n'
      : '') +
    `Rules:\n` +
    `- suggestions: ordered most-impactful first. Each "issue" must restate a finding above (with its real numbers); each "action" is the concrete fix. Never invent a statistic.\n` +
    `- title: ONE optimized title, MAX 140 chars, front-load searchable phrases, keep what already works in the current title.\n` +
    `- tags: exactly 13, each MAX 20 chars, lowercase, no duplicates, no '#'. Keep the listing's strong existing tags, add the missing high-adoption tags, prefer multi-word phrases.\n` +
    `- description: 90–180 words, scannable — short intro, bullet points, natural keyword line. Keep real product facts from the current description; do not invent materials, sizes, or claims.`

  const parsed = await geminiJSON<{ summary: string; suggestions: AiSuggestion[]; title: string; tags: string[]; description: string }>({
    prompt,
    schema: OPTIMIZE_SCHEMA as unknown as Record<string, unknown>,
    system: 'You rewrite Etsy listings from real audit findings. You write copy only — every statistic you mention must come verbatim from the findings provided. Never invent numbers, materials, or product claims.',
    temperature: 0.6,
    maxOutputTokens: 3072,
  })
  if (!parsed) return null

  const currentTags = listing.tags ?? []
  // Belt and braces: re-clamp to Etsy's caps even though the schema requested them.
  const tags = dedupe(parsed.tags ?? []).slice(0, 13)
  const suggestions = (parsed.suggestions ?? [])
    .filter(s => s.issue && s.action)
    .map(s => ({ ...s, priority: (['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium') as AiSuggestion['priority'] }))
  if (!tags.length || !parsed.title) return null

  return {
    ai: true,
    summary: parsed.summary ?? '',
    suggestions,
    title: parsed.title.slice(0, 140),
    tags,
    ...diffTags(currentTags, tags),
    description: parsed.description ?? '',
    grounding,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AiOptimization>>> {
  const body = await req.json().catch(() => ({}))
  const listingId = Number(body.listingId)
  const keywordIn = String(body.keyword ?? '').trim().toLowerCase().slice(0, 80)
  // Findings come from the client's audit run — sanitise hard since they enter a prompt.
  const findings: Finding[] = Array.isArray(body.findings)
    ? (body.findings as Finding[])
        .filter(f => f && typeof f.label === 'string' && typeof f.detail === 'string')
        .map(f => ({
          label: f.label.slice(0, 60),
          status: (['pass', 'warn', 'fail'].includes(f.status) ? f.status : 'warn') as Finding['status'],
          detail: f.detail.slice(0, 240),
        }))
        .slice(0, 20)
    : []

  if (!Number.isFinite(listingId) || listingId <= 0) {
    return NextResponse.json({ success: false, error: 'Missing listing id.' }, { status: 400 })
  }

  try {
    const listing = await getListingById(listingId)
    if (!listing) {
      return NextResponse.json({ success: false, error: 'Listing not found or inactive.' }, { status: 404 })
    }

    const keyword = keywordIn.length >= 2 ? keywordIn : seedFromTitle(listing.title)
    const yourTags = new Set((listing.tags ?? []).map(t => t.toLowerCase().trim()))

    // The gap scan is a grounding bonus — its failure must not sink the feature.
    let grounding: { keyword: string; sampled: number; missingTags: { tag: string; usedPct: number }[] } =
      { keyword, sampled: 0, missingTags: [] }
    if (keyword.length >= 2) {
      const gap = await missingHighValueTags(keyword, yourTags).catch(() => null)
      if (gap) grounding = { keyword, sampled: gap.sampled, missingTags: gap.missing }
    }

    if (isGeminiConfigured()) {
      const data = await aiResult(listing, findings, grounding)
      if (data) return NextResponse.json({ success: true, data })
    }
    return NextResponse.json({ success: true, data: fallbackResult(listing, findings, grounding) })
  } catch (e) {
    console.error('[AI Optimize] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not generate improvements for this listing.' }, { status: 502 })
  }
}
