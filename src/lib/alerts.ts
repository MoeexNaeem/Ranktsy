import { getKeywordCore } from '@/lib/keywords'

// Metrics we watch for a tracked keyword. All come from the normal cache-first keyword
// pipeline, so a re-check is usually free (served from cache) and only rarely spends API.
export interface Metrics { volume: number | null; competition: number | null; difficulty: number | null }

export async function fetchMetrics(keyword: string, country: string): Promise<Metrics> {
  const r = await getKeywordCore(keyword, country)
  const s = r.stats
  return {
    volume: s?.googleSearches ?? null,
    competition: s?.totalResults ?? null,
    difficulty: s?.difficulty ?? null,
  }
}

/**
 * A tracked keyword's saved baseline KD on the authentic scale. Baselines saved
 * before 2026-10-11 (no baseKdV) hold the old squashed score, where raw 51-100 was
 * stored as 51-59; this maps those back so a comparison with today's authentic KD
 * does not report a fake jump. The squash kept 9 steps for 49 points, so a legacy
 * hard baseline is accurate to about 3 points, well inside the 8-point alert gap.
 */
export function baselineKd(base: number | null | undefined, kdV: number | null | undefined): number | null {
  if (base == null) return null
  if (kdV === 2 || base <= 50) return base
  return Math.min(100, Math.round(51 + (Math.min(base, 59) - 51) * 49 / 8))
}

const fmt = (n: number) => n >= 1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n))

// Human-readable descriptions of the meaningful changes from `base` to `cur`. Empty
// array means nothing moved enough to be worth a notification (avoids alert fatigue).
export function describeChange(base: Metrics, cur: Metrics): string[] {
  const msgs: string[] = []
  if (base.volume != null && cur.volume != null && base.volume > 0) {
    const d = (cur.volume - base.volume) / base.volume
    if (Math.abs(d) >= 0.25) msgs.push(`Search volume ${d > 0 ? 'up' : 'down'} ${Math.round(Math.abs(d) * 100)}% (${fmt(base.volume)} to ${fmt(cur.volume)})`)
  }
  if (base.competition != null && cur.competition != null && base.competition > 0) {
    const d = (cur.competition - base.competition) / base.competition
    if (Math.abs(d) >= 0.20) msgs.push(`Competition ${d > 0 ? 'up' : 'down'} ${Math.round(Math.abs(d) * 100)}% (${fmt(base.competition)} to ${fmt(cur.competition)} listings)`)
  }
  if (base.difficulty != null && cur.difficulty != null) {
    const d = cur.difficulty - base.difficulty
    if (Math.abs(d) >= 8) msgs.push(`Keyword difficulty ${d > 0 ? 'rose' : 'dropped'} (${base.difficulty} to ${cur.difficulty})`)
  }
  return msgs
}
