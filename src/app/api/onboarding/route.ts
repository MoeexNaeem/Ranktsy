import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User, ConnectedShop, KeywordHistory } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

// Onboarding progress, derived entirely from the user's real activity (no new state to
// track): first search, first saved keyword, connected shop, and any AI/credit tool use.
export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })

  await connectDB()
  const [u, shop, searched] = await Promise.all([
    User.findById(auth.id).select('savedKeywords searchCount creditsUsedTotal listingImageCount').lean<{ savedKeywords?: string[]; searchCount?: number; creditsUsedTotal?: number; listingImageCount?: number }>(),
    ConnectedShop.exists({ userId: auth.id }),
    KeywordHistory.exists({ userId: auth.id }),
  ])

  const steps = [
    { id: 'search', label: 'Run your first keyword search', done: !!searched || (u?.searchCount ?? 0) > 0, tab: 'keywords' },
    { id: 'save',   label: 'Save a keyword to a list',       done: (u?.savedKeywords?.length ?? 0) > 0, tab: 'lists' },
    { id: 'shop',   label: 'Connect your Etsy shop',         done: !!shop, tab: 'myshop' },
    { id: 'ai',     label: 'Try an AI tool',                 done: (u?.creditsUsedTotal ?? 0) > 0 || (u?.listingImageCount ?? 0) > 0, tab: 'aihelper' },
  ]
  return NextResponse.json({ success: true, data: { steps, complete: steps.every(s => s.done) } })
}
