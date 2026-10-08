import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

/**
 * Tiny per-day counters (e.g. "listing snapshots written today"), bumped by the code
 * that does the writing. Reading one is a single _id lookup, so the admin never has
 * to count millions of rows to show a "today" number (that count took 60 s+ and
 * timed out on 2026-10-08). Docs: { _id: 'name|YYYY-MM-DD', n, day }, kept 40 days.
 */
interface CounterDoc { _id: string; n: number; at: Date }

let indexed = false
async function counters() {
  await connectDB()
  const c = mongoose.connection.db!.collection<CounterDoc>('dailycounters')
  if (!indexed) {
    indexed = true
    c.createIndex({ at: 1 }, { expireAfterSeconds: 40 * 86_400 }).catch(() => { indexed = false })
  }
  return c
}

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10)

/** Add `by` to today's (UTC) counter. Fire-and-forget; never throws. */
export function bumpDaily(name: string, by: number): void {
  if (!by) return
  const day = utcDay()
  void counters()
    .then(c => c.updateOne({ _id: `${name}|${day}` }, { $inc: { n: by }, $setOnInsert: { at: new Date(`${day}T00:00:00Z`) } }, { upsert: true }))
    .catch(() => { /* a counter must never break the write it counts */ })
}

/** Today's (UTC) value, or null when nothing has been counted yet today. */
export async function readDaily(name: string): Promise<number | null> {
  const c = await counters()
  const doc = await c.findOne({ _id: `${name}|${utcDay()}` })
  return doc ? doc.n : null
}

/**
 * True for the FIRST caller today (UTC) across every PM2 worker, false after that.
 * One tiny insert on a unique _id. Used so per-day work (e.g. recording a searched
 * keyword's listings for tracking) runs once a day for the site, not once per worker.
 */
export async function claimOncePerDay(name: string): Promise<boolean> {
  const day = utcDay()
  try {
    const c = await counters()
    await c.insertOne({ _id: `once|${name}|${day}`, n: 1, at: new Date(`${day}T00:00:00Z`) })
    return true
  } catch (e) {
    if ((e as { code?: number })?.code === 11000) return false
    return true   // bookkeeping failed for another reason: do the work as before
  }
}
