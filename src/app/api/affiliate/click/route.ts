import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Affiliate, AffiliateLink } from '@/lib/models'
import { rateLimit, clientIp } from '@/lib/auth/rateLimit'
import { REF_COOKIE, REF_COOKIE_MAX_AGE, normalizeCode, codeProblem, resolveReferralCode } from '@/lib/affiliate'

export const runtime = 'nodejs'

// PUBLIC (allowlisted in proxy.ts): a visitor lands on rankkw.com/?ref=CODE and
// the client fires this once. We drop a first-party cookie so attribution
// survives to signup, and count the visit (throttled per code+IP to keep the
// number honest and the DB quiet). Unknown codes are ignored silently.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = normalizeCode(body?.code)
  if (codeProblem(code)) return NextResponse.json({ success: true, tracked: false })

  await connectDB()
  // The code may be an affiliate's default code OR one of their custom links;
  // either way the visit belongs to the affiliate.
  const hit = await resolveReferralCode(code)
  if (!hit) return NextResponse.json({ success: true, tracked: false })

  // Count at most one click per code+IP per hour (visit, not raw page hits).
  const ip = clientIp(req)
  if (rateLimit(`refclick:${code}:${ip}`, 1, 60 * 60 * 1000).allowed) {
    await Affiliate.updateOne({ _id: hit.affiliate._id }, { $inc: { clicks: 1 } }).catch(() => null)
    // Per-link clicks too, so the affiliate can compare their channels.
    if (hit.linkId) await AffiliateLink.updateOne({ _id: hit.linkId }, { $inc: { clicks: 1 } }).catch(() => null)
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
