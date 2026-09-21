import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { getSebtConfig, setSebtConfig, clampBatch, clampDays, type SebtConfig } from '@/lib/sebt'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

interface ConfigPayload extends SebtConfig {
  /** Students carrying the batch number currently set. */
  batchStudents: number
  /** Everyone who ever signed up through a SEBT link. */
  totalStudents: number
  /** How many of those still have a live trial. */
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
    User.countDocuments({ sebtStudent: true, compExpiresAt: { $gt: new Date() } }),
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
 *   { batch?, registrationOpen?, trialEnabled?, trialDays? }  → save
 *   { applyToAll: true, scope?: 'batch' | 'all' }             → (re)grant the trial
 *
 * The bulk grant is deliberately a separate, explicit action rather than a side
 * effect of flipping the toggle: it rewrites the plan on live accounts, and an
 * admin editing the day count should not mass-extend everyone by accident.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ConfigPayload & { affected?: number }>>> {
  const g = await guard(); if (g.error) return g.error
  const body = await req.json().catch(() => ({}))

  try {
    if (body?.applyToAll) {
      const cfg = await getSebtConfig()
      if (!cfg.trialEnabled) {
        return NextResponse.json({ success: false, error: 'Turn the Enterprise trial on before granting it.' }, { status: 400 })
      }
      await connectDB()
      const scope = body.scope === 'batch' ? { sebtBatch: cfg.batch } : {}
      const r = await User.updateMany(
        // Never touch a student who has since bought a real subscription: their
        // paid plan must not be overwritten by a comp grant.
        { sebtStudent: true, ...scope, lsSubscriptionId: null, subscriptionStatus: { $nin: ['active', 'on_trial'] } },
        { $set: { plan: 'enterprise', compExpiresAt: new Date(Date.now() + cfg.trialDays * DAY) } },
      )
      return NextResponse.json({ success: true, data: { ...(await payload()), affected: r.modifiedCount ?? 0 } })
    }

    const patch: Partial<SebtConfig> = {}
    if (body?.batch !== undefined)            patch.batch = clampBatch(body.batch)
    if (body?.registrationOpen !== undefined) patch.registrationOpen = !!body.registrationOpen
    if (body?.trialEnabled !== undefined)     patch.trialEnabled = !!body.trialEnabled
    if (body?.trialDays !== undefined)        patch.trialDays = clampDays(body.trialDays)

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
