/**
 * Estimated monthly ETSY searches for a keyword — calibrated to eRank.
 *
 * Etsy publishes NO search-volume data to anyone, so no tool has a "real" Etsy
 * search count — eRank's number is an estimate too. Crucially, eRank's estimate
 * does NOT come from Google Keyword Planner: comparing real numbers shows
 * eRank's "Avg. Searches" tracks the Etsy LISTING COUNT (competition), not
 * Google volume (e.g. "crochet" has 313K Google searches but eRank shows 187K,
 * while "planner" has 30K Google searches yet eRank shows 199K).
 *
 * So this derives the estimate from our real Etsy competition (totalResults) via
 * a power law fitted to eRank's actual numbers:
 *
 *     etsySearches ≈ K · competition^P     (default K=345, P=0.434)
 *
 * Fit against eRank (Global): crochet 2.3M→187,873 · planner 2.0M→199,164 ·
 * huntrix 12.7K→20,847 — all within ~6% across a 180× competition range.
 *
 * Both constants are env-overridable (NEXT_PUBLIC_ETSY_SEARCH_K /
 * NEXT_PUBLIC_ETSY_SEARCH_P) so the curve can be re-tuned without a code change.
 * Bonus: because it's based on the always-present competition count (not the
 * sometimes-missing Google volume), this stat never blanks.
 */
function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const K = envNum('NEXT_PUBLIC_ETSY_SEARCH_K', 345)
const P = envNum('NEXT_PUBLIC_ETSY_SEARCH_P', 0.434)

/**
 * Estimated monthly Etsy searches from the keyword's live Etsy competition
 * (totalResults). Returns null when there's no competition figure to base it on.
 */
export function estimateEtsySearches(etsyCompetition?: number | null): number | null {
  if (etsyCompetition == null || etsyCompetition <= 0) return null
  return Math.round(K * Math.pow(etsyCompetition, P))
}

/**
 * Scale the GLOBAL Etsy-search estimate down to one country.
 *
 * eRank's per-country "Avg. Searches" is its global number times that country's
 * share of the keyword's search demand — verified against real side-by-sides:
 *   • necklace: global 159,347 × US 29.8% = 47.5K  (eRank US 49,493)  ✓
 *   • necklace: global 159,347 × India 6.3% = 10.0K (eRank IND 9,828) ✓
 *   • resume:   global ~37,600 × US 14.8% = 5.6K   (eRank US 5,804)   ✓
 *   • resume:   global ~37,600 × Canada 3.4% = 1.28K (eRank CAN 1,252) ✓
 * (All within ~5%.) We use our own real Google country-share as `share`; it won't
 * reproduce eRank's proprietary distribution exactly, but it replaces the old bug
 * of showing the *same* global number for every country.
 *
 * `share == null` (no Google data) → return the unscaled global estimate, never a
 * fabricated country figure. `share >= 1` (Global) → the global estimate unchanged.
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
