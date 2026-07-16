'use client'
import { useMemo } from 'react'
import { C } from '@/utils'
import { Card, SectionTitle, MONO } from '../kit'

// ─── Moving-feast maths ───────────────────────────────────────────────────────
// These dates were previously hardcoded to a fixed month/day, which is wrong for
// every year: Easter was pinned to 20 Apr (15 days off for 2026), Father's Day
// to 15 Jun (6 days off), Thanksgiving and Mother's Day each a day out. The tab
// tells sellers to refresh listings N weeks before an event, so a wrong date
// silently moves the whole prep window.

/** Gregorian Easter Sunday (Meeus/Jones/Butcher computus). */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** The nth given weekday of a month (weekday: 0=Sun). e.g. 4th Thursday of November. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1)
  const shift = (weekday - first.getDay() + 7) % 7
  return new Date(year, month - 1, 1 + shift + (n - 1) * 7)
}

/**
 * First day of Hanukkah (25 Kislev), resolved via the platform's own Hebrew
 * calendar rather than a guessed Gregorian date — it drifts by weeks each year.
 * Falls back to null if Intl lacks Hebrew calendar data, so the event is hidden
 * rather than shown on a wrong day.
 */
function hanukkahStart(year: number): Date | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    // 25 Kislev always lands between late Nov and late Dec.
    for (let d = new Date(Date.UTC(year, 10, 20)); d <= new Date(Date.UTC(year, 11, 31)); d = new Date(d.getTime() + 86400000)) {
      const parts = fmt.formatToParts(d)
      const month = parts.find(p => p.type === 'month')?.value ?? ''
      const day = parts.find(p => p.type === 'day')?.value ?? ''
      if (month.startsWith('Kislev') && day === '25') return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    }
    return null
  } catch {
    return null
  }
}

interface Event {
  name: string
  /** Resolves the event's real date for a given year. */
  date: (year: number) => Date | null
  prep: number
  themes: string[]
}

const EVENTS: Event[] = [
  { name: 'New Year',                 date: y => new Date(y, 0, 1),   prep: 4,  themes: ['new year', 'resolution', 'party decor', 'planner'] },
  { name: "Valentine's Day",          date: y => new Date(y, 1, 14),  prep: 6,  themes: ['valentines gift', 'couples gift', 'love', 'anniversary gift'] },
  { name: "St. Patrick's Day",        date: y => new Date(y, 2, 17),  prep: 4,  themes: ['st patricks day', 'irish', 'shamrock', 'lucky'] },
  { name: 'Easter',                   date: easterSunday,             prep: 5,  themes: ['easter gift', 'spring decor', 'bunny', 'easter basket'] },
  { name: "Mother's Day (US/CA/AU)",  date: y => nthWeekdayOfMonth(y, 5, 0, 2),  prep: 5, themes: ['mothers day gift', 'gift for mom', 'grandma gift', 'new mom'] },
  { name: "Father's Day (US/UK/CA)",  date: y => nthWeekdayOfMonth(y, 6, 0, 3),  prep: 5, themes: ['fathers day gift', 'gift for dad', 'grandpa gift'] },
  // "class of 2026" was hardcoded and would silently go stale; the year is
  // stitched in at render time instead.
  { name: 'Graduation Season',        date: y => new Date(y, 5, 1),   prep: 4,  themes: ['graduation gift', 'grad gift', 'class of {year}'] },
  { name: 'Independence Day (US)',    date: y => new Date(y, 6, 4),   prep: 4,  themes: ['4th of july', 'patriotic', 'americana', 'red white blue'] },
  { name: 'Back to School',           date: y => new Date(y, 8, 1),   prep: 5,  themes: ['back to school', 'teacher gift', 'classroom', 'student'] },
  { name: 'Halloween',                date: y => new Date(y, 9, 31),  prep: 8,  themes: ['halloween decor', 'spooky', 'costume', 'fall'] },
  { name: 'Thanksgiving (US)',        date: y => nthWeekdayOfMonth(y, 11, 4, 4), prep: 6, themes: ['thanksgiving', 'fall decor', 'gratitude', 'harvest'] },
  // Always the day after US Thanksgiving — derived, never guessed.
  { name: 'Black Friday / Cyber Monday', date: y => new Date(nthWeekdayOfMonth(y, 11, 4, 4).getTime() + MS_DAY), prep: 6, themes: ['gift ideas', 'holiday sale', 'stocking stuffer'] },
  { name: 'Hanukkah',                 date: hanukkahStart,            prep: 8,  themes: ['hanukkah', 'menorah', 'jewish holiday'] },
  { name: 'Christmas',                date: y => new Date(y, 11, 25), prep: 10, themes: ['christmas gift', 'holiday decor', 'ornament', 'stocking stuffer'] },
]

const MS_DAY = 86400000
const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const fmtShort = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function CalendarTab() {
  const rows = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return EVENTS.map(e => {
      // Resolve for this year; if it's already passed, resolve NEXT year properly
      // rather than reusing this year's month/day — a moving feast lands on a
      // different date each year.
      let date = e.date(now.getFullYear())
      if (!date || date < startOfToday) {
        const next = e.date(now.getFullYear() + 1)
        if (!next) return null
        if (!date || date < startOfToday) date = next
      }
      if (!date) return null
      const daysUntil = Math.round((date.getTime() - startOfToday.getTime()) / MS_DAY)
      const prepBy = new Date(date.getTime() - e.prep * 7 * MS_DAY)
      const prepping = daysUntil <= e.prep * 7 // we're inside the prep window now
      // {year} resolves to the event's own year, so "class of 2027" is right the
      // moment the 2027 graduation season becomes the next one up.
      const themes = e.themes.map(t => t.replace('{year}', String(date!.getFullYear())))
      return { ...e, themes, date, daysUntil, prepBy, prepping }
    })
      // Events whose date can't be resolved are dropped, never shown on a guess.
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="16px">
        <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
          Plan ahead — Etsy shoppers search seasonal terms <strong>weeks before</strong>{' '}the date. Refresh titles &amp; tags for each event by its prep deadline. Ranked by what&apos;s coming up next.
          Moving feasts (Easter, Mother&apos;s/Father&apos;s Day, Thanksgiving, Hanukkah) are computed for the actual year, not fixed to a calendar slot.
        </p>
      </Card>

      <SectionTitle>Upcoming selling events</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((e, i) => (
          <Card key={e.name} pad="16px 18px" style={i < 3 ? { borderColor: C.orange } : undefined}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 500, color: C.ink }}>{e.name}</h3>
                  {e.prepping && <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', color: C.orange, background: C.orangeFaint, padding: '2px 9px', borderRadius: 100 }}>Prep now</span>}
                </div>
                <p style={{ fontSize: 12.5, color: '#6E6E64', marginBottom: 12, fontFamily: MONO }}>
                  {fmt(e.date)} · in {e.daysUntil} day{e.daysUntil === 1 ? '' : 's'} · refresh listings by <strong style={{ color: e.prepping ? C.orange : C.ink }}>{fmtShort(e.prepBy)}</strong>
                </p>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {e.themes.map(t => (
                    <button key={t} onClick={() => navigator.clipboard?.writeText(t)} title="Click to copy"
                      style={{ fontSize: 11.5, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid rgba(251,94,9,0.2)`, padding: '4px 11px', borderRadius: 100, cursor: 'pointer' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 30, fontWeight: 400, color: i < 3 ? C.orange : C.ink, letterSpacing: '-1px', lineHeight: 1 }}>{e.daysUntil}</p>
                <p style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080', textTransform: 'uppercase' }}>days</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card pad="16px">
        <p style={{ fontSize: 12.5, color: '#6E6E64', lineHeight: 1.6 }}>
          <strong style={{ color: C.ink }}>Shipping tip:</strong> for December holidays, most carriers&apos; last standard-shipping dates fall around <strong>Dec 15–19</strong> (US/UK/EU/CA/AU). Add a shop-wide &ldquo;order by&rdquo; note and consider upgraded shipping options in early December.
        </p>
      </Card>
    </div>
  )
}

