/**
 * Estimated per-listing sales, from REAL review signals — the honest version of
 * Everbee's "Monthly Sales / Total Sales / Revenue" columns.
 *
 * Etsy publishes NO per-listing sales. What it does expose is **reviews**, and a
 * review is a *verified purchase* — you can only review what you bought. Only a
 * fraction of buyers leave one, so:
 *
 *     sales ≈ reviews ÷ reviewRate
 *
 * That single `reviewRate` (share of buyers who review) is the whole assumption,
 * and the dominant source of error — it varies by category, price and shop. So the
 * OUTPUT IS AN ESTIMATE and must always be labelled as one (see the no-fabricated-
 * data rule). The review COUNT and 30-day velocity themselves are the only hard
 * numbers; everything derived here is an estimate.
 *
 *   estTotalSales     ≈ reviewCount ÷ reviewRate
 *   estMonthlySales   ≈ monthlyReviews ÷ reviewRate, where monthlyReviews is the
 *                       trailing-30-day review velocity when the listing is actively
 *                       reviewed, else its lifetime average (reviewCount ÷ ageMonths)
 *                       — so a proven seller with a quiet last month still reads as
 *                       selling, and a brand-new spike still shows momentum.
 *   estMonthlyRevenue ≈ estMonthlySales × price
 *
 * `reviewRate` is env-tunable (`NEXT_PUBLIC_ETSY_REVIEW_RATE`, default 0.12 ≈ 1 in 8
 * buyers reviews) so it can be calibrated against listings whose real sales are known.
 */

function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Share of buyers who leave a review. Clamped to a sane 2%–100%. */
export function reviewRate(): number {
  return Math.min(1, Math.max(0.02, envNum('NEXT_PUBLIC_ETSY_REVIEW_RATE', 0.12)))
}

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
}

const EMPTY: ListingSalesEstimate = {
  reviewCount: null, reviewsLast30d: null, estTotalSales: null,
  estMonthlySales: null, estMonthlyRevenue: null, monthlyIsAverage: false,
}

export function estimateListingSales(input: {
  reviewCount?: number | null
  reviewsLast30d?: number | null
  price?: number | null
  ageDays?: number | null
}): ListingSalesEstimate {
  const reviewCount = input.reviewCount ?? null
  const reviewsLast30d = input.reviewsLast30d ?? null
  const price = input.price ?? null
  const ageDays = input.ageDays ?? null
  if (reviewCount == null && reviewsLast30d == null) return EMPTY

  const rate = reviewRate()

  const estTotalSales = reviewCount != null ? Math.round(reviewCount / rate) : null

  // Monthly reviews: prefer real recent velocity; if the last 30 days are quiet
  // (0) but the listing has lifetime reviews, fall back to its lifetime average so
  // a long-proven seller doesn't read as "0 sales/mo".
  const lifetimeMonthly = reviewCount != null && ageDays != null && ageDays > 0
    ? reviewCount / (ageDays / 30)
    : null
  let monthlyReviews: number | null = null
  let monthlyIsAverage = false
  if (reviewsLast30d != null && reviewsLast30d > 0) {
    monthlyReviews = reviewsLast30d
  } else if (lifetimeMonthly != null) {
    monthlyReviews = lifetimeMonthly
    monthlyIsAverage = true
  } else if (reviewsLast30d != null) {
    monthlyReviews = reviewsLast30d // genuinely 0 recent AND no age to average
  }

  const estMonthlySales = monthlyReviews != null ? Math.round(monthlyReviews / rate) : null
  const estMonthlyRevenue = estMonthlySales != null && price != null
    ? Math.round(estMonthlySales * price)
    : null

  return { reviewCount, reviewsLast30d, estTotalSales, estMonthlySales, estMonthlyRevenue, monthlyIsAverage }
}
