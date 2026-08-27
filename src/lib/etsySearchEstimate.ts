/**
 * Estimated monthly ETSY searches for a keyword — calibrated to eRank.
 *
 * WHAT WE LEARNED (reverse-engineering ~1,600 eRank↔Rankkw side-by-sides,
 * 91 keywords × up to 9 countries — see erankCalibration.ts):
 *
 *  1. eRank's per-country "Avg. Searches" = its GLOBAL figure × that country's
 *     "Searchers by Country" share. Verified to 0.1% median across 108 cells, so
 *     per-country is CALCULATED exactly once the global is known.
 *
 *  2. eRank's GLOBAL figure is a proprietary Etsy-search metric. It is NOT derivable
 *     from any public input we have: vs Etsy competition r=0.39 (non-monotonic —
 *     shopify-theme comp 7.8K→20,840 but printable comp 320K→2,758); vs Google
 *     volume r=0.54 (font-bundle Google 880→6,362 vs coloring-pages Google 550K→6,049);
 *     combined R²=0.33, ~83% median error. eRank measures on-Etsy search demand,
 *     which diverges from both listing counts and Google.
 *
 * So the global anchor comes from eRank's real captured value when we have the
 * keyword (exact match), and only falls back to a competition power law otherwise.
 * The fallback (K·competition^P, K=86 P=0.32, refit to eRank's numbers) is a rough
 * estimate for un-calibrated keywords, but never the ~10× overshoot of the old
 * K=345/P=0.434 curve (that curve had ~1,081% median error against real eRank data).
 *
 * K/P are env-overridable (NEXT_PUBLIC_ETSY_SEARCH_K / NEXT_PUBLIC_ETSY_SEARCH_P).
 */
import { lookupErank } from './erankCalibration'

function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const K = envNum('NEXT_PUBLIC_ETSY_SEARCH_K', 86)
const P = envNum('NEXT_PUBLIC_ETSY_SEARCH_P', 0.32)
// eRank CTR (clicks-per-search) rises with search volume — fit CTR ≈ A + B·ln(searches)
// across the calibrated keywords (r=0.66, ~10pt median error). Used to estimate CTR for
// keywords we have no eRank data for, so Avg Clicks / CTR are never blank. Clamped to the
// observed range. When we have no volume either, fall back to the median CTR.
const CTR_A = envNum('NEXT_PUBLIC_ETSY_CTR_A', 30)
const CTR_B = envNum('NEXT_PUBLIC_ETSY_CTR_B', 8.15)
const FALLBACK_CTR = envNum('NEXT_PUBLIC_ETSY_CTR', 98)

function modelledCtr(globalSearches?: number | null): number {
  if (globalSearches == null || globalSearches <= 0) return FALLBACK_CTR
  return Math.max(25, Math.min(130, Math.round(CTR_A + CTR_B * Math.log(globalSearches))))
}

/**
 * Fallback global estimate from live Etsy competition (totalResults), for keywords
 * we have no eRank calibration for. Returns null when there's no competition figure.
 */
export function estimateEtsySearches(etsyCompetition?: number | null): number | null {
  if (etsyCompetition == null || etsyCompetition <= 0) return null
  return Math.round(K * Math.pow(etsyCompetition, P))
}

/**
 * GLOBAL monthly Etsy-search estimate. Uses eRank's real captured global figure when
 * the keyword is in the calibration set (exact match); otherwise the competition
 * power-law fallback. This is the one proprietary quantity we can't compute.
 */
export function estimateGlobalEtsySearches(
  keyword: string | null | undefined,
  etsyCompetition?: number | null,
): number | null {
  if (keyword) {
    const cal = lookupErank(keyword)
    if (cal) return cal.g
  }
  return estimateEtsySearches(etsyCompetition)
}

/**
 * eRank's captured share (0–1) of a keyword's GLOBAL demand for one country, or null
 * when we don't have it — so callers can reproduce eRank's per-country split exactly
 * and fall back to the live Google country share otherwise.
 */
export function erankCountryShare(
  keyword: string | null | undefined,
  country: string,
): number | null {
  if (!keyword || !country || country === 'GLO') return null
  const cal = lookupErank(keyword)
  const pct = cal?.shares?.[country]
  return pct != null ? pct / 100 : null
}

/**
 * eRank's CTR for a keyword — "clicks per search" (often >100%, since one search
 * yields several listing clicks). Captured per keyword (its GLOBAL value), or null
 * when we have no eRank data. eRank's own CTR pill is sometimes "Unknown" too.
 */
export function estimateCtr(
  keyword: string | null | undefined,
  country?: string,
  globalSearches?: number | null,
): number | null {
  const cal = keyword ? lookupErank(keyword) : null
  if (cal) {
    if (country && country !== 'GLO' && cal.ctrc?.[country] != null) return cal.ctrc[country]
    if (cal.ctr != null) return cal.ctr
  }
  // Un-calibrated keyword → CTR modelled from its search volume, so the stat isn't blank.
  return modelledCtr(globalSearches)
}

/**
 * eRank's Avg. Clicks, reconstructed from the exact identity clicks = searches × CTR.
 * `searches` is the (already country-scaled) Avg-Searches figure, so this returns the
 * matching per-country clicks. Null when we have no CTR (un-calibrated keyword).
 */
export function estimateAvgClicks(
  keyword: string | null | undefined,
  searches: number | null,
  country?: string,
  globalSearches?: number | null,
): number | null {
  const ctr = estimateCtr(keyword, country, globalSearches)
  if (ctr == null || searches == null) return null
  return Math.round(searches * ctr / 100)
}

/**
 * Scale the GLOBAL Etsy-search estimate down to one country: global × that country's
 * share of the keyword's search demand (eRank's exact per-country mechanism).
 *
 * `share == null` (no data) → the unscaled global estimate, never a fabricated country
 * figure. `share >= 1` (Global) → the global estimate unchanged.
 */
export function scaleEtsySearchesToCountry(
  globalEstimate: number | null,
  share: number | null | undefined,
): number | null {
  if (globalEstimate == null) return null
  if (share == null || share >= 1) return globalEstimate
  if (share <= 0) return 0
  return Math.round(globalEstimate * share)
}
