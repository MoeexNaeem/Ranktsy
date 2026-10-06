import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'

/**
 * Restricted accounts, enforced on the SERVER for every tool request.
 *
 * Restriction used to be checked only by the dashboard (via /api/auth/me), so a
 * restricted user's still-valid login could keep calling the APIs directly from a
 * script. The set of restricted user ids is small; it is read at most every 30 s
 * per worker and kept in memory, so the check costs nothing per request.
 */
type Cache = { at: number; set: Set<string>; inflight?: Promise<Set<string>> }
const g = globalThis as typeof globalThis & { __rkRestricted?: Cache }
const CACHE_MS = 30_000

async function load(): Promise<Set<string>> {
  await connectDB()
  const rows = await User.find({ restricted: true }).select('_id').limit(50_000).lean<{ _id: unknown }[]>()
  return new Set(rows.map(r => String(r._id)))
}

async function restrictedIds(): Promise<Set<string>> {
  const c = g.__rkRestricted
  if (c && Date.now() - c.at < CACHE_MS) return c.set
  if (c?.inflight) return c.inflight
  const inflight = load()
    .then(set => { g.__rkRestricted = { at: Date.now(), set }; return set })
    .catch(() => { const set = c?.set ?? new Set<string>(); g.__rkRestricted = { at: Date.now(), set }; return set })
  g.__rkRestricted = { at: c?.at ?? 0, set: c?.set ?? new Set(), inflight }
  return inflight
}

export async function isUserRestricted(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  return (await restrictedIds()).has(userId)
}

/** Call after restricting / unrestricting so this worker applies it at once. */
export function forgetRestrictedCache(): void { g.__rkRestricted = undefined }

export const RESTRICTED_MESSAGE = 'Your account has been restricted. Please contact Rankkw support.'
