/**
 * Estimated per-listing sales — the honest, multi-signal version of Everbee's
 * "Monthly Sales / Total Sales / Revenue" columns.
 *
 * Etsy publishes NO per-listing sales, so every estimator (Everbee, eRank, us)
 * MODELS it. We blend the three real signals Etsy DOES expose, and take the
 * strongest — so a listing whose reviews are under-reported (Etsy pools an item's
 * reviews across relisted/variant listings, leaving the per-listing API count low)
 * is still measured by its real traffic, instead of collapsing to ~0:
 *
 *   • reviews  → sales ≈ reviews ÷ reviewRate        (a hard, verified-purchase floor)
 *   • views    → sales ≈ views × conversionRate      (traffic model; Etsy's avg CR)
 *   • favorites→ sales ≈ favorites × favToSales       (purchase-intent proxy)
 *
 *   estTotalSales   ≈ max(reviewFloor, viewsEst, favEst)   — strongest real signal
 *   estMonthlySales ≈ recent review velocity ÷ reviewRate, else estTotal amortised
 *                     over the listing's real age (lifetime average).
 *   estMonthlyRevenue ≈ estMonthlySales × price
 *
 * OUTPUT IS AN ESTIMATE and is always badged as one (see the no-fabricated-data
 * rule) — the review COUNT, view/favorite counts and age are the hard numbers;
 * everything derived here is modelled. A listing with genuinely low traffic AND
 * no reviews still estimates ~0 (we never invent sales from nothing).
 *
 * Rates are env-tunable so they can be calibrated against listings whose real
 * sales are known:
 *   NEXT_PUBLIC_ETSY_REVIEW_RATE       (default 0.12 ≈ 1 in 8 buyers reviews)
 *   NEXT_PUBLIC_ETSY_CONVERSION_RATE   (default 0.02 = 2% of views convert)
 *   NEXT_PUBLIC_ETSY_FAV_TO_SALES      (default 1.5 sales per favorite)
 */

function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Share of buyers who leave a review. Clamped to a sane 2%–100%. */
export function reviewRate(): number {
  return Math.min(1, Math.max(0.02, envNum('NEXT_PUBLIC_ETSY_REVIEW_RATE', 0.12)))
}
/** Share of a listing's lifetime views that convert to a sale. Clamped 0.3%–10%. */
export function conversionRate(): number {
  return Math.min(0.1, Math.max(0.003, envNum('NEXT_PUBLIC_ETSY_CONVERSION_RATE', 0.02)))
}
/** Sales per favorite (favorites are strong purchase intent). Clamped 0.2–6. */
export function favToSales(): number {
  return Math.min(6, Math.max(0.2, envNum('NEXT_PUBLIC_ETSY_FAV_TO_SALES', 1.5)))
}

/** What real signal the total estimate leaned on — for an honest UI hint. */
export type EstimateBasis = 'reviews' | 'traffic' | 'favorites' | null

export interface ListingSalesEstimate {
  /** Real lifetime review count (verified-purchase floor on units sold). */
  reviewCount: number | null
  /** Real reviews in the trailing 30 days (recent momentum). */
  reviewsLast30d: number | null
  /** ESTIMATE — lifetime units sold. */
  estTotalSales: number | null
  /** ESTIMATE — units sold per month (recent velocity, or lifetime average). */
  estMonthlySales: number | null
  /** ESTIMATE — revenue per month = estMonthlySales × price. */
  estMonthlyRevenue: number | null
  /** True when estMonthlySales fell back to the lifetime average (no recent reviews). */
  monthlyIsAverage: boolean
  /** Which real signal drove the total (reviews / traffic / favorites). */
  basis: EstimateBasis
}

const EMPTY: ListingSalesEstimate = {
  reviewCount: null, reviewsLast30d: null, estTotalSales: null,
  estMonthlySales: null, estMonthlyRevenue: null, monthlyIsAverage: false, basis: null,
}

export function estimateListingSales(input: {
  reviewCount?: number | null
  reviewsLast30d?: number | null
  price?: number | null
  ageDays?: number | null
  views?: number | null
  favorites?: number | null
}): ListingSalesEstimate {
  const reviewCount = input.reviewCount ?? null
  const reviewsLast30d = input.reviewsLast30d ?? null
  const price = input.price ?? null
  const ageDays = input.ageDays ?? null
  const views = input.views ?? null
  const favorites = input.favorites ?? null

  const rate = reviewRate()
  const cr = conversionRate()
  const fts = favToSales()

  // The three real-signal total estimates (null when the signal is missing).
  const reviewFloor = reviewCount != null ? reviewCount / rate : null
  const viewsEst    = views != null && views > 0 ? views * cr : null
  const favEst      = favorites != null && favorites > 0 ? favorites * fts : null

  // Nothing to go on at all → empty (never invent).
  if (reviewFloor == null && viewsEst == null && favEst == null) return EMPTY

  // Strongest real signal drives the total — reviews are a hard floor, traffic and
  // favorites capture the unreviewed sales Etsy's per-listing review count misses.
  const signals: { v: number; b: EstimateBasis }[] = []
  if (reviewFloor != null) signals.push({ v: reviewFloor, b: 'reviews' })
  if (viewsEst != null) signals.push({ v: viewsEst, b: 'traffic' })
  if (favEst != null) signals.push({ v: favEst, b: 'favorites' })
  const top = signals.reduce((a, b) => (b.v > a.v ? b : a))
  const estTotalSales = Math.round(top.v)
  const basis: EstimateBasis = top.b

  // Monthly: prefer real recent review velocity; else amortise the total estimate
  // over the listing's real age (its lifetime-average monthly rate).
  let estMonthlySales: number | null = null
  let monthlyIsAverage = false
  if (reviewsLast30d != null && reviewsLast30d > 0) {
    estMonthlySales = Math.round(reviewsLast30d / rate)
  } else if (ageDays != null && ageDays > 0) {
    estMonthlySales = Math.max(0, Math.round(estTotalSales / (ageDays / 30)))
    monthlyIsAverage = true
  }

  const estMonthlyRevenue = estMonthlySales != null && price != null
    ? Math.round(estMonthlySales * price)
    : null

  return { reviewCount, reviewsLast30d, estTotalSales, estMonthlySales, estMonthlyRevenue, monthlyIsAverage, basis }
}
