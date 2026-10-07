import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, KeywordHistory, OTP } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin, resolveRole } from '@/lib/auth/roles'
import { parseUserFilters, buildUserFilter } from '@/lib/admin/userFilters'
import { rememberDeletedTempAccounts } from '@/lib/auth/deletedAccounts'
import { logFromRequest } from '@/lib/security/events'
import { checkDangerPassword } from '@/lib/admin/dangerPassword'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PER_ACTION = 5000

/**
 * Bulk delete from the admin Users list. Targets either the ticked rows (`ids`) or
 * every user matching the list's current filters (`filters`, recomputed here so it
 * is exactly what the list shows). Never touches: the admin doing it, any admin
 * account, or a customer paying through Lemon Squeezy. Same cleanup as the single
 * Delete (user + search history), plus any pending email codes.
 *
 * Body: { action: 'delete', ids?: string[], filters?: {...}, expected: number, password: string }
 * `expected` must equal the count the admin confirmed, so a list that changed in
 * the meantime can't delete more than they saw.
 */
export async function POST(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { action?: string; ids?: unknown; filters?: Record<string, unknown>; expected?: number; password?: unknown }
  if (body.action !== 'delete') return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })

  // Bulk delete also needs the admin danger password (checked here, never on the client).
  const pw = await checkDangerPassword(req, auth, body.password)
  if (!pw.ok) return NextResponse.json({ success: false, code: 'password', error: pw.error }, { status: pw.status })

  await connectDB()
  let target: Record<string, unknown>
  if (Array.isArray(body.ids)) {
    const ids = body.ids.map(String).filter(id => /^[a-f0-9]{24}$/i.test(id)).slice(0, MAX_PER_ACTION)
    if (!ids.length) return NextResponse.json({ success: false, error: 'No users selected' }, { status: 400 })
    target = { _id: { $in: ids } }
  } else if (body.filters && typeof body.filters === 'object') {
    target = await buildUserFilter(parseUserFilters(body.filters))
  } else {
    return NextResponse.json({ success: false, error: 'Nothing selected' }, { status: 400 })
  }

  const rows = await User.find(target).select('email role lsSubscriptionId plan').limit(MAX_PER_ACTION + 1)
    .lean<{ _id: unknown; email: string; role?: 'user' | 'admin'; lsSubscriptionId?: string | null; plan?: string }[]>()
  if (rows.length > MAX_PER_ACTION) {
    return NextResponse.json({ success: false, error: `More than ${MAX_PER_ACTION} users match. Narrow the filters first.` }, { status: 400 })
  }
  if (typeof body.expected === 'number' && body.expected !== rows.length) {
    return NextResponse.json({ success: false, error: `The list changed (${rows.length} users now match, you confirmed ${body.expected}). Refresh and try again.` }, { status: 409 })
  }

  const skipped = { self: 0, admin: 0, paying: 0 }
  const del: typeof rows = []
  for (const u of rows) {
    if (String(u._id) === auth.id) { skipped.self++; continue }
    if (resolveRole(u.email, u.role) === 'admin') { skipped.admin++; continue }
    if (u.lsSubscriptionId && u.plan && u.plan !== 'free') { skipped.paying++; continue }
    del.push(u)
  }

  const ids = del.map(u => u._id)
  const r = ids.length ? await User.deleteMany({ _id: { $in: ids } }) : { deletedCount: 0 }
  if (ids.length) {
    await KeywordHistory.deleteMany({ userId: { $in: ids.map(String) } }).catch(() => {})
    await OTP.deleteMany({ email: { $in: del.map(u => u.email) } }).catch(() => {})
    await rememberDeletedTempAccounts(del.map(u => u.email))
  }
  console.warn(`[admin] ${auth.email} bulk-deleted ${r.deletedCount} users (skipped ${JSON.stringify(skipped)})`)
  logFromRequest('admin_action', req, { userId: auth.id, email: auth.email, detail: `bulk-deleted ${r.deletedCount} users${body.filters ? ` (filters ${JSON.stringify(body.filters).slice(0, 150)})` : ''}` })
  return NextResponse.json({ success: true, data: { deleted: r.deletedCount ?? 0, skipped } })
}
