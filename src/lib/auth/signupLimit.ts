import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

/**
 * New email/password accounts per internet connection (IP) per day, shared by all
 * server workers (Mongo). Stops one person making account after account for the
 * free daily credits (2026-10-07: 4 accounts in 5 minutes). SEBT classroom
 * signups are exempt: a whole class shares one connection.
 */
export const SIGNUPS_PER_IP_PER_DAY = Number(process.env.SIGNUPS_PER_IP_PER_DAY) || 3

type Doc = { _id: string; n: number; at: Date }
let indexed = false

async function col() {
  await connectDB()
  const c = mongoose.connection.db!.collection<Doc>('signuplimits')
  if (!indexed) { indexed = true; c.createIndex({ at: 1 }, { expireAfterSeconds: 2 * 86_400 }).catch(() => { indexed = false }) }
  return c
}
const keyFor = (ip: string) => `${ip}|${new Date().toISOString().slice(0, 10)}`

/** Accounts already created from this IP today. 0 if the store is unavailable. */
export async function signupsToday(ip: string): Promise<number> {
  try { return (await (await col()).findOne({ _id: keyFor(ip) }))?.n ?? 0 } catch { return 0 }
}

/** Count one new account for this IP. */
export async function recordSignup(ip: string): Promise<void> {
  try { await (await col()).updateOne({ _id: keyFor(ip) }, { $inc: { n: 1 }, $set: { at: new Date() } }, { upsert: true }) } catch { /* best effort */ }
}
