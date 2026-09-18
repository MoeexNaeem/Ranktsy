import { NextResponse } from 'next/server'
import { estimateModelConfig } from '@/lib/salesEstimate'

export const runtime = 'nodejs'
// Constants, not user data - safe to cache hard at the edge.
export const revalidate = 3600

/**
 * The sales-estimate model as data: rates, the per-category conversion table,
 * the digital rate and the digital-detection pattern.
 *
 * PUBLIC on purpose (see proxy.ts). The browser extension used to hard-code its
 * own calibrated copy of these constants, which is why the same listing could
 * read differently in the extension and on rankkw.com. It now loads this config
 * at startup and caches it per `version`, so there is exactly one model.
 */
export function GET() {
  return NextResponse.json(
    { success: true, data: estimateModelConfig() },
    { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
