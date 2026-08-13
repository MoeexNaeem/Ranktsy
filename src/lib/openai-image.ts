/**
 * OpenAI image generation — used ONLY for the Etsy Listing Pro hero image.
 *
 * Everything else in the app stays on Gemini (text AND other images). This module
 * is deliberately scoped: a single `openaiImage()` that mirrors `geminiImage`'s
 * outcome shape so the listing-image route swaps provider with minimal change, and
 * records cost the same way (`recordImage`) so admin usage still adds up.
 *
 * Model: `gpt-image-1` (best in-image typography — the hero image is mostly text:
 * headline, subtitle and feature badges). Override with OPENAI_IMAGE_MODEL. Note
 * gpt-image-1 needs a *verified* OpenAI org; if the account isn't verified, set
 * OPENAI_IMAGE_MODEL=dall-e-3 (weaker text, no verification needed).
 */
import { recordImage } from '@/lib/usage'
import { createLimiter } from '@/lib/concurrency'

const OPENAI_KEY = () => (process.env.OPENAI_API_KEY ?? '').trim()
export function isOpenAIConfigured(): boolean {
  return OPENAI_KEY().length > 0
}

const MODEL   = (process.env.OPENAI_IMAGE_MODEL   ?? 'gpt-image-1').trim()
// 4:3 isn't offered; 1536x1024 (landscape) is the closest gpt-image-1 supports.
const SIZE    = (process.env.OPENAI_IMAGE_SIZE    ?? '1536x1024').trim()
const QUALITY = (process.env.OPENAI_IMAGE_QUALITY ?? 'medium').trim()

// Rough per-image cost for the admin usage dashboard (OpenAI bills image OUTPUT
// tokens; gpt-image-1 returns token counts we prefer, this is only the fallback).
// gpt-image-1: ~$0.02 low / ~$0.07 medium / ~$0.19 high at 1536x1024. Env-tunable.
const COST_FALLBACK_USD = Number(process.env.OPENAI_IMAGE_COST_USD ?? (QUALITY === 'low' ? 0.02 : QUALITY === 'medium' ? 0.07 : 0.19))
// gpt-image-1 output-image token price ≈ $40 / 1M tokens; input text ≈ $5 / 1M.
const IMG_OUT_USD_PER_MTOK = Number(process.env.OPENAI_IMAGE_OUTPUT_USD_PER_MTOK ?? 40)
const IMG_IN_USD_PER_MTOK  = Number(process.env.OPENAI_IMAGE_INPUT_USD_PER_MTOK  ?? 5)

export interface OpenAIRefImage { data: string; mimeType: string }  // base64 (no data: prefix)
export interface OpenAIImageUsage { promptTokens: number; outputTokens: number; totalTokens: number; costUsd: number }
export type OpenAIImageOutcome =
  | { ok: true; dataUrl: string; mimeType: string; usage: OpenAIImageUsage }
  | { ok: false; reason: 'unconfigured' | 'quota' | 'blocked' | 'error'; detail?: string }

// Same per-instance cap style as Gemini images so a burst can't stampede OpenAI.
const limiter = createLimiter(Number(process.env.OPENAI_IMAGE_CONCURRENCY ?? 3))

/**
 * Generate one image from a text prompt (optionally conditioned on a reference
 * photo via the edits endpoint). Never throws — returns a typed outcome so the
 * caller can show an honest, actionable message (quota / blocked / error).
 */
export async function openaiImage(prompt: string, refs?: OpenAIRefImage[]): Promise<OpenAIImageOutcome> {
  const key = OPENAI_KEY()
  if (!key) return { ok: false, reason: 'unconfigured' }
  // Queue behind the per-instance concurrency cap so a spike can't stampede OpenAI.
  return limiter.run(() => openaiImageInner(key, prompt, refs))
}

async function openaiImageInner(key: string, prompt: string, refs?: OpenAIRefImage[]): Promise<OpenAIImageOutcome> {
  const MAX = 3
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
  let last: OpenAIImageOutcome = { ok: false, reason: 'error', detail: 'unknown' }

  for (let attempt = 0; attempt < MAX; attempt++) {
    try {
      const res = refs && refs.length > 0
        ? await callEdits(key, prompt, refs)
        : await callGenerations(key, prompt)

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error(`[OpenAI image] ${res.status}: ${body.slice(0, 300)}`)
        if (res.status === 429) return { ok: false, reason: 'quota', detail: 'OpenAI image quota / rate limit hit — check billing on the OpenAI key.' }
        // Content policy / safety: don't retry, surface it.
        if (res.status === 400 && /content_policy|safety|moderation/i.test(body)) return { ok: false, reason: 'blocked', detail: 'blocked by OpenAI safety filter' }
        last = { ok: false, reason: 'error', detail: `${res.status}` }
        if (res.status >= 500 && attempt < MAX - 1) { await sleep(700 * (attempt + 1)); continue }
        return last
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const j = await res.json() as any
      const b64: string | undefined = j?.data?.[0]?.b64_json
      if (!b64) {
        last = { ok: false, reason: 'error', detail: 'no image in response' }
        if (attempt < MAX - 1) { await sleep(500 * (attempt + 1)); continue }
        return last
      }

      // Cost from the real usage the API returns; fallback to the flat estimate.
      const u = j?.usage ?? {}
      const promptTokens = Number(u.input_tokens ?? 0)
      const outputTokens = Number(u.output_tokens ?? 0)
      const totalTokens  = Number(u.total_tokens ?? (promptTokens + outputTokens))
      const costUsd = totalTokens > 0
        ? promptTokens * IMG_IN_USD_PER_MTOK / 1e6 + outputTokens * IMG_OUT_USD_PER_MTOK / 1e6
        : COST_FALLBACK_USD
      recordImage(1, totalTokens, costUsd)   // attributed to the current user (withUsage)
      return { ok: true, dataUrl: `data:image/png;base64,${b64}`, mimeType: 'image/png', usage: { promptTokens, outputTokens, totalTokens, costUsd } }
    } catch (e) {
      console.error('[OpenAI image] request failed:', e)
      last = { ok: false, reason: 'error', detail: e instanceof Error ? e.message : 'unknown' }
      if (attempt < MAX - 1) { await sleep(700 * (attempt + 1)); continue }
      return last
    }
  }
  return last
}

// Text → image. gpt-image-1 always returns b64_json (and rejects response_format);
// dall-e-3 needs response_format:'b64_json' to avoid a URL we'd have to re-fetch.
function callGenerations(key: string, prompt: string): Promise<Response> {
  const isGptImage = MODEL.startsWith('gpt-image')
  const body: Record<string, unknown> = { model: MODEL, prompt, size: SIZE, n: 1 }
  if (isGptImage) body.quality = QUALITY
  else { body.quality = QUALITY === 'high' ? 'hd' : 'standard'; body.response_format = 'b64_json' }
  return fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
}

// Reference-photo conditioning (the seller's "use my product" upload) via the
// multipart edits endpoint. gpt-image-1 supports edits; dall-e-3 does not, so a
// ref photo is ignored there (caller still gets a from-scratch image).
async function callEdits(key: string, prompt: string, refs: OpenAIRefImage[]): Promise<Response> {
  if (!MODEL.startsWith('gpt-image')) return callGenerations(key, prompt)
  const form = new FormData()
  form.append('model', MODEL)
  form.append('prompt', prompt)
  form.append('size', SIZE)
  form.append('quality', QUALITY)
  form.append('n', '1')
  refs.slice(0, 4).forEach((r, i) => {
    const bytes = Buffer.from(r.data, 'base64')
    // Buffer → Blob (Node 18+ global). Field name `image[]` for multi-image edits.
    const blob = new Blob([bytes], { type: r.mimeType || 'image/png' })
    form.append('image[]', blob, `ref-${i}.png`)
  })
  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}` }, // let fetch set the multipart boundary
    body: form,
    cache: 'no-store',
  })
}
