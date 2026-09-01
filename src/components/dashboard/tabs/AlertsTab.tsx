'use client'
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Keyword alerts: the list of keywords the user is watching. A background job re-checks
 * these and drops a bell notification when volume, competition, or difficulty moves.
 */
import { useEffect, useState, useCallback } from 'react'
import { C, D, formatNumber } from '@/utils'
import { Card, SectionTitle, EmptyState, MONO } from '../kit'

interface Alert {
  id: string; keyword: string; country: string
  volume: number | null; competition: number | null; difficulty: number | null
  lastCheckedAt: string | null
}

const fmtWhen = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'

export function AlertsTab() {
  const [items, setItems] = useState<Alert[] | null>(null)
  const [max, setMax] = useState(30)
  const [kw, setKw] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    try { const r = await fetch('/api/alerts'); const j = await r.json(); if (j?.success) { setItems(j.data.items); setMax(j.data.max) } }
    catch { setItems([]) }
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    const k = kw.trim()
    if (!k || busy) return
    setBusy(true); setNote('')
    try {
      const r = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: k, country: 'GLO' }) })
      const j = await r.json()
      if (r.ok && j?.success) { setKw(''); load() } else setNote(j?.error || 'Could not add.')
    } catch { setNote('Network error.') } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setItems(x => x ? x.filter(a => a.id !== id) : null)
    try { await fetch(`/api/alerts/${id}`, { method: 'DELETE' }) } catch { /* ignore */ }
  }

  const field: React.CSSProperties = { flex: 1, minWidth: 0, border: `1px solid ${C.ash}`, borderRadius: 10, background: C.canvas, color: C.ink, fontSize: 14, fontFamily: 'inherit', padding: '10px 13px', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      <Card>
        <SectionTitle>Track a keyword</SectionTitle>
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.6, marginBottom: 12 }}>
          We watch your tracked keywords and send a notification (the bell, top right) when the search volume, competition, or difficulty changes meaningfully. You can also track a keyword straight from the Keywords tool.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input value={kw} onChange={e => setKw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="Add a keyword to watch, e.g. wall art" maxLength={120} style={field} />
          <button onClick={add} disabled={busy || !kw.trim()} style={{ background: busy || !kw.trim() ? C.ash : C.orange, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: busy || !kw.trim() ? 'default' : 'pointer', flexShrink: 0 }}>{busy ? 'Adding…' : 'Track'}</button>
        </div>
        {note && <p style={{ fontSize: 12.5, color: C.danger, marginTop: 8 }}>{note}</p>}
      </Card>

      <div>
        <SectionTitle right={items ? <span style={{ fontSize: 11, fontFamily: MONO, color: '#808080' }}>{items.length} / {max}</span> : undefined}>Watched keywords</SectionTitle>
        {!items ? <Card><div className="shimmer" style={{ height: 120, borderRadius: 8, background: '#e8e7e2' }} /></Card>
          : items.length === 0 ? <EmptyState icon="🔔" title="No keywords tracked yet" sub="Add a keyword above, or use the Track button on the Keywords tool, to get change alerts." />
          : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {items.map((a, i) => (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.9fr 0.9fr 0.7fr auto', gap: 12, alignItems: 'center', padding: '14px 18px', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.keyword}</span>
                  <span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{a.country}</span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: C.ink }} title="Search volume at last check">{a.volume != null ? formatNumber(a.volume) : '-'} <span style={{ color: C.stone }}>vol</span></span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: C.ink }} title="Competing listings at last check">{a.competition != null ? formatNumber(a.competition) : '-'} <span style={{ color: C.stone }}>comp</span></span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: a.difficulty != null && a.difficulty > 60 ? D.hard : C.ink }} title="Keyword difficulty at last check">{a.difficulty != null ? `KD ${a.difficulty}` : '-'}</span>
                  <button onClick={() => remove(a.id)} title="Stop watching" style={{ background: C.dangerBg, border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: MONO, cursor: 'pointer' }}>Remove</button>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: '#808080', padding: '10px 18px', borderTop: `1px solid ${C.hair}` }}>Baselines shown are from the last check ({items[0] ? fmtWhen(items[0].lastCheckedAt) : '-'}). Changes are compared against these.</p>
            </Card>
          )}
      </div>
    </div>
  )
}
