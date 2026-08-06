import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { rateLimit, clientIp } from '@/lib/auth/rateLimit'

// Live "is this email already registered?" check for the signup form. Returns
// { valid, exists } — `valid:false` means it isn't a well-formed email yet, so
// the form shows neither the green nor the red state.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const emailSchema = z.string().email().max(200)

export async function GET(req: NextRequest) {
  // Throttle so the existence check can't be scraped to enumerate accounts.
  const rl = rateLimit(`checkemail:ip:${clientIp(req)}`, 30, 60 * 1000)
  if (!rl.allowed) return NextResponse.json({ valid: false, exists: false }, { status: 429 })

  const raw = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? ''
  const parsed = emailSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ valid: false, exists: false })

  try {
    await connectDB()
    const exists = await User.exists({ email: parsed.data })
    return NextResponse.json({ valid: true, exists: Boolean(exists) })
  } catch (err) {
    console.error('[check-email]', err)
    // On error, don't block signup — report "unknown" as not-taken; the register
    // endpoint still enforces uniqueness authoritatively.
    return NextResponse.json({ valid: true, exists: false })
  }
}
