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

import { recordImage } from '@/lib/usage'
import { createLimiter } from '@/lib/concurrency'

// Cap simultaneous image generations per instance so a burst of requests is
// smoothed into a steady stream instead of all hitting Google at once (which
// trips the image rate limit → 429s, wasted retries and spiky cost). Excess
// requests queue briefly. Tune with GEMINI_IMAGE_CONCURRENCY.
const imageLimiter = createLimiter(Number(process.env.GEMINI_IMAGE_CONCURRENCY ?? 3))
// Same idea for text generation (titles/tags/descriptions/listing copy): cap how
// many run at once per instance so a burst doesn't stampede the provider. Text is
// cheaper and faster than images, so the default is higher. Tune with GEMINI_TEXT_CONCURRENCY.
const textLimiter = createLimiter(Number(process.env.GEMINI_TEXT_CONCURRENCY ?? 8))

// One or more API keys. The key was first uploaded under the non-standard name
// `Gemini_API_KEY`; accept the conventional GEMINI_API_KEY too. A SECOND key
// (GEMINI_SECONDARY_API_KEY) — or any number via a comma-separated
// GEMINI_API_KEYS — lets us spread load across keys and fail over when one is
// rate-limited, so a busy moment on a single key doesn't surface as "Generation
// failed". Duplicates and blanks are dropped; order is primary-first.
function geminiKeys(): string[] {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.Gemini_API_KEY,
    process.env.GEMINI_SECONDARY_API_KEY,
    ...(process.env.GEMINI_API_KEYS?.split(',') ?? []),
  ]
  const seen = new Set<string>()
  const keys: string[] = []
  for (const k of raw) {
    const t = (k ?? '').trim()
    if (t && !seen.has(t)) { seen.add(t); keys.push(t) }
  }
  return keys
}

export function isGeminiConfigured(): boolean {
  return geminiKeys().length > 0
}

// Round-robin so successive requests START on different keys — this spreads
// steady load evenly instead of always hammering the first key (and only
// spilling to the second on failure). Returns the keys rotated so the caller
// tries them in a fresh order each call.
let keyCursor = 0
function keyOrder(): string[] {
  const keys = geminiKeys()
  if (keys.length <= 1) return keys
  const start = keyCursor++ % keys.length
  return [...keys.slice(start), ...keys.slice(0, start)]
}

// Text model. Benchmarked 2026-08-21 on this key: `gemini-flash-latest` (and
// gemini-3.7-flash) return 503 "high demand" ~75% of the time and are slow when
// they do answer — that was the "generations are very slow" report. `gemini-3.1-
// flash-lite` returns 200 in ~2s, reliably (3/3), for the same structured task —
// a ~20× speedup — so it is now the default. FALLBACK_MODEL is tried when the
// primary is overloaded (gemini-3.5-flash: ~3s, also reliable). Override either
// via GEMINI_MODEL / GEMINI_FALLBACK_MODEL.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash'
// Flash Image ("Nano Banana"). The `-preview` alias 404s on this key; the stable
// `gemini-2.5-flash-image` works. Override with GEMINI_IMAGE_MODEL to use a newer
// one (e.g. gemini-3.1-flash-image). Verified 2026-07-28.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Image-generation pricing (USD). Gemini 2.5 Flash Image bills image OUTPUT as
// tokens (~1290 tokens per image → ~$0.039); text INPUT is cheap. Rates are
// env-overridable so they can be corrected if the model/price changes. Cost is
// computed from the real usageMetadata token counts each call returns.
const IMG_IN_USD_PER_MTOK  = Number(process.env.GEMINI_IMAGE_INPUT_USD_PER_MTOK  ?? 0.30)
const IMG_OUT_USD_PER_MTOK = Number(process.env.GEMINI_IMAGE_OUTPUT_USD_PER_MTOK ?? 30)
const IMG_FALLBACK_USD     = Number(process.env.GEMINI_IMAGE_USD_PER_IMAGE       ?? 0.039)

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

/** Why a text generation failed — callers can turn 'quota' into an honest message. */
export type GeminiReason = 'quota' | 'blocked' | 'unconfigured' | 'model_retired' | 'error'
export interface GeminiMeta { reason?: GeminiReason }

/**
 * One generation call. Returns the model's text (JSON string when a schema is
 * given), or null on any failure — callers fall back to their rule-based path
 * rather than surfacing a 500. Never throws. Pass an optional `meta` object to
 * learn WHY it returned null (e.g. 'quota' when the provider's billing is out),
 * so the UI can show an honest message instead of "please try again".
 */
export async function geminiGenerate(opts: GenerateOpts, meta?: GeminiMeta): Promise<string | null> {
  if (!isGeminiConfigured()) { if (meta) meta.reason = 'unconfigured'; return null }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      // Headroom matters: `gemini-flash-latest` now resolves to a model that
      // ALWAYS spends some thinking tokens before the output (and REJECTS
      // thinkingBudget:0 with a 400 — see below), so the budget must cover the
      // thinking AND the full JSON or structured output truncates mid-string.
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      // Thinking OFF by default (`thinkingBudget: 0`). Benchmarked 2026-08-21:
      // budget:0 returns 200 in ~2s, while OMITTING thinkingConfig routes to the
      // model's dynamic-thinking path which is heavily overloaded (503s) and
      // slow. (The old "budget:0 400s" note is stale — it works now on the
      // 3.1-flash-lite / 3.5-flash models we use.) `think:true` → dynamic (-1).
      thinkingConfig: { thinkingBudget: opts.think ? -1 : 0 },
      ...(opts.schema
        ? { responseMimeType: 'application/json', responseSchema: opts.schema }
        : {}),
    },
  }
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] }
  }

  // Try the fast primary model first; if it's overloaded/errors, fall back to the
  // secondary model (a busy moment on one model no longer surfaces as a failure).
  // Terminal outcomes (blocked / retired / unconfigured) don't try the fallback —
  // it wouldn't help. Queue behind the per-instance text cap so a surge can't
  // stampede the provider; each sendGemini also rotates configured keys.
  const models = [MODEL, FALLBACK_MODEL].filter((m, i, a) => m && a.indexOf(m) === i)
  return textLimiter.run(async () => {
    for (let i = 0; i < models.length; i++) {
      const isLast = i === models.length - 1
      const out = await sendGemini(models[i], body, meta)
      if (out != null) return out
      // Only overloaded/error is worth retrying on the next model.
      if (isLast || (meta && (meta.reason === 'blocked' || meta.reason === 'model_retired' || meta.reason === 'unconfigured'))) return out
    }
    return null
  })
}

async function sendGemini(model: string, body: Record<string, unknown>, meta?: GeminiMeta): Promise<string | null> {
  const keys = keyOrder()
  if (!keys.length) { if (meta) meta.reason = 'unconfigured'; return null }
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  // With MULTIPLE keys: visit every key once, plus a couple of passes for a
  // transient blip. With a SINGLE key: just 1 quick retry — the client owns the
  // longer, SPACED retry loop, so hammering one key here only wastes requests.
  const MAX_ATTEMPTS = keys.length > 1 ? Math.max(4, keys.length + 2) : 2
  let sawQuota = false

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const key = keys[attempt % keys.length]
    const url = `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        // 404 = pinned model retired; not retryable (another key won't help).
        if (res.status === 404) {
          console.error(`[Gemini] model "${model}" returned 404 — likely retired. Set GEMINI_MODEL to a current one. ${errBody.slice(0, 160)}`)
          if (meta) meta.reason = 'model_retired'
          return null
        }
        // 429 = rate-limited/exhausted; 5xx = overloaded. Both are transient and
        // both fail over to the NEXT key. While we still have un-tried keys this
        // pass, move on almost immediately; only once we've cycled through every
        // key do we back off (capped) before trying again.
        if (res.status === 429) sawQuota = true
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS - 1) {
          const cycledAllKeys = attempt >= keys.length - 1
          const wait = keys.length > 1 && !cycledAllKeys
            ? 150
            : Math.min(700 * 2 ** Math.max(0, attempt - keys.length + 1), 4000)
          console.warn(`[Gemini] ${res.status} on key #${(attempt % keys.length) + 1}/${keys.length} — retrying (${attempt + 1}/${MAX_ATTEMPTS - 1})`)
          await sleep(wait)
          continue
        }
        console.error(`[Gemini] ${res.status}: ${errBody.slice(0, 200)}`)
        // A terminal 429 (every key exhausted) means quota is out — say so rather
        // than "try again".
        if (meta) meta.reason = (res.status === 429 || sawQuota) ? 'quota' : 'error'
        return null
      }

      const json = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
        promptFeedback?: { blockReason?: string }
      }

      if (json.promptFeedback?.blockReason) {
        console.error('[Gemini] blocked:', json.promptFeedback.blockReason)
        if (meta) meta.reason = 'blocked'
        return null
      }

      const text = json.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
      return text || null
    } catch (e) {
      // Network error (fetch failed) — retry on the next key, else give up.
      if (attempt < MAX_ATTEMPTS - 1) {
        const cycledAllKeys = attempt >= keys.length - 1
        const wait = keys.length > 1 && !cycledAllKeys ? 150 : Math.min(700 * 2 ** Math.max(0, attempt - keys.length + 1), 4000)
        console.warn(`[Gemini] request failed — retrying (${attempt + 1}/${MAX_ATTEMPTS - 1}):`, (e as Error)?.message)
        await sleep(wait)
        continue
      }
      console.error('[Gemini] request failed:', e)
      return null
    }
  }
  if (meta) meta.reason = sawQuota ? 'quota' : 'error'
  return null
}

// ─── Image generation (Gemini Flash Image / "Nano Banana") ────────────────────
export interface GeminiRefImage { data: string; mimeType: string }  // base64 data (no data: prefix)
export interface GeminiImageUsage { promptTokens: number; outputTokens: number; totalTokens: number; costUsd: number }
export type GeminiImageOutcome =
  | { ok: true; dataUrl: string; mimeType: string; usage: GeminiImageUsage }
  | { ok: false; reason: 'unconfigured' | 'quota' | 'blocked' | 'error'; detail?: string }

/**
 * Generate an image from a text prompt (optionally conditioned on reference
 * images, e.g. a real product photo to build mockups from). Returns a typed
 * outcome so the UI can tell "needs billing" (quota) apart from a plain failure.
 * Never throws.
 */
export async function geminiImage(prompt: string, refs?: GeminiRefImage[]): Promise<GeminiImageOutcome> {
  const keys = keyOrder()
  if (!keys.length) return { ok: false, reason: 'unconfigured' }
  // Queue behind the per-instance concurrency cap so a spike can't stampede the
  // provider (the acquire is cheap when there's a free slot).
  return imageLimiter.run(() => geminiImageInner(keys, prompt, refs))
}

async function geminiImageInner(keys: string[], prompt: string, refs?: GeminiRefImage[]): Promise<GeminiImageOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: prompt }]
  for (const r of refs ?? []) parts.push({ inlineData: { mimeType: r.mimeType, data: r.data } })

  // Retry transient failures: 5xx, network errors, and — importantly — the case
  // where the model replies with only TEXT and no image (common for the
  // feature-callout graphic). On 429 (rate-limited) we fail over to the next key;
  // safety blocks are NOT retried. At least 3 tries, and enough to visit every key.
  // Single key → 2 attempts (1 quick retry); the client retries, spaced, beyond that.
  const MAX = keys.length > 1 ? Math.max(4, keys.length + 1) : 2
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  const backoff = (attempt: number) => keys.length > 1 && attempt < keys.length - 1
    ? 150
    : Math.min(700 * 2 ** Math.max(0, attempt - keys.length + 1), 4000)
  let last: GeminiImageOutcome = { ok: false, reason: 'error', detail: 'unknown' }

  for (let attempt = 0; attempt < MAX; attempt++) {
    const key = keys[attempt % keys.length]
    try {
      const res = await fetch(
        `${BASE}/models/${IMAGE_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts }] }), cache: 'no-store' },
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error(`[Gemini image] ${res.status} on key #${(attempt % keys.length) + 1}/${keys.length}: ${body.slice(0, 200)}`)
        if (res.status === 429) {
          // This key is out — fail over to the next key; only give up (quota)
          // once every key has been tried.
          last = { ok: false, reason: 'quota', detail: 'Image-generation quota exhausted on all keys — enable billing or add another Gemini key.' }
          if (attempt < MAX - 1) { await sleep(keys.length > 1 ? 150 : 700 * (attempt + 1)); continue }
          return last
        }
        last = { ok: false, reason: 'error', detail: `${res.status}` }
        if (res.status >= 500 && attempt < MAX - 1) { await sleep(backoff(attempt)); continue }
        return last
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await res.json() as any
      if (j?.promptFeedback?.blockReason) return { ok: false, reason: 'blocked', detail: String(j.promptFeedback.blockReason) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rparts: any[] = j?.candidates?.[0]?.content?.parts ?? []
      const img = rparts.find(p => p?.inlineData?.data || p?.inline_data?.data)
      const data = img?.inlineData?.data || img?.inline_data?.data
      const mime = img?.inlineData?.mimeType || img?.inline_data?.mime_type || 'image/png'
      if (!data) {
        last = { ok: false, reason: 'error', detail: 'no image in response' }
        if (attempt < MAX - 1) { await sleep(500 * (attempt + 1)); continue }
        return last
      }
      // Cost & token accounting from the real usageMetadata this call returns.
      const um = j?.usageMetadata ?? {}
      const promptTokens = Number(um.promptTokenCount ?? 0)
      const outputTokens = Number(um.candidatesTokenCount ?? 0)
      const totalTokens = Number(um.totalTokenCount ?? (promptTokens + outputTokens))
      const costUsd = totalTokens > 0
        ? promptTokens * IMG_IN_USD_PER_MTOK / 1e6 + outputTokens * IMG_OUT_USD_PER_MTOK / 1e6
        : IMG_FALLBACK_USD
      recordImage(1, totalTokens, costUsd)   // attributed to the current user (withUsage)
      return { ok: true, dataUrl: `data:${mime};base64,${data}`, mimeType: mime, usage: { promptTokens, outputTokens, totalTokens, costUsd } }
    } catch (e) {
      console.error('[Gemini image] request failed:', e)
      last = { ok: false, reason: 'error', detail: e instanceof Error ? e.message : 'unknown' }
      if (attempt < MAX - 1) { await sleep(700 * (attempt + 1)); continue }
      return last
    }
  }
  return last
}

/**
 * Generate and parse a JSON object against a schema. Returns null (not a throw)
 * if the model is unconfigured, fails, or returns unparseable JSON — so every
 * caller keeps a clean fallback path.
 */
export async function geminiJSON<T>(opts: GenerateOpts & { schema: GeminiSchema }, meta?: GeminiMeta): Promise<T | null> {
  const raw = await geminiGenerate(opts, meta)
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
