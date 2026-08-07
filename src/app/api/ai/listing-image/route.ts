import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { geminiImage, isGeminiConfigured, type GeminiRefImage } from '@/lib/gemini'
import { withUsage } from '@/lib/track'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// Output cap: 720p (max 720px on the short side) — never 2K/4K. Keeps files small
// and generation cheap. Gemini has no resolution param, so we resize the result.
const OUTPUT_MAX_PX = 720

async function to720p(dataUrl: string): Promise<string> {
  try {
    const b64 = dataUrl.split(',')[1]
    if (!b64) return dataUrl
    const buf = Buffer.from(b64, 'base64')
    const out = await sharp(buf)
      .resize({ height: OUTPUT_MAX_PX, withoutEnlargement: true }) // cap at 720p, never upscale
      .png()
      .toBuffer()
    return `data:image/png;base64,${out.toString('base64')}`
  } catch {
    return dataUrl // fall back to the original if resize fails
  }
}

// Turn a focus keyword into a short, punchy uppercase headline (≤ 2 lines).
function headlineFrom(product: string): string {
  const words = product.trim().split(/\s+/).slice(0, 4)
  const mid = Math.ceil(words.length / 2)
  return words.length > 2 ? `${words.slice(0, mid).join(' ')}\\n${words.slice(mid).join(' ')}`.toUpperCase() : words.join(' ').toUpperCase()
}

/**
 * Etsy Listing Pro — image generation (Gemini Flash Image).
 *
 * Four image TYPES, each with a prompt template that encodes how Etsy product
 * photography actually looks — hero shots on clean surfaces, aspirational
 * lifestyle mockups, minimalist feature-callout graphics, and an all-in-one
 * collage. Optionally conditions on a real product photo the seller uploads, so
 * mockups are built from THEIR product rather than an invented one.
 *
 * Returns a typed failure so the client can say "enable Gemini billing" on a
 * quota (429) rather than a generic error.
 */
export type ImageType = 'main' | 'mockup' | 'feature' | 'combo'

const COMMON = 'Photorealistic, professional Etsy marketplace product photography, 1:1 square, high resolution, tack-sharp focus, no watermark, no brand logos, no gibberish text.'

function buildPrompt(type: ImageType, product: string, visual: string, features: string[], hasRef: boolean): string {
  const subject = `${product}${visual ? ` — ${visual}` : ''}`
  const feats = features.filter(Boolean).slice(0, 4)
  const refNote = hasRef ? 'Use the attached photo as the exact product; keep its shape, colour and details faithful. ' : ''
  switch (type) {
    case 'main': {
      // Premium Etsy HERO listing image — a Pinterest-worthy bestseller thumbnail
      // with a bold product headline, subtitle and up to 4 feature badges baked in.
      const headline = headlineFrom(product)
      const subtitle = (visual || product).trim().slice(0, 48)
      const badgeLine = feats.length
        ? `Add up to ${Math.min(feats.length, 4)} small rounded feature badges, each reading exactly one of: ${feats.join(', ')}. `
        : ''
      return `${refNote}Create a PREMIUM Etsy HERO listing image for "${product}" — a top-seller, Pinterest-worthy, luxury e-commerce aesthetic that immediately reads at Etsy thumbnail size.\n` +
        `COMPOSITION: 4:3 aspect ratio on a bright clean neutral background (#F8F6F2, or a tasteful complementary tone if it suits the product). The product (${subject}), shown with a realistic professional mockup appropriate to it, dominates about 65–75% of the frame. Bright natural daylight, soft realistic shadows, elegant visual hierarchy, generous negative space, clean and uncluttered.\n` +
        `TEXT (must be perfectly legible and correctly spelled — every letter a real word, NO gibberish): a large bold modern sans-serif HEADLINE reading "${headline}", and a short professional SUBTITLE reading "${subtitle}". Strong hierarchy, premium typography, high readability.\n` +
        `${badgeLine}` +
        `Do NOT show any price. Ultra-detailed, sharp, commercial advertising quality, premium Etsy bestseller appearance. No watermark, no brand logos.`
    }
    case 'mockup':
      return `${refNote}An aspirational lifestyle mockup of ${subject}, shown in a real-world context (in use, worn, or styled in a cozy home/desk scene) with natural window light, warm tones, tasteful props, shallow depth of field — the kind of lifestyle shot that makes Etsy shoppers imagine owning it. ${COMMON}`
    case 'feature':
      return `${refNote}A minimalist Etsy feature-callout graphic for ${subject}. The product sits centered on a soft solid pastel background with 3–4 short, tidy callout labels connected by thin lines, each naming one selling point${feats.length ? ` such as: ${feats.join(', ')}` : ''}. Modern clean sans-serif labels, generous whitespace, perfectly legible, no clutter. ${COMMON}`
    case 'combo':
      return `${refNote}An all-in-one Etsy listing image for ${subject}: a neat, balanced collage combining a large main shot of the product with 2–3 smaller detail/angle shots and a couple of small feature icons with very short text highlights${feats.length ? ` (${feats.slice(0, 3).join(', ')})` : ''}. Cohesive brand palette, grid layout, clean and premium. ${COMMON}`
  }
}

export const POST = withUsage(postHandler)

async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<{ dataUrl: string; costUsd?: number; tokens?: number }>>> {
  const body = await req.json().catch(() => ({})) as {
    type?: string; product?: string; visual?: string; features?: string[]
    refImage?: { data?: string; mimeType?: string }
  }
  const type = (['main', 'mockup', 'feature', 'combo'] as const).includes(body.type as ImageType) ? body.type as ImageType : 'main'
  const product = String(body.product ?? '').trim()
  if (product.length < 2) {
    return NextResponse.json({ success: false, error: 'Missing product.' }, { status: 400 })
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json({ success: false, error: 'AI images are not configured (set the Gemini API key).' }, { status: 503 })
  }

  const refs: GeminiRefImage[] = []
  if (body.refImage?.data && body.refImage.mimeType) {
    refs.push({ data: body.refImage.data.replace(/^data:[^,]+,/, ''), mimeType: body.refImage.mimeType })
  }

  const prompt = buildPrompt(type, product, String(body.visual ?? ''), Array.isArray(body.features) ? body.features.map(String) : [], refs.length > 0)
  const out = await geminiImage(prompt, refs)

  if (out.ok) {
    const dataUrl = await to720p(out.dataUrl) // cap at 720p, never 2K/4K
    return NextResponse.json({ success: true, data: { dataUrl, costUsd: out.usage.costUsd, tokens: out.usage.totalTokens } })
  }

  // Map the typed failure to an honest, actionable message.
  const msg = out.reason === 'quota'
    ? 'Image quota exhausted — enable billing on the Gemini API key to generate images.'
    : out.reason === 'unconfigured' ? 'Gemini API key is not set.'
    : out.reason === 'blocked' ? 'The image request was blocked by the safety filter — try rephrasing the product.'
    : 'Image generation failed. Please try again.'
  return NextResponse.json({ success: false, error: msg }, { status: out.reason === 'quota' ? 429 : 502 })
}
