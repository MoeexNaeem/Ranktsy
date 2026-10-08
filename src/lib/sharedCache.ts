import { connectDB } from '@/lib/db'
import { AppSetting } from '@/lib/models'
import { memCache } from '@/lib/cache'
import { singleFlight } from '@/lib/concurrency'

/**
 * A value computed at most once per `ttlMs` for the WHOLE site, not per PM2 worker:
 * the result is kept in Mongo (one small AppSetting row) and in each worker's memory.
 * For admin readouts that are slow to compute and fine a minute or two old (the
 * Overview numbers took 10-30 s with several workers recomputing them, 2026-10-08).
 * The value must be plain JSON (no Dates).
 */
export async function sharedCached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const memKey = `shared:${key}`
  const hit = memCache.get<{ at: number; v: T }>(memKey)
  if (hit && Date.now() - hit.at < ttlMs) return hit.v
  return singleFlight(memKey, async () => {
    try {
      await connectDB()
      const doc = await AppSetting.findOne({ key: `cache:${key}` }).lean<{ str?: string; num?: number }>()
      if (doc?.str && doc.num && Date.now() - doc.num < ttlMs) {
        const v = JSON.parse(doc.str) as T
        memCache.set(memKey, { at: doc.num, v }, Math.ceil(ttlMs / 1000))
        return v
      }
    } catch { /* fall through and compute */ }
    const v = await compute()
    const at = Date.now()
    memCache.set(memKey, { at, v }, Math.ceil(ttlMs / 1000))
    AppSetting.updateOne({ key: `cache:${key}` }, { $set: { str: JSON.stringify(v), num: at } }, { upsert: true }).catch(() => {})
    return v
  })
}
