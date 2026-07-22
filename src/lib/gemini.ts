/**
 * Google Gemini — the AI provider for Rankkw's generation features (titles,
 * tags, descriptions, and the listing-improvement suggestions).
 *
 * Scope boundary that matters for this codebase: Gemini WRITES COPY. It never
 * invents analytics. Every generation call is grounded in the real Etsy tags and
 * titles of the live listings for a keyword, and the model is told to work from
 * them — so "no fabricated data" still holds. Search volume, sales, KD etc. are
 * always measured from the APIs, never asked of the model.
 *
 * Uses the REST endpoint directly (no SDK) to keep the dependency surface small
 * and the failure modes explicit.
 */

// The key was uploaded under the non-standard name `Gemini_API_KEY`; accept the
// conventional GEMINI_API_KEY too so either works.
function geminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.Gemini_API_KEY || '').trim()
}

export function isGeminiConfigured(): boolean {
  return geminiKey().length > 0
}

// `gemini-flash-latest` is an ALIAS that always resolves to the current Flash
// model, so it can't be sunset out from under us the way a pinned version can —
// verified 2026-07-16 that pinned `gemini-2.5-flash` 404s "no longer available
// to new users" while this alias returns 200. Override via GEMINI_MODEL if you
// later want to pin a specific model.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

// JSON-schema subset Gemini accepts on `responseSchema`.
export type GeminiSchema = Record<string, unknown>

interface GenerateOpts {
  prompt: string
  schema?: GeminiSchema      // when set, forces application/json output matching it
  system?: string
  temperature?: number
  maxOutputTokens?: number
  /**
   * Flash 2.5 spends "thinking" tokens BEFORE output, which silently truncated
   * structured JSON at the default budget. Copy generation needs no reasoning,
   * so thinking is off by default here. Set `think: true` for a task that
   * genuinely benefits (e.g. the AI mentor's multi-step answers).
   */
  think?: boolean
}

/**
 * One generation call. Returns the model's text (JSON string when a schema is
 * given), or null on any failure — callers fall back to their rule-based path
 * rather than surfacing a 500. Never throws.
 */
export async function geminiGenerate(opts: GenerateOpts): Promise<string | null> {
  const key = geminiKey()
  if (!key) return null

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      // Headroom matters: `gemini-flash-latest` now resolves to a model that
      // ALWAYS spends some thinking tokens before the output (and REJECTS
      // thinkingBudget:0 with a 400 — see below), so the budget must cover the
      // thinking AND the full JSON or structured output truncates mid-string.
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      // Only send thinkingConfig to request MORE reasoning (dynamic). We must
      // never send thinkingBudget:0 — the current model 400s on it
      // ("INVALID_ARGUMENT"). Omitting it lets the model use its default.
      ...(opts.think ? { thinkingConfig: { thinkingBudget: -1 } } : {}),
      ...(opts.schema
        ? { responseMimeType: 'application/json', responseSchema: opts.schema }
        : {}),
    },
  }
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] }
  }

  try {
    const res = await fetch(
      `${BASE}/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    )

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      // A 404 here means the pinned model was retired — name it so the log is
      // actionable instead of a bare status code.
      if (res.status === 404) {
        console.error(`[Gemini] model "${MODEL}" returned 404 — likely retired. Set GEMINI_MODEL to a current one. ${errBody.slice(0, 160)}`)
      } else {
        console.error(`[Gemini] ${res.status}: ${errBody.slice(0, 200)}`)
      }
      return null
    }

    const json = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
      promptFeedback?: { blockReason?: string }
    }

    if (json.promptFeedback?.blockReason) {
      console.error('[Gemini] blocked:', json.promptFeedback.blockReason)
      return null
    }

    const text = json.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
    return text || null
  } catch (e) {
    console.error('[Gemini] request failed:', e)
    return null
  }
}

/**
 * Generate and parse a JSON object against a schema. Returns null (not a throw)
 * if the model is unconfigured, fails, or returns unparseable JSON — so every
 * caller keeps a clean fallback path.
 */
export async function geminiJSON<T>(opts: GenerateOpts & { schema: GeminiSchema }): Promise<T | null> {
  const raw = await geminiGenerate(opts)
  if (!raw) return null
  try {
    // responseSchema yields clean JSON, but strip a stray ```json fence defensively.
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    return JSON.parse(cleaned) as T
  } catch (e) {
    console.error('[Gemini] JSON parse failed:', e, '| raw:', raw.slice(0, 160))
    return null
  }
}
