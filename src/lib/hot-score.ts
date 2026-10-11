/**
 * Hot Score 0-100 from real fields only: favorite-velocity (favorites per day
 * live, log-scaled, 50/day maxes it) and engagement (favorites per view, 8%
 * maxes it). Shared by live Hot Products search and the product database, so a
 * listing scores the same in both.
 */
export function hotScoreOf(views: number | null | undefined, favs: number | null | undefined, createdTs: number | null | undefined, nowMs = Date.now()): { score: number; favPerDay: number | null; engagementPct: number } {
  const v = views ?? 0
  const f = favs ?? 0
  const engagementPct = v > 0 ? parseFloat((f / v * 100).toFixed(1)) : 0
  let favPerDay: number | null = null
  if (createdTs) {
    const ageDays = Math.max(1, (nowMs - createdTs * 1000) / 86_400_000)
    favPerDay = f / ageDays
  }
  const velScore = favPerDay != null ? Math.min(Math.log10(favPerDay + 1) / Math.log10(51), 1) : Math.min(Math.log10(f + 1) / Math.log10(20001), 1)
  const engScore = Math.min(engagementPct / 8, 1)
  const score = Math.round(100 * (0.6 * velScore + 0.4 * engScore))
  return { score, favPerDay: favPerDay != null ? parseFloat(favPerDay.toFixed(2)) : null, engagementPct }
}
