import bcrypt from 'bcryptjs'
import { securityCollection, logFromRequest } from '@/lib/security/events'
import type { NextRequest } from 'next/server'

/**
 * Extra password for destructive admin actions (bulk delete). Checked on the
 * server only; the client never knows the value. Only a bcrypt hash lives here;
 * set ADMIN_DANGER_PASSWORD_HASH to change it without a code change.
 *
 * Wrong guesses are logged as security events and, after MAX_FAILS within
 * WINDOW_MS for one admin, the action is locked until the window passes. The
 * count comes from Mongo, so every PM2 worker sees the same lockout.
 */
const DEFAULT_HASH = '$2b$12$KZpJOLI2CsiJ1tOWJnIQoez/.f7hyt9D6ubnrudDFNfybLICSOW2y'
const MAX_FAILS = 5
const WINDOW_MS = 15 * 60_000

export type DangerCheck = { ok: true } | { ok: false; status: number; error: string }

export async function checkDangerPassword(req: NextRequest, admin: { id: string; email: string }, password: unknown): Promise<DangerCheck> {
  const col = await securityCollection()
  const since = new Date(Date.now() - WINDOW_MS)
  const [agg] = await col.aggregate<{ n: number }>([
    { $match: { type: 'danger_password_wrong', userId: admin.id, last: { $gte: since } } },
    { $group: { _id: null, n: { $sum: '$count' } } },
  ]).toArray()
  if ((agg?.n ?? 0) >= MAX_FAILS) {
    return { ok: false, status: 429, error: 'Too many wrong passwords. Bulk delete is locked for 15 minutes.' }
  }
  const hash = process.env.ADMIN_DANGER_PASSWORD_HASH?.trim() || DEFAULT_HASH
  const good = typeof password === 'string' && password.length > 0 && password.length <= 200 && await bcrypt.compare(password, hash)
  if (!good) {
    logFromRequest('danger_password_wrong', req, { userId: admin.id, email: admin.email, detail: 'wrong bulk-delete password' })
    const left = Math.max(0, MAX_FAILS - (agg?.n ?? 0) - 1)
    return { ok: false, status: 403, error: left ? `Wrong password. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Wrong password. Bulk delete is now locked for 15 minutes.' }
  }
  return { ok: true }
}
