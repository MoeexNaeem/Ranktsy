import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { comparePassword } from '@/lib/auth/password'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setAuthCookies } from '@/lib/auth/cookies'
import { loginSchema } from '@/lib/auth/schemas'
import { resolveRole } from '@/lib/auth/roles'
import type { ApiResponse, AuthUser } from '@/types'

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AuthUser>>> {
  try {
    const body   = await req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((e: import("zod").ZodIssue) => { errors[e.path[0] as string] = e.message })
      return NextResponse.json({ success: false, errors }, { status: 422 })
    }

    const { email, password } = parsed.data
    await connectDB()

    const user = await User.findOne({ email }).select('+password').lean()
    if (!user) {
      return NextResponse.json({ success: false, errors: { email: 'No account found with this email' } }, { status: 401 })
    }

    const valid = await comparePassword(password, user.password)
    if (!valid) {
      return NextResponse.json({ success: false, errors: { password: 'Incorrect password' } }, { status: 401 })
    }

    const authUser: AuthUser = { id: user._id.toString(), name: user.name, email: user.email, role: resolveRole(user.email, user.role), plan: user.plan, isVerified: user.isVerified, etsyShopId: user.etsyShopId }
    const [at, rt] = await Promise.all([signAccessToken(authUser), signRefreshToken(authUser.id)])
    await setAuthCookies(at, rt)

    return NextResponse.json({ success: true, data: authUser })
  } catch (err) {
    console.error('[Login]', err)
    return NextResponse.json({ success: false, error: 'Server error. Please try again.' }, { status: 500 })
  }
}
