/**
 * "Automate Etsy Shop" run settings: one section per node in the builder, each
 * mapping to a part of Etsy's own "Add a listing" form (Category, Title,
 * Description, Tags & Materials, Attributes, Price & Inventory, Details / How
 * it's made, Delivery, Publish). The client sends a loose object; the server
 * normalizes it here so a run only ever stores clean, bounded values.
 */

export type ListingKind = 'physical' | 'download'

export interface AutomationConfig {
  category:    { mode: 'auto' | 'fixed'; taxonomyId: number | null; taxonomyPath: string | null }
  title:       { style: 'keyword-first' | 'benefit-first'; maxLength: number; mustInclude: string }
  description: { length: 'concise' | 'standard' | 'detailed'; tone: 'friendly' | 'professional' | 'luxury' | 'playful'; footer: string }
  tags:        { focus: 'long-tail' | 'broad' | 'mixed'; always: string[]; materials: boolean; styles: boolean }
  /** `fixed`: propertyId → valueIds the seller pinned (only meaningful with a fixed category). */
  attributes:  { mode: 'auto' | 'off'; fixed: Record<string, number[]> }
  price: {
    strategy: 'median' | 'undercut' | 'premium' | 'fixed'
    fixed: number | null
    min: number | null
    max: number | null
    charm: boolean
    quantity: number
    /** SKU pattern, e.g. "RK-{KW}-{N}". Empty → no SKU. */
    sku: string
  }
  details: {
    type: ListingKind
    whoMade: 'i_did' | 'someone_else' | 'collective'
    isSupply: boolean
    whenMade: 'made_to_order' | 'recent'
    personalization: 'off' | 'optional' | 'required'
    personalizationInstructions: string
    personalizationMax: number
    autoRenew: boolean
  }
  delivery: {
    shippingProfileId: number | null
    readinessStateId: number | null
    returnPolicyId: number | null
    shopSectionId: number | null
    weight: number | null
    weightUnit: 'oz' | 'lb' | 'g' | 'kg'
    length: number | null
    width: number | null
    height: number | null
    dimUnit: 'in' | 'cm' | 'mm'
  }
  publish: { enabled: boolean; shopId: string | null; uploadPhotos: boolean; uploadFiles: boolean }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const obj = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {})
const pick = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (allowed as readonly string[]).includes(String(v)) ? v as T : dflt
const num = (v: unknown, min: number, max: number): number | null => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}
const id = (v: unknown): number | null => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null }
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export function normalizeConfig(raw: unknown): AutomationConfig {
  const r = obj(raw)
  const c = obj(r.category), t = obj(r.title), d = obj(r.description), g = obj(r.tags)
  const a = obj(r.attributes), p = obj(r.price), x = obj(r.details), dv = obj(r.delivery), pb = obj(r.publish)

  const fixedAttrs: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(obj(a.fixed))) {
    const ids = (Array.isArray(v) ? v : [v]).map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 10)
    if (id(k) && ids.length) fixedAttrs[String(id(k))] = ids
  }

  const always = (Array.isArray(g.always) ? g.always : String(g.always ?? '').split(','))
    .map((s: unknown) => cleanTag(String(s))).filter(Boolean).slice(0, 13)

  const taxonomyId = id(c.taxonomyId)
  return {
    category: { mode: c.mode === 'fixed' && taxonomyId ? 'fixed' : 'auto', taxonomyId, taxonomyPath: c.taxonomyPath ? str(c.taxonomyPath, 300) : null },
    title: { style: pick(t.style, ['keyword-first', 'benefit-first'] as const, 'keyword-first'), maxLength: num(t.maxLength, 40, 140) ?? 140, mustInclude: str(t.mustInclude, 60) },
    description: {
      length: pick(d.length, ['concise', 'standard', 'detailed'] as const, 'standard'),
      tone: pick(d.tone, ['friendly', 'professional', 'luxury', 'playful'] as const, 'friendly'),
      footer: str(d.footer, 2000),
    },
    tags: { focus: pick(g.focus, ['long-tail', 'broad', 'mixed'] as const, 'long-tail'), always: [...new Set(always)], materials: g.materials !== false, styles: g.styles !== false },
    attributes: { mode: a.mode === 'off' ? 'off' : 'auto', fixed: fixedAttrs },
    price: {
      strategy: pick(p.strategy, ['median', 'undercut', 'premium', 'fixed'] as const, 'median'),
      fixed: num(p.fixed, 0.2, 50000),
      min: num(p.min, 0.2, 50000),
      max: num(p.max, 0.2, 50000),
      charm: p.charm !== false,
      quantity: Math.floor(num(p.quantity, 1, 999) ?? 1),
      sku: str(p.sku, 40).replace(/[^A-Za-z0-9{}_\-.]/g, ''),
    },
    details: {
      type: x.type === 'download' ? 'download' : 'physical',
      whoMade: pick(x.whoMade, ['i_did', 'someone_else', 'collective'] as const, 'i_did'),
      isSupply: x.isSupply === true || x.isSupply === 'true',
      whenMade: x.whenMade === 'recent' ? 'recent' : 'made_to_order',
      personalization: pick(x.personalization, ['off', 'optional', 'required'] as const, 'off'),
      personalizationInstructions: str(x.personalizationInstructions, 256),
      personalizationMax: Math.floor(num(x.personalizationMax, 1, 1024) ?? 256),
      autoRenew: x.autoRenew !== false,
    },
    delivery: {
      shippingProfileId: id(dv.shippingProfileId),
      readinessStateId: id(dv.readinessStateId),
      returnPolicyId: id(dv.returnPolicyId),
      shopSectionId: id(dv.shopSectionId),
      weight: num(dv.weight, 0.01, 10000),
      weightUnit: pick(dv.weightUnit, ['oz', 'lb', 'g', 'kg'] as const, 'oz'),
      length: num(dv.length, 0.01, 10000),
      width: num(dv.width, 0.01, 10000),
      height: num(dv.height, 0.01, 10000),
      dimUnit: pick(dv.dimUnit, ['in', 'cm', 'mm'] as const, 'in'),
    },
    publish: {
      enabled: pb.enabled === true,
      shopId: pb.shopId ? str(pb.shopId, 40) : null,
      uploadPhotos: pb.uploadPhotos !== false,
      uploadFiles: pb.uploadFiles !== false,
    },
  }
}

/** Etsy tags: max 20 chars, letters / numbers / spaces / - ' ™ © ® only. */
export function cleanTag(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s\-'™©®]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 20).trim()
}

/** Etsy materials / styles: letters, numbers and spaces only. */
export function cleanWord(s: string, max = 45): string {
  return s.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim()
}

/** Etsy's `when_made` enum for "recently made" spans 2020 to the current year. */
export function whenMadeValue(v: AutomationConfig['details']['whenMade']): string {
  return v === 'recent' ? `2020_${new Date().getFullYear()}` : 'made_to_order'
}

/** Expand a SKU pattern: {N} item number, {KW} keyword, {DATE} yymmdd, {RAND} 4 random chars. */
export function buildSku(pattern: string, ctx: { n: number; keyword: string; date?: Date }): string {
  if (!pattern) return ''
  const d = ctx.date ?? new Date()
  const kw = ctx.keyword.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 14).replace(/-$/, '')
  const yymmdd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return pattern
    .replace(/\{N\}/gi, String(ctx.n).padStart(3, '0'))
    .replace(/\{KW\}/gi, kw)
    .replace(/\{DATE\}/gi, yymmdd)
    .replace(/\{RAND\}/gi, rand)
    .slice(0, 32)
}

/** Final price: strategy on the market base, then fixed / clamp / charm rounding. */
export function finalPrice(base: number | null, p: AutomationConfig['price']): number | null {
  let price: number | null = p.strategy === 'fixed' ? p.fixed : base
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  if (p.strategy === 'undercut') price *= 0.9
  else if (p.strategy === 'premium') price *= 1.15
  if (p.min != null) price = Math.max(price, p.min)
  if (p.max != null) price = Math.min(price, p.max)
  if (p.charm && p.strategy !== 'fixed' && price >= 2) price = Math.ceil(price) - 0.01
  return Math.max(0.2, Math.round(price * 100) / 100)
}
