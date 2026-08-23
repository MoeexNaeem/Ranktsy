import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { connectDB } from '@/lib/db'
import { AutomationRun } from '@/lib/models'
import { expandNiche } from '@/lib/automation/orchestrator'

// "Automate Etsy Shop" — create a batch run. HIDDEN / admin-only for now.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const user = await getCurrentUser().catch(() => null)
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }), user: null }
  if (!isAdmin(user)) return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }), user: null }
  return { error: null, user }
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAdmin()
  if (error || !user) return error

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const mode = body.mode === 'niche' ? 'niche' : 'keywords'
  const geo = String(body.geo || 'US').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'US'
  const count = Math.max(1, Math.min(25, Number(body.count) || 5))
  const publishToEtsy = !!body.publishToEtsy
  const taxonomyId = Number(body.taxonomyId) || undefined

  if (publishToEtsy && !taxonomyId) {
    return NextResponse.json({ success: false, error: 'Pick a category before publishing to Etsy.' }, { status: 400 })
  }

  await connectDB()

  let keywords: string[] = []
  if (mode === 'niche') {
    const niche = String(body.niche || '').trim()
    if (niche.length < 2) return NextResponse.json({ success: false, error: 'Enter a niche.' }, { status: 400 })
    keywords = await expandNiche(niche, count, geo)
    if (!keywords.length) return NextResponse.json({ success: false, error: 'Could not generate product ideas. Check the automation AI key, or use keyword mode.' }, { status: 502 })
  } else {
    const seeds = Array.isArray(body.seeds) ? body.seeds : []
    keywords = [...new Set(seeds.map(s => String(s).trim().toLowerCase()).filter(s => s.length >= 2))].slice(0, count)
    if (!keywords.length) return NextResponse.json({ success: false, error: 'Enter at least one keyword (one per line).' }, { status: 400 })
  }

  const items = keywords.map((keyword, idx) => ({ idx, keyword, status: 'pending' as const }))
  const run = await AutomationRun.create({
    userId: user.id,
    status: 'pending',
    mode,
    niche: mode === 'niche' ? String(body.niche || '').trim() : undefined,
    geo,
    publishToEtsy,
    shopId: body.shopId ? String(body.shopId) : undefined,
    taxonomyId,
    listingType: body.listingType === 'download' ? 'download' : 'physical',
    whoMade: (['i_did', 'someone_else', 'collective'] as string[]).includes(String(body.whoMade)) ? (body.whoMade as 'i_did' | 'someone_else' | 'collective') : 'i_did',
    quantity: Math.max(1, Number(body.quantity) || 1),
    options: body.options && typeof body.options === 'object' ? body.options as Record<string, unknown> : undefined,
    items,
  })

  return NextResponse.json({ success: true, data: { id: String(run._id), items: items.length, keywords } })
}
