/**
 * Estimated per-listing sales - the honest, multi-signal version of Everbee's
 * "Monthly Sales / Total Sales / Revenue" columns.
 *
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR THE MODEL.
 * The browser extension used to carry its own calibrated copy of this maths,
 * which is exactly why the same listing read differently on rankkw.com and in
 * the extension. It no longer does: `/api/etsy/estimate-config` serves the
 * constants below and the extension loads them at startup, so both surfaces
 * compute one number. If you change a rate here, bump ESTIMATE_MODEL_VERSION so
 * extension caches refresh.
 *
 * Etsy publishes NO per-listing sales, so every estimator (Everbee, eRank, us)
 * MODELS it from the signals Etsy DOES expose:
 *
 *   • views    → sales ≈ views × conversionRate   (traffic model, the primary signal)
 *   • reviews  → sales ≈ reviews ÷ reviewRate     (a hard, verified-purchase floor)
 *   • favorites→ sales ≈ favorites × favToSales   (last resort only, see below)
 *
 *   estTotalSales   ≈ max(viewsEst, reviewFloor)
 *   estMonthlySales ≈ recent review velocity ÷ reviewRate, else estTotal amortised
 *                     over the listing's real age (lifetime average).
 *   estMonthlyRevenue ≈ estMonthlySales × price
 *
 * Favorites are deliberately NOT part of the max. A heavily favourited listing
 * that converts badly would otherwise read as a bestseller, which is the single
 * biggest source of inflated numbers in tools of this kind. They are used only
 * when a listing exposes neither views nor reviews.
 *
 * Conversion is per-category, because it genuinely varies 2%-11% by category and
 * digital downloads convert far lower per view than physical goods. Calibrated
 * against known-truth Everbee samples (Home & Living 3.98%, physical average
 * ~3.5%, PNG/SVG 2.1%, Canva templates 0.54%). See CATEGORY_CONVERSION.
 *
 * OUTPUT IS AN ESTIMATE and is always badged as one (see the no-fabricated-data
 * rule) - the review COUNT, view/favorite counts and age are the hard numbers;
 * everything derived here is modelled. A listing with genuinely low traffic AND
 * no reviews still estimates ~0 (we never invent sales from nothing). Where our
 * own snapshot history is wide enough, prefer the MEASURED figure from
 * `getListingVelocity` over anything in this file.
 *
 * Rates are env-tunable so they can be calibrated against listings whose real
 * sales are known:
 *   NEXT_PUBLIC_ETSY_REVIEW_RATE       (default 0.10 ≈ 1 review per 10 sales)
 *   NEXT_PUBLIC_ETSY_CONVERSION_RATE   (default 0.035 = 3.5% of views, used when
 *                                       the category is unknown)
 *   NEXT_PUBLIC_ETSY_FAV_TO_SALES      (default 1.5 sales per favorite)
 *   NEXT_PUBLIC_ETSY_DIGITAL_CONVERSION(default 0.007 = 0.7% for digital files)
 */

/** Bump when any constant or the formula changes, so extension caches refresh. */
export const ESTIMATE_MODEL_VERSION = 3

function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Share of buyers who leave a review. Clamped to a sane 2%-100%. */
export function reviewRate(): number {
  return clamp(envNum('NEXT_PUBLIC_ETSY_REVIEW_RATE', 0.1), 0.02, 1)
}
/** Default share of a listing's lifetime views that convert. Clamped 0.3%-10%. */
export function conversionRate(): number {
  return clamp(envNum('NEXT_PUBLIC_ETSY_CONVERSION_RATE', 0.035), 0.003, 0.1)
}
/** Sales per favorite (favorites are strong purchase intent). Clamped 0.2-6. */
export function favToSales(): number {
  return clamp(envNum('NEXT_PUBLIC_ETSY_FAV_TO_SALES', 1.5), 0.2, 6)
}
/**
 * Conversion for digital downloads. They pull huge view counts per sale, so the
 * physical rate would overstate them several times over. Two known-truth digital
 * listings disagree 4x (Canva templates 0.54%, PNG/SVG 2.11%), so no constant
 * fits both; 0.7% favours the template-heavy majority and the reviews floor
 * backstops the higher-converting ones.
 */
export function digitalConversion(): number {
  return clamp(envNum('NEXT_PUBLIC_ETSY_DIGITAL_CONVERSION', 0.007), 0.003, 0.2)
}

/**
 * Per-category conversion (total sales ÷ lifetime views), keyed by Etsy
 * top-level category, lowercased. Physical goods convert ~2.6%-4.5%; anchored on
 * Everbee samples plus general Etsy norms.
 */
export const CATEGORY_CONVERSION: Record<string, number> = {
  'home & living': 0.04,
  weddings: 0.038,
  'bath & beauty': 0.045,
  'paper & party supplies': 0.045,
  'pet supplies': 0.042,
  'craft supplies & tools': 0.04,
  'toys & games': 0.035,
  jewelry: 0.03,
  accessories: 0.032,
  'bags & purses': 0.03,
  'art & collectibles': 0.03,
  clothing: 0.026,
  shoes: 0.026,
  'electronics & accessories': 0.03,
  'books, movies & music': 0.035,
}

/** Words that mark a listing as a digital download rather than a physical item. */
export const DIGITAL_PATTERN =
  '\\b(png|svg|eps|dxf|pdf pattern|digital download|instant download|printable|clip ?art|cut file|sublimation|procreate|digital paper|digital file)\\b'
const DIGITAL_RE = new RegExp(DIGITAL_PATTERN, 'i')

/** Signals that let us pick the right conversion rate for one listing. */
export interface ConversionContext {
  /** Etsy top-level category, e.g. "Home & Living" (breadcrumb 1 / taxonomy root). */
  categoryTop?: string | null
  /** Most specific category, used only if the top level is unknown. */
  category?: string | null
  /** Known-digital flag (listing page says "digital download"). */
  isDigital?: boolean | null
  title?: string | null
  tags?: string[] | null
}

/**
 * The conversion rate to use for one listing: the digital rate for digital
 * files, else the category rate, else the default. Same order of precedence on
 * every surface, which is what keeps the extension and the site in agreement.
 */
export function conversionFor(ctx: ConversionContext = {}): number {
  const hay = `${ctx.title ?? ''} ${(ctx.tags ?? []).join(' ')} ${ctx.category ?? ''} ${ctx.categoryTop ?? ''}`
  if (ctx.isDigital || DIGITAL_RE.test(hay)) return digitalConversion()
  const key = String(ctx.categoryTop ?? ctx.category ?? '').trim().toLowerCase()
  const fromTable = CATEGORY_CONVERSION[key]
  if (fromTable != null) return clamp(fromTable, 0.003, 0.2)
  return conversionRate()
}

/** The whole model as plain data - served to the extension so it cannot drift. */
export function estimateModelConfig() {
  return {
    version: ESTIMATE_MODEL_VERSION,
    rates: {
      reviewRate: reviewRate(),
      conversionRate: conversionRate(),
      favToSales: favToSales(),
    },
    digitalConversion: digitalConversion(),
    categoryConversion: CATEGORY_CONVERSION,
    digitalPattern: DIGITAL_PATTERN,
  }
}

/** What real signal the total estimate leaned on - for an honest UI hint. */
export type EstimateBasis = 'reviews' | 'traffic' | 'favorites' | null

export interface ListingSalesEstimate {
  /** Real lifetime review count (verified-purchase floor on units sold). */
  reviewCount: number | null
  /** Real reviews in the trailing 30 days (recent momentum). */
  reviewsLast30d: number | null
  /** ESTIMATE - lifetime units sold. */
  estTotalSales: number | null
  /** ESTIMATE - units sold per month (recent velocity, or lifetime average). */
  estMonthlySales: number | null
  /** ESTIMATE - revenue per month = estMonthlySales × price. */
  estMonthlyRevenue: number | null
  /** True when estMonthlySales fell back to the lifetime average (no recent reviews). */
  monthlyIsAverage: boolean
  /** Which real signal drove the total (reviews / traffic / favorites). */
  basis: EstimateBasis
  /** Readout - estTotalSales ÷ views, as a percentage. */
  conversionPct: number | null
  /** Readout - reviews ÷ estTotalSales, as a percentage. */
  reviewRatioPct: number | null
  /** The conversion rate this estimate actually used (category or digital aware). */
  conversionUsed: number | null
}

const EMPTY: ListingSalesEstimate = {
  reviewCount: null, reviewsLast30d: null, estTotalSales: null,
  estMonthlySales: null, estMonthlyRevenue: null, monthlyIsAverage: false, basis: null,
  conversionPct: null, reviewRatioPct: null, conversionUsed: null,
}

export interface ListingSalesEstimateInput extends ConversionContext {
  reviewCount?: number | null
  reviewsLast30d?: number | null
  price?: number | null
  ageDays?: number | null
  views?: number | null
  favorites?: number | null
  /** Explicit conversion rate; overrides the category/digital lookup. */
  conversionRate?: number | null
}

export function estimateListingSales(input: ListingSalesEstimateInput): ListingSalesEstimate {
  const reviewCount = input.reviewCount ?? null
  const reviewsLast30d = input.reviewsLast30d ?? null
  const price = input.price ?? null
  const ageDays = input.ageDays ?? null
  const views = input.views ?? null
  const favorites = input.favorites ?? null

  const rate = reviewRate()
  const cr = input.conversionRate != null && input.conversionRate > 0
    ? clamp(Number(input.conversionRate), 0.003, 0.2)
    : conversionFor(input)
  const fts = favToSales()

  // Traffic is the primary signal (Everbee's own "conversion rate" readout is
  // total ÷ views); reviews are a hard floor because each one is a verified
  // purchase. Favorites never join the max - see the header note.
  const viewsEst = views != null && views > 0 ? views * cr : null
  const reviewFloor = reviewCount != null && reviewCount > 0 ? reviewCount / rate : null

  let estTotalSales: number | null = null
  let basis: EstimateBasis = null
  if (viewsEst != null || reviewFloor != null) {
    estTotalSales = Math.round(Math.max(viewsEst ?? 0, reviewFloor ?? 0))
    basis = (reviewFloor ?? 0) > (viewsEst ?? 0) ? 'reviews' : 'traffic'
  } else if (favorites != null && favorites > 0) {
    estTotalSales = Math.round(favorites * fts)
    basis = 'favorites'
  }
  // Nothing to go on at all → empty (never invent).
  if (estTotalSales == null) return { ...EMPTY }

  // Monthly: prefer real recent review velocity; else amortise the total estimate
  // over the listing's real age (its lifetime-average monthly rate).
  let estMonthlySales: number | null = null
  let monthlyIsAverage = false
  if (reviewsLast30d != null && reviewsLast30d > 0) {
    estMonthlySales = Math.round(reviewsLast30d / rate)
  } else if (ageDays != null && ageDays > 0) {
    estMonthlySales = Math.max(0, Math.round(estTotalSales / Math.max(1, ageDays / 30)))
    monthlyIsAverage = true
  }
  // A month can never exceed the lifetime total it was derived from.
  if (estMonthlySales != null && estMonthlySales > estTotalSales) estMonthlySales = estTotalSales

  const estMonthlyRevenue = estMonthlySales != null && price != null
    ? Math.round(estMonthlySales * price)
    : null

  const conversionPct = views != null && views > 0
    ? Number(((estTotalSales / views) * 100).toFixed(2))
    : null
  const reviewRatioPct = estTotalSales > 0 && reviewCount != null
    ? Number(((reviewCount / estTotalSales) * 100).toFixed(2))
    : null

  return {
    reviewCount, reviewsLast30d, estTotalSales, estMonthlySales, estMonthlyRevenue,
    monthlyIsAverage, basis, conversionPct, reviewRatioPct, conversionUsed: cr,
  }
}

/**
 * Fold a MEASURED monthly figure (from our own snapshot history) over an
 * estimate. Used by every surface that shows monthly sales, so "measured beats
 * modelled" is one decision made in one place rather than per component.
 */
export function withMeasuredMonthly(
  est: ListingSalesEstimate,
  measured: { measured?: boolean; soldLast30Est?: number | null } | null | undefined,
  price?: number | null,
): ListingSalesEstimate & { isMeasured: boolean } {
  if (!measured?.measured || measured.soldLast30Est == null) return { ...est, isMeasured: false }
  const estMonthlySales = measured.soldLast30Est
  return {
    ...est,
    estMonthlySales,
    estMonthlyRevenue: price != null ? Math.round(estMonthlySales * price) : est.estMonthlyRevenue,
    monthlyIsAverage: false,
    isMeasured: true,
  }
}
