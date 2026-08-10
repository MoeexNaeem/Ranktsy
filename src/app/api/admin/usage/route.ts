import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ApiUsage } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { flushUsage } from '@/lib/usage'
import type { ApiResponse, IApiUsage } from '@/types'

export const runtime = 'nodejs'

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Admin API-usage analytics: today's totals + per-user breakdown, plus a 7-day
 * daily-totals history. Numbers reset at 00:00 UTC (each day is its own row).
 */
export async function GET(): Promise<NextResponse<ApiResponse<unknown>>> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  try {
    await flushUsage()          // persist this instance's buffered counts first
    await connectDB()

    const today = dayKey(new Date())
    const days: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i); return dayKey(d)
    })

    const rows = await ApiUsage.find({ day: { $in: days } }).lean<IApiUsage[]>()

    // Today, per user (biggest consumers first).
    const todayRows = rows.filter(r => r.day === today)
    const perUser = todayRows
      .map(r => ({
        userId: r.userId, userEmail: r.userEmail ?? null,
        etsyCalls: r.etsyCalls, googleCalls: r.googleCalls, searches: r.searches,
        cacheHits: r.cacheHits, apiHits: r.apiHits,
        imageCalls: r.imageCalls ?? 0, imageTokens: r.imageTokens ?? 0, imageCostUsd: r.imageCostUsd ?? 0,
        creditsSpent: r.creditsSpent ?? 0,
      }))
      .sort((a, b) => (b.etsyCalls + b.googleCalls + b.imageCalls) - (a.etsyCalls + a.googleCalls + a.imageCalls))

    const totals = todayRows.reduce((t, r) => ({
      etsyCalls: t.etsyCalls + (r.etsyCalls || 0),
      googleCalls: t.googleCalls + (r.googleCalls || 0),
      searches: t.searches + (r.searches || 0),
      cacheHits: t.cacheHits + (r.cacheHits || 0),
      apiHits: t.apiHits + (r.apiHits || 0),
      imageCalls: t.imageCalls + (r.imageCalls || 0),
      imageTokens: t.imageTokens + (r.imageTokens || 0),
      imageCostUsd: t.imageCostUsd + (r.imageCostUsd || 0),
      creditsSpent: t.creditsSpent + (r.creditsSpent || 0),
    }), { etsyCalls: 0, googleCalls: 0, searches: 0, cacheHits: 0, apiHits: 0, imageCalls: 0, imageTokens: 0, imageCostUsd: 0, creditsSpent: 0 })

    // Last 7 days — daily totals across all users (oldest → newest).
    const byDay = new Map<string, { day: string; etsyCalls: number; googleCalls: number; searches: number; imageCalls: number; imageCostUsd: number; creditsSpent: number }>()
    for (const d of days) byDay.set(d, { day: d, etsyCalls: 0, googleCalls: 0, searches: 0, imageCalls: 0, imageCostUsd: 0, creditsSpent: 0 })
    for (const r of rows) {
      const b = byDay.get(r.day)
      if (b) { b.etsyCalls += r.etsyCalls || 0; b.googleCalls += r.googleCalls || 0; b.searches += r.searches || 0; b.imageCalls += r.imageCalls || 0; b.imageCostUsd += r.imageCostUsd || 0; b.creditsSpent += r.creditsSpent || 0 }
    }
    const last7Days = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1))

    return NextResponse.json({ success: true, data: { today: { day: today, totals, perUser }, last7Days } })
  } catch (e) {
    console.error('[Admin/usage] failed:', e)
    return NextResponse.json({ success: false, error: 'Could not load usage' }, { status: 500 })
  }
}
