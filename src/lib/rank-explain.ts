/**
 * "Why did this listing move?" for one listing on one keyword.
 *
 * Etsy's ranking formula is private and also uses signals nobody outside Etsy can
 * see (clicks, conversion, ads, personalisation). So this never claims a cause. It
 * lists what we MEASURED on the listing around the move (title and tag edits,
 * sales starting or ending, stock, rating, the pace of reviews, favorites and views)
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
  /** Every word of the keyword appears in the title, in any order. */
  allWordsInTitle: boolean | null
  exactTag: boolean | null
  /** Tags that contain the whole phrase (exact tag included). */
  phraseTags: number | null
  /** Tags sharing at least one word with the keyword. */
  wordTags: number | null
}

export type RankEvent =
  | { kind: 'title'; day: string; prevDay: string; from: string; to: string; fitBefore: KeywordFit; fitAfter: KeywordFit }
  | { kind: 'tags'; day: string; prevDay: string; added: string[]; removed: string[]; fitBefore: KeywordFit; fitAfter: KeywordFit }
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
  /** Days seen on sale out of days the sale flag was seen, in the window. */
  sale: { daysOnSale: number; daysSeen: number; maxPct: number | null } | null
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
    isDigital: boolean | null
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
    allWordsInTitle: t ? words.every(w => ` ${t} `.includes(` ${w} `)) : null,
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
  let lastQty: { v: number; day: string } | null = null
  let lastRating: { v: number; day: string } | null = null
  const first = snaps[0]
  if (first) {
    if (typeof first.quantity === 'number') lastQty = { v: first.quantity, day: first.day }
    if (typeof first.rating === 'number') lastRating = { v: first.rating, day: first.day }
  }
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1], b = snaps[i]
    const inWindow = b.day >= windowStart
    const qty = lastQty, rating = lastRating
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
    if (qty && typeof b.quantity === 'number' && (qty.v === 0) !== (b.quantity === 0)) {
      events.push({ kind: 'stock', day: b.day, prevDay: qty.day, outOfStock: b.quantity === 0 })
    }
    if (rating && typeof b.rating === 'number' && Math.abs(b.rating - rating.v) >= 0.1) {
      events.push({ kind: 'rating', day: b.day, prevDay: rating.day, from: rating.v, to: b.rating })
    }
  }

  // No price-change events: daily prices mix the Etsy API list price with what
  // extension users saw (sale prices without the sale flag, currency-converted
  // prices), so on live data nearly every "change" was 2x/0.5x or a 1% FX drift
  // (2026-10-09). Sales still show, from the explicit onSale flag. Real price
  // changes need the list price recorded on its own first (see Phase 3).
  events.push(...saleChanges(snaps, windowStart))
  events.sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0))
  return { events: events.reverse(), eff }
}

const salePct = (r: SnapRow) => (r.onSale && r.priceOriginal && r.price ? Math.round((1 - r.price / r.priceOriginal) * 100) : null)

/**
 * Sale starts and ends that held. Sellers can target a sale at some countries, so
 * extension users in different places see different prices, and the daily
 * on-sale flag flips (one listing "started" a 50% sale six times in 12 days,
 * 2026-10-09). A change counts only when the state held for 3+ measured days on
 * both sides of it.
 */
function saleChanges(snaps: SnapRow[], windowStart: string): RankEvent[] {
  type Run = { v: boolean; firstDay: string; lastDay: string; n: number; pct: number | null }
  const merge = (runs: Run[]) => runs.reduce<Run[]>((acc, r) => {
    const last = acc[acc.length - 1]
    if (last && last.v === r.v) { last.lastDay = r.lastDay; last.n += r.n; last.pct = last.pct ?? r.pct } else acc.push({ ...r })
    return acc
  }, [])
  const pts = snaps.filter(r => typeof r.onSale === 'boolean')
  const runs = merge(merge(pts.map(r => ({ v: r.onSale as boolean, firstDay: r.day, lastDay: r.day, n: 1, pct: salePct(r) }))).filter(r => r.n >= 3))
  const out: RankEvent[] = []
  for (let i = 1; i < runs.length; i++) {
    const a = runs[i - 1], b = runs[i]
    if (b.firstDay < windowStart) continue
    out.push({ kind: 'sale', day: b.firstDay, prevDay: a.lastDay, started: b.v, pct: b.v ? b.pct : null })
  }
  return out
}

/** How often the listing was seen on sale in the window: always true, even when the flag flips. */
function saleSummary(rows: SnapRow[]): RankExplanation['sale'] {
  const seen = rows.filter(r => typeof r.onSale === 'boolean')
  if (!seen.length) return null
  const on = seen.filter(r => r.onSale)
  const pcts = on.map(salePct).filter((v): v is number => v != null && v > 0 && v < 100)
  return { daysOnSale: on.length, daysSeen: seen.length, maxPct: pcts.length ? Math.max(...pcts) : null }
}

/** The measured facts about one listing over its move window (shared by the
 *  single-listing panel and the per-keyword comparison). */
export type ListingFacts = Pick<RankExplanation, 'measuredDays' | 'events' | 'fitNow' | 'fitAtStart' | 'sale' | 'pace' | 'details'>

interface MetaRow { listingId: number; isDigital?: boolean | null; title?: string; tags?: string[]; freeShipping?: boolean | null; hasVideo?: boolean | null; imageCount?: number | null; starSeller?: boolean | null; badges?: string[]; personalisable?: boolean | null }

const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)

/**
 * Facts for many listings in a few reads: one snapshot query for all of them
 * (served by the { listingId, day } index), one seed query each for the last
 * title and tags stored before the range, and one TrackedListing read.
 */
export async function loadListingFacts(keyword: string, items: { listingId: number; from: string; to: string }[]): Promise<Map<number, ListingFacts>> {
  const out = new Map<number, ListingFacts>()
  const valid = items.filter(i => i.listingId > 0 && isDay(i.from) && isDay(i.to) && i.from <= i.to)
  if (!valid.length) return out
  await connectDB()

  // Edits made in the week before the first capture can still explain the move,
  // and pace is compared with the same length of time just before that.
  const win = new Map(valid.map(i => {
    const windowStart = shiftDay(i.from, -7)
    return [i.listingId, { ...i, windowStart, beforeStart: shiftDay(windowStart, -daysBetween(windowStart, i.to)) }]
  }))
  const ids = [...win.keys()]
  const minBefore = [...win.values()].reduce((m, w) => (w.beforeStart < m ? w.beforeStart : m), '9999-99-99')
  const maxTo = [...win.values()].reduce((m, w) => (w.to > m ? w.to : m), '0000-00-00')

  const seed = (field: 'title' | 'tags') => ListingSnapshot.aggregate<{ _id: number; v: string | string[] }>([
    { $match: { listingId: { $in: ids }, day: { $lt: minBefore }, ...(field === 'title' ? { title: { $nin: [null, ''] } } : { 'tags.0': { $exists: true } }) } },
    { $sort: { listingId: 1, day: -1 } },
    { $group: { _id: '$listingId', v: { $first: `$${field}` } } },
  ]).option({ maxTimeMS: HISTORY_MAX_MS })

  const [snaps, titleSeeds, tagSeeds, metas] = await Promise.all([
    historyRead(() => ListingSnapshot.find({ listingId: { $in: ids }, day: { $gte: minBefore, $lte: maxTo } })
      .sort({ listingId: 1, day: 1 })
      .select('listingId day title tags price currency views favorers reviewCount priceOriginal onSale rating quantity')
      .maxTimeMS(HISTORY_MAX_MS)
      .lean<(SnapRow & { listingId: number })[]>()),
    historyRead(() => seed('title')),
    historyRead(() => seed('tags')),
    TrackedListing.find({ listingId: { $in: ids } })
      .select('listingId title tags freeShipping hasVideo imageCount starSeller badges personalisable isDigital')
      .lean<MetaRow[]>(),
  ])
  const byListing = new Map<number, SnapRow[]>()
  for (const r of snaps) { const a = byListing.get(r.listingId); if (a) a.push(r); else byListing.set(r.listingId, [r]) }
  const titleSeed = new Map(titleSeeds.map(t => [t._id, t.v as string]))
  const tagSeed = new Map(tagSeeds.map(t => [t._id, t.v as string[]]))
  const metaOf = new Map(metas.map(m => [m.listingId, m]))

  for (const [listingId, w] of win) {
    const rows = (byListing.get(listingId) ?? []).filter(r => r.day <= w.to)
    const { events, eff } = buildEvents(keyword, rows, titleSeed.get(listingId), tagSeed.get(listingId), w.windowStart)
    const windowRows = rows.filter(r => r.day >= w.windowStart)
    const beforeRows = rows.filter(r => r.day >= w.beforeStart && r.day < w.windowStart)
    const startIdx = rows.findIndex(r => r.day >= w.from)
    const atStart = startIdx >= 0 ? eff[startIdx] : null
    const meta = metaOf.get(listingId)
    const nowTitle = meta?.title || eff[eff.length - 1]?.title
    const nowTags = meta?.tags?.length ? meta.tags : eff[eff.length - 1]?.tags
    out.set(listingId, {
      measuredDays: new Set(windowRows.map(r => r.day)).size,
      events,   // newest first
      fitNow: nowTitle || nowTags?.length ? keywordFit(keyword, nowTitle, nowTags) : null,
      fitAtStart: atStart && (atStart.title || atStart.tags?.length) ? keywordFit(keyword, atStart.title, atStart.tags) : null,
      sale: saleSummary(windowRows),
      pace: {
        reviews: pace(windowRows, beforeRows, 'reviewCount'),
        favorites: pace(windowRows, beforeRows, 'favorers'),
        views: pace(windowRows, beforeRows, 'views'),
      },
      details: meta ? {
        freeShipping: meta.freeShipping ?? null,
        hasVideo: meta.hasVideo ?? null,
        imageCount: meta.imageCount ?? null,
        starSeller: meta.starSeller ?? null,
        badges: meta.badges ?? [],
        personalisable: meta.personalisable ?? null,
        isDigital: meta.isDigital ?? null,
      } : null,
    })
  }
  return out
}

export async function explainRankMove(
  keywordRaw: string, listingId: number, from: string, to: string, countryRaw?: string,
): Promise<RankExplanation | null> {
  const keyword = normalizeKeyword(keywordRaw)
  if (!keyword || !listingId || !isDay(from) || !isDay(to) || from > to) return null
  await connectDB()

  const country = countryRaw ? normalizeCountry(countryRaw) : 'xx'
  const countryFilter: Record<string, unknown> = country === 'xx'
    ? { $or: [{ country: 'xx' }, { country: { $exists: false } }] }
    : { country }

  const [factsMap, rankRows] = await Promise.all([
    loadListingFacts(keyword, [{ listingId, from, to }]),
    // Organic positions on the first and last day only, for "who passed whom".
    historyRead(() => SearchRankSnapshot.find({ keyword, ...countryFilter, isAd: { $ne: true }, day: { $in: [from, to] } })
      .select('listingId day position')
      .maxTimeMS(HISTORY_MAX_MS)
      .lean<{ listingId: number; day: string; position: number }[]>()),
  ])
  const facts = factsMap.get(listingId)
  if (!facts) return null

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
    ...facts,
    passedBy: { count: passedByIds.length, notSeenBefore: passedByIds.filter(p => p.was == null).length, sample: passedByIds.slice(0, 5).map(toPassed) },
    passed: { count: passedIds.length, sample: passedIds.slice(0, 5).map(toPassed) },
  }
}

// ─── Per keyword: what the climbers did differently ─────────────────────────────

/** One measured trait, counted among climbers and among droppers. `known` leaves
 *  out listings where the trait was not observed, so unknown never reads as "no". */
export interface CompareRow {
  key: string
  label: string
  climbers: { yes: number; known: number }
  droppers: { yes: number; known: number }
}
export interface MoverComparison {
  keyword: string
  climbers: number
  droppers: number
  /** Share of the compared listings that are digital downloads, null when unknown. */
  digitalShare: number | null
  rows: CompareRow[]
}

type Trait = { key: string; label: string; test: (f: ListingFacts) => boolean | null }
const TRAITS: Trait[] = [
  {
    key: 'kwIntoTitle', label: 'Put the keyword into the title',
    test: f => f.measuredDays < 2 ? null : f.events.some(e => e.kind === 'title' && (
      (e.fitBefore.allWordsInTitle === false && e.fitAfter.allWordsInTitle === true) || (e.fitBefore.inTitle === false && e.fitAfter.inTitle === true))),
  },
  { key: 'titleEdited', label: 'Edited the title', test: f => f.measuredDays < 2 ? null : f.events.some(e => e.kind === 'title') },
  {
    key: 'exactTagAdded', label: 'Added the exact keyword as a tag',
    test: f => f.measuredDays < 2 || f.fitNow?.exactTag == null ? null : f.events.some(e => e.kind === 'tags' && e.fitBefore.exactTag === false && e.fitAfter.exactTag === true),
  },
  { key: 'tagsEdited', label: 'Edited tags', test: f => f.measuredDays < 2 || f.fitNow?.exactTag == null ? null : f.events.some(e => e.kind === 'tags') },
  { key: 'allWords', label: 'All keyword words in the title', test: f => f.fitNow?.allWordsInTitle ?? null },
  { key: 'exactTag', label: 'Has the exact keyword as a tag', test: f => f.fitNow?.exactTag ?? null },
  { key: 'newReviews', label: 'Got new reviews', test: f => f.pace.reviews.gained == null ? null : f.pace.reviews.gained > 0 },
  {
    key: 'favsFaster', label: 'Favorites growing faster than before',
    test: f => f.pace.favorites.perDay == null || f.pace.favorites.beforePerDay == null ? null : f.pace.favorites.perDay > f.pace.favorites.beforePerDay * 1.25,
  },
  { key: 'onSale', label: 'On sale most days', test: f => f.sale && f.sale.daysSeen > 0 ? f.sale.daysOnSale / f.sale.daysSeen >= 0.5 : null },
  { key: 'soldOut', label: 'Sold out at some point', test: f => f.measuredDays < 2 ? null : f.events.some(e => e.kind === 'stock' && e.outOfStock) },
  { key: 'freeShipping', label: 'Free shipping', test: f => f.details?.freeShipping ?? null },
  { key: 'video', label: 'Has a video', test: f => f.details?.hasVideo ?? null },
  { key: 'starSeller', label: 'Star Seller shop', test: f => f.details?.starSeller ?? null },
]

export async function compareMovers(
  keywordRaw: string, movers: { listingId: number; change: number; firstDay: string; latestDay: string }[],
): Promise<MoverComparison | null> {
  const keyword = normalizeKeyword(keywordRaw)
  if (!keyword) return null
  const moving = movers.filter(m => m.change !== 0).slice(0, 40)
  const facts = await loadListingFacts(keyword, moving.map(m => ({ listingId: m.listingId, from: m.firstDay, to: m.latestDay })))
  const up = moving.filter(m => m.change > 0 && facts.has(m.listingId))
  const down = moving.filter(m => m.change < 0 && facts.has(m.listingId))
  const count = (group: typeof moving, t: Trait) => {
    let yes = 0, known = 0
    for (const m of group) {
      const v = t.test(facts.get(m.listingId)!)
      if (v == null) continue
      known++
      if (v) yes++
    }
    return { yes, known }
  }
  const rows = TRAITS.map(t => ({ key: t.key, label: t.label, climbers: count(up, t), droppers: count(down, t) }))
    // A trait nobody was measured on says nothing.
    .filter(r => r.climbers.known + r.droppers.known > 0)
  const kinds = [...up, ...down].map(m => facts.get(m.listingId)?.details?.isDigital).filter((v): v is boolean => typeof v === 'boolean')
  const digitalShare = kinds.length ? Math.round(kinds.filter(Boolean).length / kinds.length * 100) : null
  return { keyword, climbers: up.length, droppers: down.length, digitalShare, rows }
}
