'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Admin: "SEBT Students" - everyone who signed up through the SEBT link
 * (?cohort=sebt). Shows the count, their emails, when they joined, and whether
 * their 7-day Enterprise trial is still active. Exports to CSV.
 */
import { useCallback, useEffect, useState } from 'react'
import { C } from '@/utils'
import { MONO, SectionTitle, StatCard, EmptyState, tableCard, tableHead, th, tableRow } from '@/components/dashboard/kit'

interface StudentRow {
  id: string; name: string; email: string; plan: string
  joinedAt: string | null; expiresAt: string | null; daysLeft: number; active: boolean
}
interface Payload { total: number; active: number; expired: number; students: StudentRow[]; page: number; limit: number; pageCount: number }

const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const GRID = '1.3fr 2fr 0.9fr 1fr 1fr 0.8fr'
const PAGE_SIZE = 50

export function AdminSebtStudents() {
  const [data, setData]   = useState<Payload | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)

  const load = useCallback(async (p: number) => {
    setState('loading')
    try {
      const r = await fetch(`/api/admin/sebt-students?page=${p}&limit=${PAGE_SIZE}`)
      const j = await r.json()
      if (r.ok && j?.success) { setData(j.data); setState('ok') }
      else setState('error')
    } catch { setState('error') }
  }, [])

  useEffect(() => { load(page) }, [load, page])

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const r = await fetch('/api/admin/sebt-students?format=csv')
      if (!r.ok) return
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'sebt-students.csv'; a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }, [])

  const students = data?.students ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <StatCard label="Total students" value={(data?.total ?? 0).toLocaleString()} accent="#4F46E5" />
        <StatCard label="Trial active" value={(data?.active ?? 0).toLocaleString()} accent="#1F7A44" />
        <StatCard label="Trial expired" value={(data?.expired ?? 0).toLocaleString()} accent={C.stone} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12.5, color: C.graphite, margin: 0 }}>
          Everyone who signed up via the SEBT link (rankkw.com/register?cohort=sebt).
        </p>
        <button onClick={exportCsv} disabled={exporting || !students.length}
          style={{ marginLeft: 'auto', height: 40, padding: '0 16px', borderRadius: 100, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: (exporting || !students.length) ? 'not-allowed' : 'pointer', opacity: (exporting || !students.length) ? 0.6 : 1 }}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div>
        <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: '#808080' }}>{(data?.total ?? 0).toLocaleString()} student{(data?.total ?? 0) === 1 ? '' : 's'}</span>}>
          SEBT students
        </SectionTitle>

        {state === 'loading' && <p style={{ fontSize: 13, color: '#808080', padding: '18px 2px' }}>Loading…</p>}
        {state === 'error' && <EmptyState icon="⚠️" title="Could not load" sub="Please try again." />}
        {state === 'ok' && students.length === 0 && (
          <EmptyState icon="🎓" title="No SEBT students yet" sub="They appear here once someone signs up through the SEBT link." />
        )}

        {state === 'ok' && students.length > 0 && (
          <div className="rtable" style={tableCard}>
            <div style={tableHead(GRID)}>
              {['Name', 'Email', 'Status', 'Signed up', 'Trial ends', 'Days left'].map((h, i) => <span key={i} style={th}>{h}</span>)}
            </div>
            {students.map((s, i) => (
              <div key={s.id} style={{ ...tableRow(GRID), background: i % 2 ? C.canvas : 'transparent' }}>
                <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || '-'}</span>
                <span style={{ fontSize: 12.5, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.email}>{s.email}</span>
                <span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 999, background: s.active ? '#E4F3E9' : '#F0EFEA', color: s.active ? '#1F7A44' : '#7A7A72' }}>
                    {s.active ? 'Active' : 'Expired'}
                  </span>
                </span>
                <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#666' }}>{fmtDate(s.joinedAt)}</span>
                <span style={{ fontSize: 12.5, fontFamily: MONO, color: '#666' }}>{fmtDate(s.expiresAt)}</span>
                <span style={{ fontSize: 13, fontFamily: MONO, color: s.active ? C.ink : C.stone, fontWeight: 600 }}>{s.active ? `${s.daysLeft}d` : '-'}</span>
              </div>
            ))}
          </div>
        )}

        {state === 'ok' && (data?.pageCount ?? 1) > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 16 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={pgBtn(page <= 1)}>← Prev</button>
            <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite }}>Page {data?.page ?? page} of {(data?.pageCount ?? 1).toLocaleString()}</span>
            <button onClick={() => setPage(p => Math.min((data?.pageCount ?? 1), p + 1))} disabled={page >= (data?.pageCount ?? 1)} style={pgBtn(page >= (data?.pageCount ?? 1))}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

const pgBtn = (disabled: boolean): React.CSSProperties => ({
  height: 34, padding: '0 16px', borderRadius: 100, border: `1px solid ${C.ash}`,
  background: C.paper, color: C.ink, fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
})
