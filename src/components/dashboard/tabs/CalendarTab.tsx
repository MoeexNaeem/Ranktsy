'use client'
import { useMemo } from 'react'
import { C } from '@/utils'
import { Card, SectionTitle, MONO } from '../kit'

interface Event { name: string; month: number; day: number; prep: number; themes: string[] }
const EVENTS: Event[] = [
  { name: "Valentine's Day", month: 2, day: 14, prep: 6, themes: ['valentines gift', 'couples gift', 'love', 'anniversary gift'] },
  { name: "St. Patrick's Day", month: 3, day: 17, prep: 4, themes: ['st patricks day', 'irish', 'shamrock', 'lucky'] },
  { name: 'Easter', month: 4, day: 20, prep: 5, themes: ['easter gift', 'spring decor', 'bunny', 'easter basket'] },
  { name: "Mother's Day", month: 5, day: 11, prep: 5, themes: ['mothers day gift', 'gift for mom', 'grandma gift', 'new mom'] },
  { name: "Father's Day", month: 6, day: 15, prep: 5, themes: ['fathers day gift', 'gift for dad', 'grandpa gift'] },
  { name: 'Graduation Season', month: 6, day: 1, prep: 4, themes: ['graduation gift', 'class of 2026', 'grad gift'] },
  { name: 'Independence Day (US)', month: 7, day: 4, prep: 4, themes: ['4th of july', 'patriotic', 'americana', 'red white blue'] },
  { name: 'Back to School', month: 9, day: 1, prep: 5, themes: ['back to school', 'teacher gift', 'classroom', 'student'] },
  { name: 'Halloween', month: 10, day: 31, prep: 8, themes: ['halloween decor', 'spooky', 'costume', 'fall'] },
  { name: 'Thanksgiving (US)', month: 11, day: 27, prep: 6, themes: ['thanksgiving', 'fall decor', 'gratitude', 'harvest'] },
  { name: 'Black Friday / Cyber Monday', month: 11, day: 28, prep: 6, themes: ['gift ideas', 'holiday sale', 'stocking stuffer'] },
  { name: 'Hanukkah', month: 12, day: 14, prep: 8, themes: ['hanukkah', 'menorah', 'jewish holiday'] },
  { name: 'Christmas', month: 12, day: 25, prep: 10, themes: ['christmas gift', 'holiday decor', 'ornament', 'stocking stuffer'] },
  { name: 'New Year', month: 1, day: 1, prep: 4, themes: ['new year', 'resolution', 'party decor', 'planner'] },
]

const MS_DAY = 86400000
const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const fmtShort = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function CalendarTab() {
  const rows = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return EVENTS.map(e => {
      let date = new Date(now.getFullYear(), e.month - 1, e.day)
      if (date < startOfToday) date = new Date(now.getFullYear() + 1, e.month - 1, e.day)
      const daysUntil = Math.round((date.getTime() - startOfToday.getTime()) / MS_DAY)
      const prepBy = new Date(date.getTime() - e.prep * 7 * MS_DAY)
      const prepping = daysUntil <= e.prep * 7 // we're inside the prep window now
      return { ...e, date, daysUntil, prepBy, prepping }
    }).sort((a, b) => a.daysUntil - b.daysUntil)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="16px">
        <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
          Plan ahead — Etsy shoppers search seasonal terms <strong>weeks before</strong> the date. Refresh titles &amp; tags for each event by its prep deadline. Ranked by what&apos;s coming up next.
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
                  {e.prepping && <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', color: C.orange, background: C.orangeFaint, padding: '2px 9px', borderRadius: 100 }}>Prep now</span>}
                </div>
                <p style={{ fontSize: 12.5, color: '#3a4444', marginBottom: 12, fontFamily: MONO }}>
                  {fmt(e.date)} · in {e.daysUntil} day{e.daysUntil === 1 ? '' : 's'} · refresh listings by <strong style={{ color: e.prepping ? C.orange : C.ink }}>{fmtShort(e.prepBy)}</strong>
                </p>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {e.themes.map(t => (
                    <button key={t} onClick={() => navigator.clipboard?.writeText(t)} title="Click to copy"
                      style={{ fontSize: 11.5, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid rgba(255,96,8,0.2)`, padding: '4px 11px', borderRadius: 100, cursor: 'pointer' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 30, fontWeight: 300, color: i < 3 ? C.orange : C.ink, letterSpacing: '-1px', lineHeight: 1 }}>{e.daysUntil}</p>
                <p style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080', textTransform: 'uppercase' }}>days</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card pad="16px">
        <p style={{ fontSize: 12.5, color: '#3a4444', lineHeight: 1.6 }}>
          <strong style={{ color: C.ink }}>Shipping tip:</strong> for December holidays, most carriers&apos; last standard-shipping dates fall around <strong>Dec 15–19</strong> (US/UK/EU/CA/AU). Add a shop-wide &ldquo;order by&rdquo; note and consider upgraded shipping options in early December.
        </p>
      </Card>
    </div>
  )
}
