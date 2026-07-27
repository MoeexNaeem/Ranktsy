import { NextRequest, NextResponse } from 'next/server'
import { memCache, cacheKey } from '@/lib/cache'
import type { ApiResponse } from '@/types'

export const runtime = 'nodejs'

/**
 * Live FX rate: 1 unit of `from` → USD. Used only to offer a USD view of Google
 * CPC, which Google returns in the Ads account's own currency (e.g. PKR).
 *
 * The rate is REAL (open.er-api.com, no key) and cached 12h. We never invent a
 * rate: if the lookup fails, `rate` is null and the UI keeps showing the original
 * account-currency figure rather than a converted guess — same principle as the
 * rest of the app (a missing number beats a fabricated one).
 */
interface FxData { from: string; to: 'USD'; rate: number | null }

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<FxData>>> {
  const from = (new URL(req.url).searchParams.get('from') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
  if (!from || from.length !== 3) {
    return NextResponse.json({ success: false, error: 'Provide a 3-letter currency code (?from=PKR).' }, { status: 400 })
  }
  if (from === 'USD') return NextResponse.json({ success: true, data: { from, to: 'USD', rate: 1 } })

  const key = cacheKey('fx', 'v1', from)
  const hit = memCache.get<FxData>(key)
  if (hit) return NextResponse.json({ success: true, data: hit, cached: true })

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`FX provider ${res.status}`)
    const j = await res.json() as { result?: string; rates?: Record<string, number> }
    const rate = j.result === 'success' && typeof j.rates?.USD === 'number' ? j.rates.USD : null
    const data: FxData = { from, to: 'USD', rate }
    // Cache 12h on success; briefly on failure so a provider blip doesn't hammer it.
    memCache.set(key, data, rate != null ? 60 * 60 * 12 : 60 * 5)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[FX] lookup failed:', e)
    return NextResponse.json({ success: true, data: { from, to: 'USD', rate: null } })
  }
}
