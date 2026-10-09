/**
 * "Why did this listing move?" for one listing on one keyword.
 *
 * Etsy's ranking formula is private and also uses signals nobody outside Etsy can
 * see (clicks, conversion, ads, personalisation). So this never claims a cause. It
 * lists what we MEASURED on the listing around the move (title and tag edits,
 * price and sale changes, stock, rating, the pace of reviews, favorites and views)
 * and which listings passed it or were passed. Every value comes from our own daily
 * snapshots; a day we did not capture is reported as a gap, never filled in.
 */
import { connectDB } from '@/lib/db'
import { ListingSnapshot, SearchRankSnapshot, TrackedListing } from '@/lib/models'
import { historyRead, HISTORY_MAX_MS, normalizeKeyword, normalizeCountry, trustedReviews } from '@/lib/snapshots'

/** How a keyword sits in a listing's title and tags. */
/** How a keyword sits in a listing's title and tags. null = that part is unknown. */
export interface KeywordFit {
  inTitle: boolean | null
  /** Character index of the phrase in the title, null when absent or unknown. */
  titleIndex: number | null
  exactTag: boolean | null
  /** Tags that contain the whole phrase (exact tag included). */
  phraseTags: number | null
  /** Tags sharing at least one word with the keyword. */
  wordTags: number | null
}

export type RankEvent =
  | { kind: 'title'; day: string; prevDay: string; from: string; to: string; fitBefore: KeywordFit; fitAfter: KeywordFit }
  | { kind: 'tags'; day: string; prevDay: string; added: string[]; removed: string[]; fitBefore: KeywordFit; fitAfter: KeywordFit }
  | { kind: 'price'; day: string; prevDay: string; from: number; to: number; currency: string; pct: number }
  | { kind: 'sale'; day: string; prevDay: string; started: boolean; pct: number | null }
  | { kind: 'stock'; day: string; prevDay: string; outOfStock: boolean }
  | { kind: 'rating'; day: string; prevDay: string; from: number; to: number }

/** Gained per day in the move window vs the same length of time just before it. */
export interface PaceMetric {
  /** Total gained in the window, null when not measured on two days. */
  gained: number | null
  perDay: number | null
  /** Per-day pace in the period before the window, null when not measured. */
  beforePerDay: number | null
}

export interface PassedListing {
  listingId: number
  title: string
  shopName: string | null
  /** Position on the window's first day, null = not in the captured results that day. */
  was: number | null
  now: number
}

export interface RankExplanation {
  keyword: string
  listingId: number
  from: string
  to: string
  /** Days this listing was measured (snapshots) inside the window. */
  measuredDays: number
  events: RankEvent[]
  fitNow: KeywordFit | null
  fitAtStart: KeywordFit | null
  pace: { reviews: PaceMetric; favorites: PaceMetric; views: PaceMetric }
  /** Listings above it now that were below it (or not seen) on the first day. */
  passedBy: { count: number; notSeenBefore: number; sample: PassedListing[] }
  /** Listings below it now that were above it on the first day. */
  passed: { count: number; sample: PassedListing[] }
  /** What the listing offers today (null = never observed, not "no"). */
  details: {
    freeShipping: boolean | null
    hasVideo: boolean | null
    imageCount: number | null
    starSeller: boolean | null
    badges: string[]
    personalisable: boolean | null
  } | null
}

const DAY_MS = 86_400_000
const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS))

const norm = (s: string) => s.toLowerCase().replace(/&#39;|&quot;|&amp;/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function keywordFit(keyword: string, title: string | undefined, tags: string[] | undefined): KeywordFit {
  const phrase = norm(keyword)
  const words = phrase.split(' ').filter(w => w.length > 1)
  const t = title ? norm(title) : ''
  // Whole-word match: "art" must not match inside "party".
  const at = t ? ` ${t} `.indexOf(` ${phrase} `) : -1
  const known = !!tags?.length
  const ntags = (tags ?? []).map(norm)
  return {
    inTitle: t ? at >= 0 : null,
    titleIndex: at >= 0 ? at : null,
    exactTag: known ? ntags.includes(phrase) : null,
    phraseTags: known ? ntags.filter(g => ` ${g} `.includes(` ${phrase} `)).length : null,
    wordTags: known ? ntags.filter(g => words.some(w => ` ${g} `.includes(` ${w} `))).length : null,
  }
}

export interface SnapRow {
  day: string
  title?: string
  tags?: string[]
  price?: number
  currency?: string
  views?: number
  favorers?: number
  reviewCount?: number
  priceOriginal?: number
  onSale?: boolean
  rating?: number
  quantity?: number
}

const listPrice = (r: SnapRow) => (r.onSale && r.priceOriginal ? r.priceOriginal : r.price)

/** Gain over a span of measured rows, as total and per day. */
function gain(rows: SnapRow[], field: 'reviewCount' | 'favorers' | 'views'): { gained: number; perDay: number } | null {
  // Review counts before REVIEW_HISTORY_FROM hold fake zeros, and a 0 view or
  // favorite count is the old "not seen" placeholder: neither may start a gain.
  const pts = rows.filter(r => field === 'reviewCount' ? trustedReviews(r.day, r.reviewCount) != null : typeof r[field] === 'number' && (r[field] as number) > 0)
  if (pts.length < 2) return null
  const a = pts[0], b = pts[pts.length - 1]
  const g = Math.max(0, (b[field] as number) - (a[field] as number))
  return { gained: g, perDay: g / daysBetween(a.day, b.day) }
}

function pace(windowRows: SnapRow[], beforeRows: SnapRow[], field: 'reviewCount' | 'favorers' | 'views'): PaceMetric {
  const w = gain(windowRows, field)
  const b = gain(beforeRows, field)
  return { gained: w?.gained ?? null, perDay: w ? Math.round(w.perDay * 100) / 100 : null, beforePerDay: b ? Math.round(b.perDay * 100) / 100 : null }
}

/**
 * Measured edits between consecutive snapshot days, newest first. Title/tags are
 * stored only on change days, so each day's value is carried forward from the
 * last stored one (seeded from before the range).
 */
export function buildEvents(keyword: string, snaps: SnapRow[], titleSeed: string | undefined, tagsSeed: string[] | undefined, windowStart: string) {
  let title = titleSeed
  let tags = tagsSeed
  const eff = snaps.map(r => {
    if (r.title) title = r.title
    if (r.tags?.length) tags = r.tags
    return { title, tags }
  })

  const events: RankEvent[] = []
  // Sale, stock and rating are only recorded on days the page itself was seen, so
  // each is compared with the LAST day it was known, not with the previous row.
  let lastSale: { v: boolean; day: string } | null = null
  let lastQty: { v: number; day: string } | null = null
  let lastRating: { v: number; day: string } | null = null
  const first = snaps[0]
  if (first) {
    if (typeof first.onSale === 'boolean') lastSale = { v: first.onSale, day: first.day }
    if (typeof first.quantity === 'number') lastQty = { v: first.quantity, day: first.day }
    if (typeof first.rating === 'number') lastRating = { v: first.rating, day: first.day }
  }
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1], b = snaps[i]
    const inWindow = b.day >= windowStart
    const sale = lastSale, qty = lastQty, rating = lastRating
    if (typeof b.onSale === 'boolean') lastSale = { v: b.onSale, day: b.day }
    if (typeof b.quantity === 'number') lastQty = { v: b.quantity, day: b.day }
    if (typeof b.rating === 'number') lastRating = { v: b.rating, day: b.day }
    if (!inWindow) continue
    const ea = eff[i - 1], eb = eff[i]
    const base = { day: b.day, prevDay: a.day }
    if (ea.title && eb.title && ea.title !== eb.title) {
      events.push({ kind: 'title', ...base, from: ea.title, to: eb.title, fitBefore: keywordFit(keyword, ea.title, ea.tags), fitAfter: keywordFit(keyword, eb.title, eb.tags) })
    }
    if (ea.tags?.length && eb.tags?.length) {
      const before = new Set(ea.tags.map(t => t.toLowerCase()))
      const after = new Set(eb.tags.map(t => t.toLowerCase()))
      const added = [...after].filter(t => !before.has(t))
      const removed = [...before].filter(t => !after.has(t))
      if (added.length || removed.length) {
        events.push({ kind: 'tags', ...base, added, removed, fitBefore: keywordFit(keyword, eb.title, ea.tags), fitAfter: keywordFit(keyword, eb.title, eb.tags) })
      }
    }
    if (sale && typeof b.onSale === 'boolean' && sale.v !== b.onSale) {
      const pct = b.onSale && b.priceOriginal && b.price ? Math.round((1 - b.price / b.priceOriginal) * 100) : null
      events.push({ kind: 'sale', day: b.day, prevDay: sale.day, started: b.onSale, pct })
    }
    if (qty && typeof b.quantity === 'number' && (qty.v === 0) !== (b.quantity === 0)) {
      events.push({ kind: 'stock', day: b.day, prevDay: qty.day, outOfStock: b.quantity === 0 })
    }
    if (rating && typeof b.rating === 'number' && Math.abs(b.rating - rating.v) >= 0.1) {
      events.push({ kind: 'rating', day: b.day, prevDay: rating.day, from: rating.v, to: b.rating })
    }
  }

  events.push(...priceChanges(snaps, windowStart))
  events.sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0))
  return { events: events.reverse(), eff }
}

/**
 * Price changes that really happened. Daily prices come from two sources (the
 * Etsy API's list price, and what an extension user saw, which may be converted
 * to their currency or captured mid-sale), so raw day-to-day differences are
 * mostly noise: 1.99 -> 2.43 -> 1.99 flips, and the odd unit slip (1.81 -> 181)
 * were seen live on 2026-10-09. A change counts only when the LIST price, in the
 * listing's main currency, held for 2+ measured days both before and after it,
 * and is within 3x either way.
 */
function priceChanges(snaps: SnapRow[], windowStart: string): RankEvent[] {
  const pts = snaps
    .map(r => ({ day: r.day, price: listPrice(r), currency: r.currency ?? 'USD' }))
    .filter((p): p is { day: string; price: number; currency: string } => typeof p.price === 'number' && p.price > 0)
  if (pts.length < 4) return []
  const byCur = new Map<string, number>()
  for (const p of pts) byCur.set(p.currency, (byCur.get(p.currency) ?? 0) + 1)
  const currency = [...byCur].sort((a, b) => b[1] - a[1])[0][0]

  type Run = { price: number; firstDay: string; lastDay: string; n: number }
  const same = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b) < 0.005
  const merge = (runs: Run[]) => runs.reduce<Run[]>((acc, r) => {
    const last = acc[acc.length - 1]
    if (last && same(last.price, r.price)) { last.lastDay = r.lastDay; last.n += r.n } else acc.push({ ...r })
    return acc
  }, [])
  let runs = merge(pts.filter(p => p.currency === currency).map(p => ({ price: p.price, firstDay: p.day, lastDay: p.day, n: 1 })))
  // A price seen on one day only is a reading, not a price the listing held.
  runs = merge(runs.filter(r => r.n >= 2))

  const out: RankEvent[] = []
  for (let i = 1; i < runs.length; i++) {
    const a = runs[i - 1], b = runs[i]
    const ratio = b.price / a.price
    if (b.firstDay < windowStart || ratio > 3 || ratio < 1 / 3) continue
    out.push({ kind: 'price', day: b.firstDay, prevDay: a.lastDay, from: a.price, to: b.price, currency, pct: Math.round((ratio - 1) * 100) })
  }
  return out
}

export async function explainRankMove(
  keywordRaw: string, listingId: number, from: string, to: string, countryRaw?: string,
): Promise<RankExplanation | null> {
  const keyword = normalizeKeyword(keywordRaw)
  if (!keyword || !listingId || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return null
  await connectDB()

  // Edits made in the week before the first capture can still explain the move.
  const windowStart = shiftDay(from, -7)
  const span = daysBetween(windowStart, to)
  const beforeStart = shiftDay(windowStart, -span)

  const country = countryRaw ? normalizeCountry(countryRaw) : 'xx'
  const countryFilter: Record<string, unknown> = country === 'xx'
    ? { $or: [{ country: 'xx' }, { country: { $exists: false } }] }
    : { country }

  const [snaps, titleSeed, tagsSeed, meta, rankRows] = await Promise.all([
    ListingSnapshot.find({ listingId, day: { $gte: beforeStart, $lte: to } })
      .sort({ day: 1 })
      .select('day title tags price currency views favorers reviewCount priceOriginal onSale rating quantity')
      .maxTimeMS(HISTORY_MAX_MS)
      .lean<SnapRow[]>(),
    // Title/tags are stored only on the days they changed: seed from before the range.
    ListingSnapshot.findOne({ listingId, day: { $lt: beforeStart }, title: { $nin: [null, ''] } })
      .sort({ day: -1 }).select('title').lean<{ title?: string }>(),
    ListingSnapshot.findOne({ listingId, day: { $lt: beforeStart }, 'tags.0': { $exists: true } })
      .sort({ day: -1 }).select('tags').lean<{ tags?: string[] }>(),
    TrackedListing.findOne({ listingId })
      .select('title tags freeShipping hasVideo imageCount starSeller badges personalisable')
      .lean<{ title?: string; tags?: string[]; freeShipping?: boolean | null; hasVideo?: boolean | null; imageCount?: number | null; starSeller?: boolean | null; badges?: string[]; personalisable?: boolean | null }>(),
    // Organic positions on the first and last day only, for "who passed whom".
    historyRead(() => SearchRankSnapshot.find({ keyword, ...countryFilter, isAd: { $ne: true }, day: { $in: [from, to] } })
      .select('listingId day position')
      .maxTimeMS(HISTORY_MAX_MS)
      .lean<{ listingId: number; day: string; position: number }[]>()),
  ])

  const { events, eff } = buildEvents(keyword, snaps, titleSeed?.title, tagsSeed?.tags, windowStart)

  const windowRows = snaps.filter(r => r.day >= windowStart)
  const beforeRows = snaps.filter(r => r.day < windowStart)
  const startIdx = snaps.findIndex(r => r.day >= from)
  const atStart = startIdx >= 0 ? eff[startIdx] : null
  const nowTitle = meta?.title || eff[eff.length - 1]?.title
  const nowTags = meta?.tags?.length ? meta.tags : eff[eff.length - 1]?.tags

  // ── Who passed whom, from unambiguous positions on the first and last day ──
  const byDay = new Map<string, Map<number, number>>()
  const holders = new Map<string, number>()
  for (const r of rankRows) holders.set(`${r.day}|${r.position}`, (holders.get(`${r.day}|${r.position}`) ?? 0) + 1)
  for (const r of rankRows) {
    if ((holders.get(`${r.day}|${r.position}`) ?? 0) !== 1) continue   // two listings claim it: not a ranking
    let m = byDay.get(r.day)
    if (!m) { m = new Map(); byDay.set(r.day, m) }
    const prev = m.get(r.listingId)
    if (prev == null || r.position < prev) m.set(r.listingId, r.position)
  }
  const first = byDay.get(from) ?? new Map<number, number>()
  const last = byDay.get(to) ?? new Map<number, number>()
  const myFirst = first.get(listingId)
  const myLast = last.get(listingId)

  const passedByIds: { id: number; was: number | null; now: number }[] = []
  const passedIds: { id: number; was: number; now: number }[] = []
  if (myFirst != null && myLast != null && from !== to) {
    for (const [id, now] of last) {
      if (id === listingId) continue
      const was = first.get(id)
      if (now < myLast && (was == null || was > myFirst)) passedByIds.push({ id, was: was ?? null, now })
      if (now > myLast && was != null && was < myFirst) passedIds.push({ id, was, now })
    }
  }
  passedByIds.sort((a, b) => a.now - b.now)
  passedIds.sort((a, b) => a.now - b.now)
  const sampleIds = [...passedByIds.slice(0, 5).map(p => p.id), ...passedIds.slice(0, 5).map(p => p.id)]
  const names = sampleIds.length
    ? await TrackedListing.find({ listingId: { $in: sampleIds } }).select('listingId title shopName').lean<{ listingId: number; title?: string; shopName?: string | null }[]>()
    : []
  const nameOf = new Map(names.map(n => [n.listingId, n]))
  const toPassed = (p: { id: number; was: number | null; now: number }): PassedListing => ({
    listingId: p.id, title: nameOf.get(p.id)?.title ?? '', shopName: nameOf.get(p.id)?.shopName ?? null, was: p.was, now: p.now,
  })

  return {
    keyword,
    listingId,
    from,
    to,
    measuredDays: new Set(windowRows.map(r => r.day)).size,
    events,   // newest first
    fitNow: nowTitle || nowTags?.length ? keywordFit(keyword, nowTitle, nowTags) : null,
    fitAtStart: atStart && (atStart.title || atStart.tags?.length) ? keywordFit(keyword, atStart.title, atStart.tags) : null,
    pace: {
      reviews: pace(windowRows, beforeRows, 'reviewCount'),
      favorites: pace(windowRows, beforeRows, 'favorers'),
      views: pace(windowRows, beforeRows, 'views'),
    },
    passedBy: { count: passedByIds.length, notSeenBefore: passedByIds.filter(p => p.was == null).length, sample: passedByIds.slice(0, 5).map(toPassed) },
    passed: { count: passedIds.length, sample: passedIds.slice(0, 5).map(toPassed) },
    details: meta ? {
      freeShipping: meta.freeShipping ?? null,
      hasVideo: meta.hasVideo ?? null,
      imageCount: meta.imageCount ?? null,
      starSeller: meta.starSeller ?? null,
      badges: meta.badges ?? [],
      personalisable: meta.personalisable ?? null,
    } : null,
  }
}
