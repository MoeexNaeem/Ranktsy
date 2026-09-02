import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Affiliate } from '@/lib/models'
import { rateLimit, clientIp } from '@/lib/auth/rateLimit'
import { REF_COOKIE, REF_COOKIE_MAX_AGE } from '@/lib/affiliate'

export const runtime = 'nodejs'

// PUBLIC (allowlisted in proxy.ts): a visitor lands on rankkw.com/?ref=CODE and
// the client fires this once. We drop a first-party cookie so attribution
// survives to signup, and count the visit (throttled per code+IP to keep the
// number honest and the DB quiet). Unknown codes are ignored silently.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = String(body?.code ?? '').trim().toLowerCase()
  if (!code || code.length > 40 || !/^[a-z0-9]+$/.test(code)) {
    return NextResponse.json({ success: true, tracked: false })
  }

  await connectDB()
  const affiliate = await Affiliate.findOne({ code, status: 'active' }).select('_id').lean()
  if (!affiliate) return NextResponse.json({ success: true, tracked: false })

  // Count at most one click per code+IP per hour (visit, not raw page hits).
  const ip = clientIp(req)
  if (rateLimit(`refclick:${code}:${ip}`, 1, 60 * 60 * 1000).allowed) {
    await Affiliate.updateOne({ code }, { $inc: { clicks: 1 } }).catch(() => null)
  }

  const res = NextResponse.json({ success: true, tracked: true })
  res.cookies.set(REF_COOKIE, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REF_COOKIE_MAX_AGE,
  })
  return res
}
