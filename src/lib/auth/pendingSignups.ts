import { User, OTP } from '@/lib/models'

/**
 * An email/password signup that never confirmed its emailed code. It cannot log in
 * or use anything, so it is kept out of the admin user list and counts, and it is
 * deleted after PENDING_DAYS (fake or mistyped addresses never confirm).
 */
export const PENDING_SIGNUP = { emailVerifyRequired: true, isVerified: false } as const
export const NOT_PENDING_SIGNUP = { $nor: [PENDING_SIGNUP] }
export const PENDING_DAYS = 3

const g = globalThis as typeof globalThis & { __rkPendingSweep?: number }

/** Delete unconfirmed signups older than PENDING_DAYS. Runs at most every 30 min per worker. */
export async function cleanupPendingSignups(): Promise<number> {
  const now = Date.now()
  if (g.__rkPendingSweep && now - g.__rkPendingSweep < 30 * 60_000) return 0
  g.__rkPendingSweep = now
  const cutoff = new Date(now - PENDING_DAYS * 86_400_000)
  const stale = await User.find({ ...PENDING_SIGNUP, createdAt: { $lt: cutoff } }).select('email').limit(2000).lean<{ _id: unknown; email: string }[]>()
  if (!stale.length) return 0
  await User.deleteMany({ _id: { $in: stale.map(u => u._id) }, ...PENDING_SIGNUP })
  await OTP.deleteMany({ email: { $in: stale.map(u => u.email) }, type: 'verify' }).catch(() => null)
  return stale.length
}
