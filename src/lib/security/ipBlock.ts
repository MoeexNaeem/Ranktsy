import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

/**
 * Blocked IP addresses, enforced in the proxy on every request (pages and API).
 * The list is read from Mongo at most every 30 s per worker and kept in memory,
 * so checking costs nothing per request. A block can expire on its own.
 */
export interface IpBlockDoc { _id: string; reason: string; by: string; at: Date; until: Date | null }

type Cache = { at: number; set: Set<string>; inflight?: Promise<Set<string>> }
const g = globalThis as typeof globalThis & { __rkIpBlocks?: Cache }
const CACHE_MS = 30_000

async function col() {
  await connectDB()
  return mongoose.connection.db!.collection<IpBlockDoc>('ipblocks')
}

async function load(): Promise<Set<string>> {
  const now = new Date()
  const rows = await (await col()).find({ $or: [{ until: null }, { until: { $gt: now } }] }).project({ _id: 1 }).toArray()
  return new Set(rows.map(r => String(r._id)))
}

/** Current blocked set (cached). On a DB error keeps the last known list. */
export async function blockedIps(): Promise<Set<string>> {
  const c = g.__rkIpBlocks
  if (c && Date.now() - c.at < CACHE_MS) return c.set
  if (c?.inflight) return c.inflight
  const inflight = load()
    .then(set => { g.__rkIpBlocks = { at: Date.now(), set }; return set })
    .catch(() => { const set = c?.set ?? new Set<string>(); g.__rkIpBlocks = { at: Date.now(), set }; return set })
  g.__rkIpBlocks = { at: c?.at ?? 0, set: c?.set ?? new Set(), inflight }
  return inflight
}

export async function isIpBlocked(ip: string | null | undefined): Promise<boolean> {
  if (!ip || ip === 'unknown') return false
  return (await blockedIps()).has(ip)
}

export async function blockIp(ip: string, reason: string, by: string, hours?: number | null): Promise<void> {
  const until = hours && hours > 0 ? new Date(Date.now() + hours * 3_600_000) : null
  await (await col()).updateOne({ _id: ip }, { $set: { reason: reason.slice(0, 300), by, at: new Date(), until } }, { upsert: true })
  g.__rkIpBlocks = undefined   // this worker sees it at once; others within 30 s
}

export async function unblockIp(ip: string): Promise<void> {
  await (await col()).deleteOne({ _id: ip })
  g.__rkIpBlocks = undefined
}

export async function listIpBlocks(): Promise<IpBlockDoc[]> {
  return (await col()).find({}).sort({ at: -1 }).limit(500).toArray()
}
