/**
 * SEBT NEXT education cohort, driven entirely from the admin panel.
 *
 * Batch 1 ran on a date window hardcoded in this file. That meant a new batch
 * needed a code change and a deploy, so the whole thing is now config in Mongo
 * (AppSetting rows) that an admin edits under Settings → SEBT NEXT:
 *
 *  1. BATCH + REGISTRATION - the admin sets a batch number and flips registration
 *     on. While it is on, /register/sebtnext and /login/sebtnext are live and each
 *     signup is stamped with that batch number. Flip it off and the links show
 *     "Batch N has ended". Nothing expires on its own any more; the admin decides.
 *  2. ENTERPRISE TRIAL - a toggle plus a day count. While on, every SEBT signup
 *     gets the Enterprise plan free for that many days, counted from THEIR signup
 *     via the comp clock (compExpiresAt), after which they auto-revert to free.
 *     See plan-lifecycle.ts, which does the reverting.
 *
 * The two are deliberately independent: registration can be open with the trial
 * off (students join on free), or the trial can stay on for a closed batch so an
 * admin can still top students up from the Students tab.
 */
import { connectDB } from '@/lib/db'
import { AppSetting } from '@/lib/models'
import { memCache } from '@/lib/cache'

export const SEBT_KEYS = {
  batch:      'sebt_batch',
  open:       'sebt_registration_open',
  trialOn:    'sebt_trial_enabled',
  trialDays:  'sebt_trial_days',
} as const

export interface SebtConfig {
  /** Batch number shown on the pages and stamped on each signup. */
  batch: number
  /** Are /register/sebtnext and /login/sebtnext live right now? */
  registrationOpen: boolean
  /** Do new SEBT signups get the free Enterprise grant? */
  trialEnabled: boolean
  /** Length of that grant, in days. */
  trialDays: number
}

/** Used before an admin has saved anything: closed, so no link is live by accident. */
export const SEBT_DEFAULTS: SebtConfig = {
  batch: 1,
  registrationOpen: false,
  trialEnabled: true,
  trialDays: 7,
}

export const SEBT_LIMITS = { minBatch: 1, maxBatch: 9999, minDays: 1, maxDays: 365 } as const

const CACHE_KEY = 'sebt:config'
// Signup pages are force-dynamic, so without this every page view is 4 reads.
// Short enough that flipping the toggle feels immediate.
const CACHE_TTL_S = 20

export function clampBatch(n: unknown): number {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v)) return SEBT_DEFAULTS.batch
  return Math.min(SEBT_LIMITS.maxBatch, Math.max(SEBT_LIMITS.minBatch, v))
}

export function clampDays(n: unknown): number {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v)) return SEBT_DEFAULTS.trialDays
  return Math.min(SEBT_LIMITS.maxDays, Math.max(SEBT_LIMITS.minDays, v))
}

/** Live config, cached briefly per worker. Falls back to a closed batch if Mongo is down. */
export async function getSebtConfig(): Promise<SebtConfig> {
  const hit = memCache.get<SebtConfig>(CACHE_KEY)
  if (hit) return hit
  try {
    await connectDB()
    const rows = await AppSetting.find({ key: { $in: Object.values(SEBT_KEYS) } })
      .lean<{ key: string; bool?: boolean; num?: number }[]>()
    const by = new Map(rows.map(r => [r.key, r]))
    const cfg: SebtConfig = {
      batch:            clampBatch(by.get(SEBT_KEYS.batch)?.num ?? SEBT_DEFAULTS.batch),
      registrationOpen: by.get(SEBT_KEYS.open)?.bool ?? SEBT_DEFAULTS.registrationOpen,
      trialEnabled:     by.get(SEBT_KEYS.trialOn)?.bool ?? SEBT_DEFAULTS.trialEnabled,
      trialDays:        clampDays(by.get(SEBT_KEYS.trialDays)?.num ?? SEBT_DEFAULTS.trialDays),
    }
    memCache.set(CACHE_KEY, cfg, CACHE_TTL_S)
    return cfg
  } catch {
    // Never leave the link open on an error: a closed page is recoverable, an
    // accidentally-open batch handing out free Enterprise plans is not.
    return { ...SEBT_DEFAULTS, registrationOpen: false }
  }
}

/** Write any subset of the config and return the saved result. */
export async function setSebtConfig(patch: Partial<SebtConfig>): Promise<SebtConfig> {
  await connectDB()
  const writes: Promise<unknown>[] = []
  const put = (key: string, value: { bool?: boolean; num?: number }) =>
    writes.push(AppSetting.updateOne({ key }, { $set: value }, { upsert: true }))

  if (patch.batch !== undefined)            put(SEBT_KEYS.batch,     { num: clampBatch(patch.batch) })
  if (patch.registrationOpen !== undefined) put(SEBT_KEYS.open,      { bool: !!patch.registrationOpen })
  if (patch.trialEnabled !== undefined)     put(SEBT_KEYS.trialOn,   { bool: !!patch.trialEnabled })
  if (patch.trialDays !== undefined)        put(SEBT_KEYS.trialDays, { num: clampDays(patch.trialDays) })

  await Promise.all(writes)
  memCache.delete(CACHE_KEY)
  return getSebtConfig()
}

/** True while the SEBT signup/login links are open. */
export async function sebtBatchOpen(): Promise<boolean> {
  return (await getSebtConfig()).registrationOpen
}

/** Batch label for UI copy, e.g. "Batch 2". */
export function sebtBatchName(batch: number): string {
  return `Batch ${batch}`
}

/** The fields to set on a new SEBT signup, or null when no grant applies. */
export function sebtGrantFields(cfg: SebtConfig): { plan: 'enterprise'; compExpiresAt: Date; sebtStudent: true; sebtBatch: number } | { sebtStudent: true; sebtBatch: number } {
  const base = { sebtStudent: true as const, sebtBatch: cfg.batch }
  if (!cfg.trialEnabled) return base
  return { ...base, plan: 'enterprise' as const, compExpiresAt: new Date(Date.now() + cfg.trialDays * 24 * 60 * 60 * 1000) }
}
