import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { detectExtension } from '@/lib/extension'
import { connectDB } from '@/lib/db'
import {
  CREDIT_COST, alreadyPaidToday, canAfford, claimPaidToday, unclaimPaidToday, consumeCredits,
  paidKeyFor, publicState, type CreditState,
} from '@/lib/credits'
import { recordCredits } from '@/lib/usage'
import { PLAN_LABELS } from '@/lib/plans'

/**
 * SERVER-side credit metering for a route that belongs to exactly ONE tool.
 *
 * The browser used to charge these tools itself (check -> search -> commit), so a
 * script could call the data route directly and never pay. Here the route charges:
 *
 *   const meter = await meterSearch(req, 'hotproducts', key)
 *   if (meter.deny) return meter.deny            // 402 credit_limit, before any Etsy work
 *   ...do the work...
 *   const state = usable ? await meter.commit() : undefined   // charge ONLY on success
 *   return NextResponse.json({ success: true, data, state })
 *
 * Same rules as Keyword Search: 1 credit per search, charged only for a usable
 * result, and the same search (key) is free for the rest of the UTC day. Admins
 * and the extension's passive lookups are never charged. The client reads `state`
 * from any response (global axios interceptor) to update the credits pill.
 *
 * Only use this on routes that serve ONE tool: on shared routes the server cannot
 * tell a new search from a detail-panel view without trusting the client.
 */
export interface Meter {
  deny: NextResponse | null
  commit: () => Promise<CreditState | undefined>
}

const FREE: Meter = { deny: null, commit: async () => undefined }

export async function meterSearch(req: NextRequest, tool: string, rawKey: string): Promise<Meter> {
  const user = await getCurrentUser().catch(() => null)
  if (!user || isAdmin(user)) return FREE
  const ext = detectExtension(req)
  if (ext.isExt && req.nextUrl.searchParams.get('intent') !== 'search') return FREE

  const paidKey = paidKeyFor(tool, rawKey)
  await connectDB()
  if (paidKey && await alreadyPaidToday(user.id, paidKey)) return FREE

  const afford = await canAfford(user.id, CREDIT_COST)
  if (afford && !afford.ok) {
    return {
      deny: NextResponse.json({
        success: false, code: 'credit_limit', plan: afford.plan, state: publicState(afford),
        error: `You've used all ${afford.limit} of today's credits on the ${PLAN_LABELS[afford.plan]} plan. Upgrade for a higher daily allowance, or come back tomorrow.`,
      }, { status: 402 }),
      commit: async () => undefined,
    }
  }

  return {
    deny: null,
    commit: async () => {
      // Atomic claim first: two identical requests racing can only charge once.
      if (paidKey && !(await claimPaidToday(user.id, paidKey))) return undefined
      const res = await consumeCredits(user.id, CREDIT_COST).catch(() => null)
      if (!res?.allowed) {
        if (paidKey) await unclaimPaidToday(user.id, paidKey)
        return res ? publicState(res) : undefined
      }
      recordCredits(CREDIT_COST)
      return publicState(res)
    },
  }
}
