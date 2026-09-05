import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { SavedKeyword } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'

export const runtime = 'nodejs'

interface DayCount { day: string; count: number }
interface KeywordRow {
  keyword: string
  count: number
  countries: string[]
  users: string[]
  lastAt: string | null
  day?: string
}

/** Group saved keywords for a scope. `day === 'all'` groups by (day, keyword). */
async function groupKeywords(day: string): Promise<KeywordRow[]> {
  const all = day === 'all'
  const rows = await SavedKeyword.aggregate([
    ...(all ? [] : [{ $match: { day } }]),
    {
      $group: {
        _id: all ? { day: '$day', keyword: '$keyword' } : '$keyword',
        count: { $sum: 1 },
        lastAt: { $max: '$createdAt' },
        countries: { $addToSet: '$geo' },
        users: { $addToSet: '$userEmail' },
      },
    },
    { $sort: all ? { '_id.day': -1, count: -1 } : { count: -1, lastAt: -1 } },
    { $limit: 5000 },
  ])
  return rows.map((r: { _id: unknown; count: number; lastAt: Date | null; countries: (string | null)[]; users: (string | null)[] }) => ({
    keyword: all ? (r._id as { keyword: string }).keyword : (r._id as string),
    day: all ? (r._id as { day: string }).day : undefined,
    count: r.count,
    countries: (r.countries || []).filter(Boolean) as string[],
    users: (r.users || []).filter(Boolean) as string[],
    lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null,
  }))
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

function toCsv(rows: KeywordRow[], includeDay: boolean): string {
  const head = [...(includeDay ? ['Date'] : []), 'Keyword', 'Searches', 'Countries', 'Users', 'Last Searched']
  const body = rows.map(r => [
    ...(includeDay ? [r.day ?? ''] : []),
    r.keyword,
    r.count,
    r.countries.join(' | '),
    r.users.join(' | '),
    r.lastAt ? new Date(r.lastAt).toISOString().replace('T', ' ').slice(0, 19) : '',
  ].map(csvCell).join(','))
  return [head.map(csvCell).join(','), ...body].join('\n')
}

/**
 * Admin "Saved Keywords".
 *   GET                       → { days:[{day,count}], selectedDay, total, keywords:[…] }
 *   GET ?day=2026-09-05       → same, scoped to that day
 *   GET ?day=all              → every day, keywords grouped by (day, keyword)
 *   GET ?day=…&format=csv     → CSV download of the current scope
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format')
  let day = searchParams.get('day')?.trim() || ''

  try {
    await connectDB()

    // Distinct days with counts, newest first, for the date picker.
    const dayAgg = await SavedKeyword.aggregate([
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 366 },
    ])
    const days: DayCount[] = dayAgg.map((d: { _id: string; count: number }) => ({ day: d._id, count: d.count }))

    // Default the selected day to the most recent one that has data.
    if (!day) day = days[0]?.day ?? ''
    const scope = day === 'all' ? 'all' : day
    const keywords = scope ? await groupKeywords(scope) : []

    if (format === 'csv') {
      const includeDay = scope === 'all'
      const csv = toCsv(keywords, includeDay)
      const fname = scope === 'all' ? 'saved-keywords-all.csv' : `saved-keywords-${scope}.csv`
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fname}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const total = keywords.reduce((n, k) => n + k.count, 0)
    return NextResponse.json({ success: true, data: { days, selectedDay: day, total, keywords } })
  } catch (e) {
    console.error('[Admin] saved-keywords:', e)
    return NextResponse.json({ success: false, error: 'Could not load saved keywords.' }, { status: 500 })
  }
}
