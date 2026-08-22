import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { connectDB } from '@/lib/db'
import { AutomationRun, type IAutomationRun } from '@/lib/models'
import { serializeRun } from '@/lib/automation/serialize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await connectDB()
  const run = await AutomationRun.findOne({ _id: id, userId: user.id }).lean<IAutomationRun & { _id: unknown }>()
  if (!run) return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: serializeRun(run) })
}
