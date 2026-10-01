import { connectDB } from '@/lib/db'
import { AppSetting, User } from '@/lib/models'
import { resolveRole } from '@/lib/auth/roles'

/**
 * Maintenance mode: an admin switch that takes the whole site offline for
 * everyone except admins. Visitors see /maintenance (HTTP 503 + Retry-After, so
 * search engines treat it as temporary), every non-admin API call gets a 503 JSON
 * answer, and the Etsy-spending cron jobs pause. With no user traffic the Etsy /
 * Google quotas get time to recover while fixes are deployed.
 *
 * The flag lives in Mongo (AppSetting `maintenance`) so it applies to every PM2
 * worker. The proxy runs on EVERY request, so it reads a short in-process cache
 * instead of the database; a toggle reaches all workers within CACHE_MS.
 */
export const MAINTENANCE_KEY = 'maintenance'
const CACHE_MS = 5_000

export const DEFAULT_MAINTENANCE_MESSAGE =
  'We are fixing and updating a few things to make Rankkw faster and more reliable. This can take a few hours. Thank you for your patience, we will be back soon.'

export interface MaintenanceState {
  on: boolean
  message: string
  since: string | null   // ISO, when it was switched on
  by: string | null      // admin email who switched it
}

const OFF: MaintenanceState = { on: false, message: DEFAULT_MAINTENANCE_MESSAGE, since: null, by: null }

// One cache per process (Next bundles this into several chunks; globalThis keeps one copy).
const g = globalThis as typeof globalThis & { __rkMaint?: { at: number; state: MaintenanceState; inflight?: Promise<MaintenanceState> } }

async function readFromDb(): Promise<MaintenanceState> {
  await connectDB()
  const doc = await AppSetting.findOne({ key: MAINTENANCE_KEY }).lean<{ bool?: boolean; str?: string }>()
  if (!doc) return OFF
  let extra: Partial<MaintenanceState> = {}
  try { extra = doc.str ? JSON.parse(doc.str) : {} } catch { /* ignore a bad blob */ }
  return {
    on: !!doc.bool,
    message: (typeof extra.message === 'string' && extra.message.trim()) || DEFAULT_MAINTENANCE_MESSAGE,
    since: extra.since ?? null,
    by: extra.by ?? null,
  }
}

/**
 * Current state, cached for CACHE_MS. On a database error it keeps the LAST known
 * state (or OFF on a cold start): a DB blip must never lock every user out, nor
 * silently reopen a site an admin deliberately closed.
 */
export async function getMaintenance(): Promise<MaintenanceState> {
  // Local testing only: the dev server shares the production database, so flipping
  // the real flag from a laptop would close the live site. MAINTENANCE_FORCE=on in
  // .env.development.local simulates it instead. Never honoured in production.
  if (process.env.NODE_ENV !== 'production' && process.env.MAINTENANCE_FORCE === 'on') {
    return { on: true, message: DEFAULT_MAINTENANCE_MESSAGE, since: null, by: 'local test' }
  }
  const c = g.__rkMaint
  if (c && Date.now() - c.at < CACHE_MS) return c.state
  if (c?.inflight) return c.inflight
  const inflight = readFromDb()
    .then(state => { g.__rkMaint = { at: Date.now(), state }; return state })
    .catch(() => { const state = c?.state ?? OFF; g.__rkMaint = { at: Date.now(), state }; return state })
  g.__rkMaint = { at: c?.at ?? 0, state: c?.state ?? OFF, inflight }
  return inflight
}

/** Switch it on/off (admin only - the caller checks). Applies to this worker at once. */
export async function setMaintenance(on: boolean, message: string | undefined, by: string): Promise<MaintenanceState> {
  await connectDB()
  const prev = await readFromDb().catch(() => OFF)
  const state: MaintenanceState = {
    on,
    message: (message ?? '').trim().slice(0, 600) || DEFAULT_MAINTENANCE_MESSAGE,
    // Keep the original start time while it stays on; clear it when switched off.
    since: on ? (prev.on && prev.since ? prev.since : new Date().toISOString()) : null,
    by: on ? by : null,
  }
  await AppSetting.updateOne(
    { key: MAINTENANCE_KEY },
    { $set: { bool: on, str: JSON.stringify({ message: state.message, since: state.since, by: state.by }) } },
    { upsert: true },
  )
  g.__rkMaint = { at: Date.now(), state }
  return state
}

// Admin check for requests that only carry a refresh token (the access token
// expired). Only runs while maintenance is on; cached so it is not a DB hit per request.
const roleCache = new Map<string, { admin: boolean; at: number }>()
export async function isAdminUserId(userId: string): Promise<boolean> {
  const hit = roleCache.get(userId)
  if (hit && Date.now() - hit.at < 60_000) return hit.admin
  try {
    await connectDB()
    const u = await User.findById(userId).select('email role').lean<{ email?: string; role?: 'user' | 'admin' }>()
    const admin = !!u?.email && resolveRole(u.email, u.role) === 'admin'
    roleCache.set(userId, { admin, at: Date.now() })
    return admin
  } catch {
    return false
  }
}
