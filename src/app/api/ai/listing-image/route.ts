import { NextRequest, NextResponse } from 'next/server'
import { geminiImage, isGeminiConfigured, type GeminiRefImage } from '@/lib/gemini'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

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
    case 'main':
      return `${refNote}A clean hero product photo of ${subject}. The product is centered and fills most of the frame on a soft neutral background (white seamless or pale marble), gentle studio lighting with soft shadows, styled the way best-selling Etsy listings shoot their main image. ${COMMON}`
    case 'mockup':
      return `${refNote}An aspirational lifestyle mockup of ${subject}, shown in a real-world context (in use, worn, or styled in a cozy home/desk scene) with natural window light, warm tones, tasteful props, shallow depth of field — the kind of lifestyle shot that makes Etsy shoppers imagine owning it. ${COMMON}`
    case 'feature':
      return `${refNote}A minimalist Etsy feature-callout graphic for ${subject}. The product sits centered on a soft solid pastel background with 3–4 short, tidy callout labels connected by thin lines, each naming one selling point${feats.length ? ` such as: ${feats.join(', ')}` : ''}. Modern clean sans-serif labels, generous whitespace, perfectly legible, no clutter. ${COMMON}`
    case 'combo':
      return `${refNote}An all-in-one Etsy listing image for ${subject}: a neat, balanced collage combining a large main shot of the product with 2–3 smaller detail/angle shots and a couple of small feature icons with very short text highlights${feats.length ? ` (${feats.slice(0, 3).join(', ')})` : ''}. Cohesive brand palette, grid layout, clean and premium. ${COMMON}`
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ dataUrl: string }>>> {
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

  if (out.ok) return NextResponse.json({ success: true, data: { dataUrl: out.dataUrl } })

  // Map the typed failure to an honest, actionable message.
  const msg = out.reason === 'quota'
    ? 'Image quota exhausted — enable billing on the Gemini API key to generate images.'
    : out.reason === 'unconfigured' ? 'Gemini API key is not set.'
    : out.reason === 'blocked' ? 'The image request was blocked by the safety filter — try rephrasing the product.'
    : 'Image generation failed. Please try again.'
  return NextResponse.json({ success: false, error: msg }, { status: out.reason === 'quota' ? 429 : 502 })
}
