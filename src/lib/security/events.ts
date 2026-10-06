import mongoose from 'mongoose'
import type { NextRequest } from 'next/server'
import { connectDB } from '@/lib/db'
import { SECURITY_EVENTS, type SecurityEventType } from './catalog'

/**
 * Security event log for the admin Security section.
 *
 * Events are grouped per (type, IP, email, minute): an attack sending thousands
 * of requests becomes a handful of rows with a count, so logging can never flood
 * the database. Writes are fire-and-forget and never slow or break a request.
 * Kept 30 days (TTL).
 */
export interface SecurityEventDoc {
  _id: string
  type: SecurityEventType
  severity: string
  category: string
  ip: string
  userId: string | null
  email: string | null
  path: string | null
  detail: string | null
  ua: string | null
  country: string | null
  count: number
  first: Date
  last: Date
}

let indexed = false
export async function securityCollection() {
  await connectDB()
  const c = mongoose.connection.db!.collection<SecurityEventDoc>('securityevents')
  if (!indexed) {
    indexed = true
    Promise.all([
      c.createIndex({ last: 1 }, { expireAfterSeconds: 30 * 86_400 }),
      c.createIndex({ ip: 1, last: -1 }),
      c.createIndex({ type: 1, last: -1 }),
      c.createIndex({ email: 1, last: -1 }),
    ]).catch(() => { indexed = false })
  }
  return c
}

export interface EventContext {
  ip?: string | null
  userId?: string | null
  email?: string | null
  path?: string | null
  detail?: string | null
  ua?: string | null
  country?: string | null
}

/** Who/where from a request: real IP (Cloudflare), country, browser, path. */
export function requestContext(req: NextRequest | Request): EventContext {
  const h = req.headers
  const ip = h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  let path: string | null = null
  try { path = new URL(req.url).pathname } catch { /* ignore */ }
  return { ip, country: h.get('cf-ipcountry'), ua: (h.get('user-agent') || '').slice(0, 200) || null, path }
}

/** Record one event. Never throws; callers don't wait for it. */
export function logSecurityEvent(type: SecurityEventType, ctx: EventContext): void {
  const info = SECURITY_EVENTS[type]
  const now = new Date()
  const ip = (ctx.ip || 'unknown').slice(0, 64)
  const email = ctx.email ? ctx.email.toLowerCase().slice(0, 200) : null
  const id = `${type}|${ip}|${email ?? ''}|${now.toISOString().slice(0, 16)}`
  const set: Record<string, unknown> = { last: now }
  const onInsert: Record<string, unknown> = {
    type, severity: info.severity, category: info.category, ip, email,
    ua: ctx.ua ?? null, country: ctx.country ?? null, first: now,
  }
  for (const [k, v] of [['detail', ctx.detail?.slice(0, 300)], ['path', ctx.path?.slice(0, 200)], ['userId', ctx.userId]] as const) {
    if (v) set[k] = v; else onInsert[k] = null
  }
  void securityCollection()
    .then(c => c.updateOne({ _id: id }, { $inc: { count: 1 }, $set: set, $setOnInsert: onInsert }, { upsert: true }))
    .catch(() => { /* logging must never break a request */ })
}

/** Shorthand: log with the request's IP/country/browser/path filled in. */
export function logFromRequest(type: SecurityEventType, req: NextRequest | Request, extra: EventContext = {}): void {
  logSecurityEvent(type, { ...requestContext(req), ...extra })
}
