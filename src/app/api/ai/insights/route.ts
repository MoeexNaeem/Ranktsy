import { NextRequest, NextResponse } from 'next/server'
import { geminiJSON, isGeminiConfigured } from '@/lib/gemini'
import type { ApiResponse, AiInsightsResult, AiInsight, AiFact, InsightTone } from '@/types'

export const runtime = 'nodejs'

/**
 * Generic AI Insights — the shared engine behind every tool's "AI analysis"
 * panel. A tool POSTs facts it has ALREADY MEASURED from the Etsy/Google APIs;
 * Gemini interprets them into a narrative read + concrete actions.
 *
 * Compliance boundary (the product's whole identity): Gemini receives only
 * pre-measured, pre-formatted numbers and is instructed to interpret — never to
 * produce or estimate — figures. Every statistic the panel shows was real before
 * the model saw it. With no key / a 429, a rule-based fallback still returns a
 * useful read built directly from the same facts.
 */

const TONES: InsightTone[] = ['positive', 'watch', 'neutral']

const INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', maxLength: 160 },
    insights: {
      type: 'array', minItems: 2, maxItems: 6,
      items: {
        type: 'object',
        properties: {
          title:  { type: 'string', maxLength: 80 },
          detail: { type: 'string', maxLength: 260 },
          tone:   { type: 'string', enum: TONES },
        },
        required: ['title', 'detail', 'tone'],
      },
    },
    actions: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', maxLength: 180 } },
  },
  required: ['headline', 'insights', 'actions'],
} as const

// ─── Rule-based fallback (no key / Gemini failed) ─────────────────────────────
function fallback(subject: string, tool: string, facts: AiFact[]): AiInsightsResult {
  const top = facts.slice(0, 6)
  return {
    ai: false,
    headline: `${tool}: ${top.length} measured signals for “${subject}”.`,
    insights: top.map<AiInsight>(f => ({
      title: f.label,
      detail: `${f.value}${f.hint ? ` — ${f.hint}` : ''}.`,
      tone: 'neutral',
    })),
    actions: [
      'AI narrative is unavailable right now — the figures above are the real measured data.',
      'Compare these against your own listing to spot where you sit versus the market.',
    ],
  }
}

// ─── Gemini path ──────────────────────────────────────────────────────────────
async function aiResult(subject: string, tool: string, facts: AiFact[], notes: string): Promise<AiInsightsResult | null> {
  const factLines = facts.map(f => `- ${f.label}: ${f.value}${f.hint ? ` (${f.hint})` : ''}`).join('\n')
  const prompt =
    `You are a senior Etsy SEO & market analyst. Interpret the MEASURED data below for an Etsy seller.\n\n` +
    `Tool: ${tool}\n` +
    `Subject: ${subject}\n\n` +
    `MEASURED FACTS (all real, taken from the Etsy/Google APIs — interpret these, never invent or estimate new numbers):\n` +
    factLines + '\n' +
    (notes ? `\nContext: ${notes}\n` : '') +
    `\nWrite:\n` +
    `- headline: one sharp sentence capturing the single most important takeaway.\n` +
    `- insights: 3–5 items. Each explains what a fact (or a combination of them) MEANS for this seller, citing the real figures from above. Set tone: "positive" (an opportunity/strength), "watch" (a risk/caution), or "neutral". Do not state any number that isn't in the facts.\n` +
    `- actions: 2–4 concrete, specific next steps the seller can take, informed by the data.\n` +
    `Be specific and practical. Never fabricate statistics, search volumes, or sales figures.`

  const parsed = await geminiJSON<{ headline: string; insights: AiInsight[]; actions: string[] }>({
    prompt,
    schema: INSIGHTS_SCHEMA as unknown as Record<string, unknown>,
    system: 'You interpret real, measured Etsy market data into insights. You never invent numbers — every figure you mention must appear in the facts provided. Output strictly matches the schema.',
    temperature: 0.55,
    // `gemini-flash-latest` now resolves to a model that REJECTS thinkingBudget:0
    // (400 INVALID_ARGUMENT), so thinking stays on (dynamic). Flash spends
    // thinking tokens BEFORE the output, which truncated the JSON at the old
    // 2048 budget — so give generous headroom for thinking + the full JSON.
    think: true,
    maxOutputTokens: 4096,
  })
  if (!parsed || !parsed.insights?.length) return null

  return {
    ai: true,
    headline: parsed.headline ?? '',
    insights: parsed.insights
      .filter(i => i.title && i.detail)
      .map(i => ({ title: i.title, detail: i.detail, tone: TONES.includes(i.tone) ? i.tone : 'neutral' }))
      .slice(0, 6),
    actions: (parsed.actions ?? []).filter(Boolean).slice(0, 5),
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AiInsightsResult>>> {
  const body = await req.json().catch(() => ({}))
  const subject = String(body.subject ?? '').trim().slice(0, 120)
  const tool = String(body.tool ?? 'Analysis').trim().slice(0, 60)
  const notes = String(body.notes ?? '').trim().slice(0, 600)
  // Facts enter a prompt — sanitise hard.
  const facts: AiFact[] = Array.isArray(body.facts)
    ? (body.facts as AiFact[])
        .filter(f => f && typeof f.label === 'string' && (typeof f.value === 'string' || typeof f.value === 'number'))
        .map(f => ({
          label: String(f.label).slice(0, 60),
          value: String(f.value).slice(0, 60),
          hint: f.hint ? String(f.hint).slice(0, 80) : undefined,
        }))
        .slice(0, 24)
    : []

  if (!subject || facts.length < 2) {
    return NextResponse.json({ success: false, error: 'Need a subject and at least 2 measured facts.' }, { status: 400 })
  }

  try {
    if (isGeminiConfigured()) {
      const data = await aiResult(subject, tool, facts, notes)
      if (data) return NextResponse.json({ success: true, data })
    }
    return NextResponse.json({ success: true, data: fallback(subject, tool, facts) })
  } catch (e) {
    console.error('[AI Insights] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not generate insights.' }, { status: 502 })
  }
}
