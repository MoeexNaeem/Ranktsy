import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/db'

/**
 * Liveness / readiness probe. Returns 200 only when the process is up AND the
 * database answers a ping — so an uptime monitor (or nginx upstream health check)
 * can detect a half-dead instance (Node alive but Mongo unreachable) and page you
 * or pull it out of rotation, instead of the failure being invisible until users
 * complain. Intentionally cheap: one admin ping, no app queries.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()
  try {
    await connectDB()
    await mongoose.connection.db?.admin().ping()
    return NextResponse.json({ ok: true, db: 'up', ms: Date.now() - started, pid: process.pid })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, db: 'down', error: message }, { status: 503 })
  }
}
