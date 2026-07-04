import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { hashPassword } from '@/lib/auth/password'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import { sendWelcomeEmail } from '@/lib/auth/email'
import { registerSchema } from '@/lib/auth/schemas'
import { resolveRole } from '@/lib/auth/roles'
import type { ApiResponse, AuthUser } from '@/types'

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AuthUser>>> {
  try {
    const body   = await req.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((e: import("zod").ZodIssue) => { errors[e.path[0] as string] = e.message })
      return NextResponse.json({ success: false, errors }, { status: 422 })
    }

    const { name, email, password } = parsed.data
    await connectDB()

    const exists = await User.findOne({ email }).lean()
    if (exists) {
      return NextResponse.json({ success: false, errors: { email: 'An account with this email already exists' } }, { status: 409 })
    }

    const hashed  = await hashPassword(password)
    const role    = resolveRole(email)
    const user    = await User.create({ name, email, password: hashed, role })
    const authUser: AuthUser = { id: user._id.toString(), name: user.name, email: user.email, role, plan: user.plan, isVerified: user.isVerified }

    const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(authUser.id)])
    await setAuthCookies(at, rt)
    sendWelcomeEmail(email, name).catch(console.error)

    return NextResponse.json({ success: true, data: authUser }, { status: 201 })
  } catch (err) {
    console.error('[Register]', err)
    return NextResponse.json({ success: false, error: 'Server error. Please try again.' }, { status: 500 })
  }
}
