import { NextRequest, NextResponse } from 'next/server'
import { geminiImage, isGeminiConfigured, type GeminiRefImage } from '@/lib/gemini'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { consumeMonthlyImage, refundMonthlyImage } from '@/lib/quota'
import { withUsage } from '@/lib/track'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// Split a focus keyword into the two headline lines the sample calls for:
// the FIRST word on line 1, the rest on line 2 (Birthday Card → BIRTHDAY / CARD,
// Resume Template → RESUME / TEMPLATE, Crochet Pumpkin Pattern → CROCHET /
// PUMPKIN PATTERN). A single-word keyword stays on one line.
function headlineLines(product: string): { line1: string; line2: string } {
  const words = product.trim().split(/\s+/).slice(0, 4)
  if (words.length <= 1) return { line1: (words[0] ?? '').toUpperCase(), line2: '' }
  return { line1: words[0].toUpperCase(), line2: words.slice(1).join(' ').toUpperCase() }
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
      // Premium Etsy HERO listing image — a Pinterest-worthy bestseller thumbnail.
      // Mirrors the seller's reference brief: headline is the exact Focus Keyword
      // on two lines; the subtitle is AUTO-generated (a clean product-type line
      // like "Editable Canva Template" / "Digital PDF Pattern"), NOT forced to
      // the photographer's visual description (which read as cut-off text).
      const { line1, line2 } = headlineLines(product)
      const headlineSpec = line2
        ? `two lines — line 1 "${line1}", line 2 "${line2}"`
        : `one line reading "${line1}"`
      const badges = feats.slice(0, 4)
      const badgeLine = badges.length
        ? `FEATURE BADGES: exactly ${badges.length} rounded feature badges, each reading one of: ${badges.join(', ')} — only genuinely applicable ones, with thin modern borders and a soft realistic shadow.\n`
        : `FEATURE BADGES: automatically generate up to FOUR rounded badges that genuinely apply to this product (e.g. Instant Download, Editable, Printable, Canva Compatible, SVG Included, Commercial Use, PDF Included, High Resolution) — only relevant ones.\n`
      return `${refNote}First, silently analyze the Focus Keyword "${product}" to determine its product type, whether it's digital or physical, buyer intent, the best visual presentation, appropriate lifestyle props, suitable typography, feature badges and product variations. Then generate ONLY the final Etsy hero listing image — do NOT output a prompt, analysis, notes, markdown or any text, just the image.\n` +
        `DYNAMIC CONTENT: automatically set all on-image text from the Focus Keyword. A large bold uppercase HEADLINE on ${headlineSpec}. Below it, a short professional SUBTITLE that names the product type in title case (for example: a Canva template → "Editable Canva Template"; a printable → "Printable Wall Art"; a PDF sewing/crochet pattern → "Digital PDF Pattern"; a greeting card → "Printable Greeting Card"). Keep the subtitle to 2–4 words, never a full sentence.\n` +
        `PRODUCT MOCKUPS: automatically create the realistic mockup that best fits this product type (greeting card → multiple premium cards; resume/template → laptop + resume pages + tablet + phone; crochet/knitting pattern → the finished piece + pattern pages; SVG bundle → SVG preview sheets + Cricut materials; planner → planner pages + stationery; wedding invitation → invitation suite + envelopes; wall art → framed artwork in a modern interior; sticker bundle → sticker sheets; coloring pages → open coloring book pages; Canva template → a desktop screen showing the editable template). Show multiple product variations with realistic overlapping depth. The product (${subject}) is the hero.\n` +
        `STYLE: premium Etsy bestseller aesthetic, luxury branding, Pinterest-worthy, bright neutral background (#F8F6F2), modern minimalist design, elegant composition, studio-quality commercial photography, high-end digital-product branding.\n` +
        `LAYOUT: 4:3 aspect ratio (compose as if for 3000×2250px). The product occupies roughly 70% of the canvas, multiple variations where appropriate, overlapping products for realistic depth, generous white space, balanced composition, optimized for Etsy thumbnails.\n` +
        `TYPOGRAPHY: large bold modern sans-serif headline, appropriate professional subtitle, modern luxury type — every letter a real, correctly spelled word, perfectly legible, NO gibberish.\n` +
        badgeLine +
        `DESIGN ELEMENTS: rounded feature badges, thin modern borders, soft realistic shadows, luxury stationery styling, premium e-commerce branding, clean visual hierarchy.\n` +
        `LIGHTING: bright natural daylight, soft realistic shadows, studio-quality lighting.\n` +
        `QUALITY: ultra realistic, 4K, extremely detailed, sharp typography, commercial advertising quality, premium Etsy bestseller appearance, Pinterest-viral aesthetic. Do NOT show any price, watermark or brand logos.`
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

  // Per-plan MONTHLY image allowance. Consume before generating; refunded below
  // if the generation fails, so a failed attempt never costs a credit.
  const authUser = await getCurrentUser().catch(() => null)
  if (authUser) {
    await connectDB()
    const q = await consumeMonthlyImage(authUser.id)
    if (q && !q.allowed) {
      const msg = q.limit === 0
        ? `Etsy Listing Pro images aren't included in the ${q.plan} plan. Upgrade to generate listing images.`
        : `You've used all ${q.limit} Etsy Listing Pro images this month on the ${q.plan} plan. Upgrade for more.`
      return NextResponse.json({ success: false, code: 'plan_limit', metric: 'images', plan: q.plan, limit: q.limit, error: msg }, { status: 402 })
    }
  }

  const refs: GeminiRefImage[] = []
  if (body.refImage?.data && body.refImage.mimeType) {
    refs.push({ data: body.refImage.data.replace(/^data:[^,]+,/, ''), mimeType: body.refImage.mimeType })
  }

  const prompt = buildPrompt(type, product, String(body.visual ?? ''), Array.isArray(body.features) ? body.features.map(String) : [], refs.length > 0)
  const out = await geminiImage(prompt, refs)

  if (out.ok) {
    // Return the full-resolution image as generated (one complete hero image).
    return NextResponse.json({ success: true, data: { dataUrl: out.dataUrl, costUsd: out.usage.costUsd, tokens: out.usage.totalTokens } })
  }

  // Generation failed — give the consumed monthly image credit back.
  if (authUser) await refundMonthlyImage(authUser.id)

  // Map the typed failure to an honest, actionable message.
  const msg = out.reason === 'quota'
    ? 'Image quota exhausted — enable billing on the Gemini API key to generate images.'
    : out.reason === 'unconfigured' ? 'Gemini API key is not set.'
    : out.reason === 'blocked' ? 'The image request was blocked by the safety filter — try rephrasing the product.'
    : 'Image generation failed. Please try again.'
  return NextResponse.json({ success: false, error: msg }, { status: out.reason === 'quota' ? 429 : 502 })
}
