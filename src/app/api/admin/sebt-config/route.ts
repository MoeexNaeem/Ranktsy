import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, LocalPayment } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { getSebtConfig, setSebtConfig, clampBatch, clampDays, isSebtTrialPlan, sebtCreditFields, type SebtConfig } from '@/lib/sebt'
import { PLAN_LABELS } from '@/lib/plans'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ConfigPayload extends SebtConfig {
  /** Students carrying the batch number currently set. */
  batchStudents: number
  /** Everyone who ever signed up through a SEBT link. */
  totalStudents: number
  /** How many of those still have live free credits (or an older plan grant). */
  activeTrials: number
  /** Batch numbers already used, newest first, so an admin doesn't reuse one. */
  usedBatches: number[]
}

async function guard() {
  const auth = await getCurrentUser()
  if (!auth) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) }
  if (!isAdmin(auth)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  return { auth }
}

async function payload(): Promise<ConfigPayload> {
  const cfg = await getSebtConfig()
  await connectDB()
  const [batchStudents, totalStudents, activeTrials, usedBatches] = await Promise.all([
    User.countDocuments({ sebtStudent: true, sebtBatch: cfg.batch }),
    User.countDocuments({ sebtStudent: true }),
    User.countDocuments({ sebtStudent: true, $or: [{ sebtCreditsExpiresAt: { $gt: new Date() } }, { compExpiresAt: { $gt: new Date() } }] }),
    User.distinct('sebtBatch', { sebtStudent: true, sebtBatch: { $ne: null } }) as Promise<number[]>,
  ])
  return { ...cfg, batchStudents, totalStudents, activeTrials, usedBatches: usedBatches.sort((a, b) => b - a) }
}

/** Current SEBT config plus the counts the panel shows. */
export async function GET(): Promise<NextResponse<ApiResponse<ConfigPayload>>> {
  const g = await guard(); if (g.error) return g.error
  try {
    return NextResponse.json({ success: true, data: await payload() })
  } catch (e) {
    console.error('[Admin] sebt-config GET:', e)
    return NextResponse.json({ success: false, error: 'Could not load SEBT settings.' }, { status: 500 })
  }
}

/**
 * Save settings, or run a bulk grant.
 *   { batch?, registrationOpen?, trialEnabled?, trialDays?, trialPlan? }  → save
 *   { applyToAll: true, scope?: 'batch' | 'all', days? }      → give free credits now
 *   { endTrials: true }                                        → end every live trial now
 *
 * The bulk grant is deliberately a separate, explicit action rather than a side
 * effect of flipping the toggle: it rewrites the plan on live accounts, and an
 * admin editing the day count should not mass-extend everyone by accident.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ConfigPayload & { affected?: number }>>> {
  const g = await guard(); if (g.error) return g.error
  const body = await req.json().catch(() => ({}))

  try {
    // End every live SEBT trial now (instead of waiting for each one's own end date).
    // Skips anyone who paid: a real Lemon Squeezy subscription, or an approved local
    // payment that is still running. Ended students see the one-time "plan expired"
    // popup, exactly as if the trial had run out on its own.
    if (body?.endTrials) {
      await connectDB()
      const now = new Date()
      // Free credits (the current kind of grant) simply stop counting.
      const credits = await User.updateMany(
        { sebtStudent: true, sebtCreditsExpiresAt: { $gt: now } },
        { $set: { sebtCreditsExpiresAt: now } },
      )
      const paidLocally = await LocalPayment.distinct('userId', { status: 'approved', grantedUntil: { $gt: now } }) as string[]
      const r = await User.updateMany(
        {
          sebtStudent: true,
          plan: { $ne: 'free' },
          compExpiresAt: { $gt: now },
          lsSubscriptionId: null,
          subscriptionStatus: { $nin: ['active', 'on_trial'] },
          _id: { $nin: paidLocally },
        },
        [{ $set: {
          lastExpiredPlan: '$plan',
          planExpiredAt: '$$NOW',
          planExpiryNoticeSeen: false,
          plan: 'free',
          compExpiresAt: null,
        } }],
        { updatePipeline: true },   // Mongoose 9 rejects update pipelines without this
      )
      return NextResponse.json({ success: true, data: { ...(await payload()), affected: (r.modifiedCount ?? 0) + (credits.modifiedCount ?? 0) } })
    }

    if (body?.applyToAll) {
      const cfg = await getSebtConfig()
      if (!cfg.trialEnabled) {
        return NextResponse.json({ success: false, error: `Turn the free ${PLAN_LABELS[cfg.trialPlan]} credits on before granting them.` }, { status: 400 })
      }
      await connectDB()
      const scope = body.scope === 'batch' ? { sebtBatch: cfg.batch } : {}
      // Free credits are ADDED to each student's own plan (their plan is never
      // changed), so paying students get them too: a Pro buyer sees 120 + 60 free.
      // `days` is chosen in the grant dialog; it starts from now for everyone.
      const days = body.days !== undefined ? clampDays(body.days) : cfg.trialDays
      const r = await User.updateMany(
        { sebtStudent: true, ...scope },
        { $set: sebtCreditFields(cfg.trialPlan, days) },
      )
      return NextResponse.json({ success: true, data: { ...(await payload()), affected: r.modifiedCount ?? 0 } })
    }

    const patch: Partial<SebtConfig> = {}
    if (body?.batch !== undefined)            patch.batch = clampBatch(body.batch)
    if (body?.registrationOpen !== undefined) patch.registrationOpen = !!body.registrationOpen
    if (body?.trialEnabled !== undefined)     patch.trialEnabled = !!body.trialEnabled
    if (body?.trialDays !== undefined)        patch.trialDays = clampDays(body.trialDays)
    if (body?.trialPlan !== undefined) {
      if (!isSebtTrialPlan(body.trialPlan)) return NextResponse.json({ success: false, error: 'Unknown plan.' }, { status: 400 })
      patch.trialPlan = body.trialPlan
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ success: false, error: 'Nothing to update.' }, { status: 400 })
    }
    await setSebtConfig(patch)
    return NextResponse.json({ success: true, data: await payload() })
  } catch (e) {
    console.error('[Admin] sebt-config POST:', e)
    return NextResponse.json({ success: false, error: 'Could not save SEBT settings.' }, { status: 500 })
  }
}
