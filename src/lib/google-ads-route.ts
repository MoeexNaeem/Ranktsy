/**
 * Shared wrapper for Google Ads management API routes: login + access gate, the
 * selected account with a fresh token, optional zod body parsing, cache invalidation
 * after changes, and consistent error responses.
 */
import { NextResponse } from 'next/server'
import type { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { memCache } from '@/lib/cache'
import { canUseGoogleAdsManager, requireSelectedAccount, adsErrorResponse } from '@/lib/google-ads-user'
import type { IGoogleAdsAccountRef } from '@/lib/models'
import type { AuthUser } from '@/types'

export interface AdsCtx { user: AuthUser; token: string; account: IGoogleAdsAccountRef }

export async function adsRoute<T>(
  handler: (ctx: AdsCtx) => Promise<T>,
  opts: { mutates?: boolean } = {},
): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!canUseGoogleAdsManager(user)) return NextResponse.json({ success: false, error: 'Google Ads management is not available for this account yet.' }, { status: 403 })
  try {
    const { token, account } = await requireSelectedAccount(user.id)
    const data = await handler({ user, token, account })
    if (opts.mutates) memCache.deletePrefix(`gads-report:${user.id}:${account.customerId}:`)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    if (e instanceof BodyError) return NextResponse.json({ success: false, error: e.message }, { status: 400 })
    const er = adsErrorResponse(e)
    return NextResponse.json({ success: false, error: er.error, code: er.code }, { status: er.status })
  }
}

export class BodyError extends Error {}

/** Parse a JSON body with a zod schema; throws BodyError (→ 400) with the first issue. */
export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new BodyError(parsed.error.issues[0]?.message ?? 'Please check the form.')
  return parsed.data
}
