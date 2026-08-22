import { NextRequest, NextResponse } from 'next/server'
import { openaiImage, isOpenAIConfigured, type OpenAIRefImage } from '@/lib/openai-image'
import { getCurrentUser } from '@/lib/auth/session'
import { connectDB } from '@/lib/db'
import { consumeMonthlyImage, refundMonthlyImage } from '@/lib/quota'
import { withApiGuard } from '@/lib/api-guard'
import { AI_BUSY, AI_IMAGE_UNAVAILABLE, AI_FAILED } from '@/lib/ai/messages'
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
 * Etsy Listing Pro - image generation.
 *
 * This is the ONE place in the app that uses OpenAI (gpt-image-1) instead of
 * Gemini: the Etsy Listing Pro hero image is almost entirely typography (headline,
 * subtitle, feature badges), and gpt-image-1 renders in-image text far more
 * cleanly. Everything else (all text AI, and any other image) stays on Gemini.
 *
 * The `main` prompt is the seller's exact hero-image brief with the Focus Keyword
 * injected (dynamic headline/subtitle/badges/mockup). Optionally conditions on a
 * real product photo the seller uploads (OpenAI edits endpoint).
 *
 * Returns a typed failure so the client can say "check OpenAI billing" on a quota
 * (429) rather than a generic error.
 */
export type ImageType = 'main' | 'mockup' | 'feature' | 'combo'

const COMMON = 'Photorealistic, professional Etsy marketplace product photography, 1:1 square, high resolution, tack-sharp focus, no watermark, no brand logos, no gibberish text.'

function buildPrompt(type: ImageType, product: string, visual: string, features: string[], hasRef: boolean): string {
  const subject = `${product}${visual ? ` - ${visual}` : ''}`
  const feats = features.filter(Boolean).slice(0, 4)
  const refNote = hasRef ? 'Use the attached photo as the exact product; keep its shape, colour and details faithful. ' : ''
  switch (type) {
    case 'main': {
      // Premium Etsy HERO listing image, locked to a fixed EDITORIAL TEMPLATE (the
      // seller's reference: left serif headline column + vertical pill badges, right
      // product mockups, botanical accent, cream background). Only the CONTENT is
      // dynamic - headline/subtitle/badges/mockups come from the Focus Keyword.
      const { line1, line2 } = headlineLines(product)
      const headlineSpec = line2
        ? `stacked on two lines - line 1 "${line1}", line 2 "${line2}"`
        : `on one line reading "${line1}"`
      const badges = feats.slice(0, 4)
      const badgeList = (badges.length ? badges : ['Instant Download', 'Editable', 'Printable', 'High Resolution'])
        .slice(0, 4).map(b => b.toUpperCase())
      return `${refNote}Create the final Etsy hero listing image for the Focus Keyword "${product}". ` +
        `Silently infer the product type (digital or physical), buyer intent and the best mockups, then generate ONLY the final image - no prompt, analysis, notes, markdown or extra text.\n\n` +
        `FIXED TEMPLATE LAYOUT - a clean editorial "premium digital product" listing graphic on a bright warm off-white background (#F8F6F2), composed in two zones:\n` +
        `• LEFT COLUMN (~38% width, generous margins): a small widely-letter-spaced uppercase overline in a fitting single real word (e.g. PROFESSIONAL, PREMIUM, MODERN) OR omit it; then a very large, bold, high-contrast elegant SERIF display headline in near-black (think Didot / Playfair), UPPERCASE, ${headlineSpec}; directly below, an elegant handwritten SCRIPT subtitle naming the product type in title case, 2–4 words (e.g. a Canva template → "Editable Canva Template"; a printable → "Printable Wall Art"; a PDF sewing/crochet pattern → "Digital PDF Pattern"; a greeting card → "Printable Greeting Card"); a thin decorative divider line; then a VERTICAL STACK of EXACTLY 4 rounded pill-shaped feature badges - soft warm-beige rounded rectangles, each with a small circular line-icon on the left and a clean uppercase label, subtle soft shadow, reading exactly (top to bottom): "${badgeList.join('", "')}".\n` +
        `• RIGHT AREA (~62% width): realistic, professionally styled product mockups that best fit this product type, overlapping with real depth and soft shadows on the cream surface (resume/CV or document template → an open laptop + a tablet + a phone all showing the design, plus 1–2 crisp printed pages; greeting/wedding card → several premium cards + envelopes; crochet/knitting pattern → the finished piece + printed pattern pages; SVG bundle → SVG preview sheets + Cricut/vinyl; planner → planner pages + stationery; wall art → framed prints in a tasteful interior; sticker bundle → sticker sheets; coloring pages → open coloring book; Canva template → a desktop screen showing the editable template). The product (${subject}) is the hero and fills most of this zone.\n` +
        `ACCENTS - a small, tasteful eucalyptus/greenery sprig in the top-right corner; optionally one small round kraft-beige circular badge in a lower corner (e.g. "2 PAGE") ONLY if it genuinely applies, else omit. Generous white space, balanced composition, optimized for an Etsy thumbnail. Keep the ENTIRE composition - including all 4 feature badges - fully inside the frame with even margins; nothing cropped or cut off at any edge.\n\n` +
        `TEXT - THIS IS CRITICAL: every piece of on-image text (headline, subtitle, all 4 badge labels) must be REAL, correctly-spelled English, rendered crisp, sharp and perfectly legible even at small thumbnail size. Spell each word EXACTLY as given above. Absolutely NO gibberish, NO random or repeated letters, NO melted/warped/blurry type, NO nonsense words. Kern and align the type cleanly like a professional graphic designer.\n\n` +
        `STYLE & QUALITY - premium Etsy bestseller aesthetic, luxury stationery branding, Pinterest-worthy, modern minimalist, elegant, bright natural daylight with soft realistic shadows, studio-quality commercial photography, ultra realistic, extremely detailed, 4K, sharp typography. Do NOT show any price, watermark or brand logos.`
    }
    case 'mockup':
      return `${refNote}An aspirational lifestyle mockup of ${subject}, shown in a real-world context (in use, worn, or styled in a cozy home/desk scene) with natural window light, warm tones, tasteful props, shallow depth of field - the kind of lifestyle shot that makes Etsy shoppers imagine owning it. ${COMMON}`
    case 'feature':
      return `${refNote}A minimalist Etsy feature-callout graphic for ${subject}. The product sits centered on a soft solid pastel background with 3–4 short, tidy callout labels connected by thin lines, each naming one selling point${feats.length ? ` such as: ${feats.join(', ')}` : ''}. Modern clean sans-serif labels, generous whitespace, perfectly legible, no clutter. ${COMMON}`
    case 'combo':
      return `${refNote}An all-in-one Etsy listing image for ${subject}: a neat, balanced collage combining a large main shot of the product with 2–3 smaller detail/angle shots and a couple of small feature icons with very short text highlights${feats.length ? ` (${feats.slice(0, 3).join(', ')})` : ''}. Cohesive brand palette, grid layout, clean and premium. ${COMMON}`
  }
}

export const POST = withApiGuard(postHandler, { limit: 10, windowMs: 60_000 })

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
  if (!isOpenAIConfigured()) {
    return NextResponse.json({ success: false, error: AI_IMAGE_UNAVAILABLE }, { status: 503 })
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

  const refs: OpenAIRefImage[] = []
  if (body.refImage?.data && body.refImage.mimeType) {
    // Bound the inbound reference photo: reject anything that isn't an image
    // mime, or whose base64 payload exceeds ~12MB (~9MB decoded) - so a client
    // can't push a huge/booby-trapped blob straight through to the image API.
    const okMime = /^image\/(png|jpe?g|webp|gif)$/i.test(body.refImage.mimeType)
    const b64 = body.refImage.data.replace(/^data:[^,]+,/, '')
    if (okMime && b64.length <= 12_000_000) {
      refs.push({ data: b64, mimeType: body.refImage.mimeType })
    }
  }

  const prompt = buildPrompt(type, product, String(body.visual ?? ''), Array.isArray(body.features) ? body.features.map(String) : [], refs.length > 0)
  const out = await openaiImage(prompt, refs)

  if (out.ok) {
    // Return the full-resolution image as generated (one complete hero image).
    return NextResponse.json({ success: true, data: { dataUrl: out.dataUrl, costUsd: out.usage.costUsd, tokens: out.usage.totalTokens } })
  }

  // Generation failed - give the consumed monthly image credit back.
  if (authUser) await refundMonthlyImage(authUser.id)

  // Map the typed failure to a neutral, provider-agnostic message.
  const msg = out.reason === 'quota'
    ? AI_BUSY
    : out.reason === 'unconfigured' ? AI_IMAGE_UNAVAILABLE
    : out.reason === 'blocked' ? 'The image request was blocked by the safety filter - try rephrasing the product.'
    : AI_FAILED
  return NextResponse.json({ success: false, error: msg }, { status: out.reason === 'quota' ? 429 : 502 })
}
