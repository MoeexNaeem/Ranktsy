import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AutomationRun, type IAutomationRun } from '@/lib/models'
import { serializeRun } from '@/lib/automation/serialize'
import { requireAutomationUser } from '@/lib/automation/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAutomationUser()
  if (error || !user) return error

  const { id } = await params
  await connectDB()
  const run = await AutomationRun.findOne({ _id: id, userId: user.id }).lean<IAutomationRun & { _id: unknown }>()
  if (!run) return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: serializeRun(run) })
}
