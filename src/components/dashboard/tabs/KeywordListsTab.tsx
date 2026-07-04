'use client'
import { useState, useEffect, useCallback } from 'react'
import { C } from '@/utils'
import { Card, SectionTitle, EmptyState, primaryBtn, MONO } from '../kit'

const STORAGE_KEY = 'ranktsy:keyword-lists'
interface KList { id: string; name: string; keywords: string[] }

const inputStyle: React.CSSProperties = {
  flex: 1, background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 100,
  padding: '10px 16px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', color: '#1a1a1a', minWidth: 0,
}
const smallBtn: React.CSSProperties = { ...primaryBtn, height: 38, padding: '0 18px', fontSize: 13 }

function loadLists(): KList[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function KeywordListsTab() {
  const [lists, setLists] = useState<KList[]>([])
  const [activeId, setActiveId] = useState('')
  const [newList, setNewList] = useState('')
  const [newKw, setNewKw] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const l = loadLists()
    setLists(l); setActiveId(l[0]?.id ?? ''); setHydrated(true)
  }, [])
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(lists)) }, [lists, hydrated])

  const active = lists.find(l => l.id === activeId)

  const createList = useCallback(() => {
    const n = newList.trim(); if (!n) return
    const id = Date.now().toString(36)
    setLists(p => [...p, { id, name: n, keywords: [] }]); setActiveId(id); setNewList('')
  }, [newList])

  const deleteList = useCallback((id: string) => {
    setLists(p => {
      const next = p.filter(l => l.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? '')
      return next
    })
  }, [activeId])

  const addKw = useCallback(() => {
    const k = newKw.trim().toLowerCase(); if (!k || !active) return
    setLists(p => p.map(l => l.id === activeId && !l.keywords.includes(k) ? { ...l, keywords: [...l.keywords, k] } : l))
    setNewKw('')
  }, [newKw, active, activeId])

  const removeKw = useCallback((k: string) => {
    setLists(p => p.map(l => l.id === activeId ? { ...l, keywords: l.keywords.filter(x => x !== k) } : l))
  }, [activeId])

  if (hydrated && lists.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={newList} onChange={e => setNewList(e.target.value)} onKeyDown={e => e.key === 'Enter' && createList()} placeholder="Name your first list — e.g. Q4 Jewelry…" style={{ ...inputStyle, maxWidth: 420 }} />
          <button onClick={createList} style={smallBtn}>Create list</button>
        </div>
        <EmptyState icon="🗂️" title="No keyword lists yet" sub="Create a list to save and organize keywords you want to target" />
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Lists column */}
      <Card pad="16px">
        <SectionTitle>Your lists</SectionTitle>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input value={newList} onChange={e => setNewList(e.target.value)} onKeyDown={e => e.key === 'Enter' && createList()} placeholder="New list…" style={{ ...inputStyle, fontSize: 13, padding: '9px 14px' }} />
          <button onClick={createList} style={{ ...smallBtn, height: 36, padding: '0 14px' }}>+</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lists.map(l => (
            <div key={l.id} onClick={() => setActiveId(l.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 8, cursor: 'pointer', background: l.id === activeId ? C.orangeFaint : 'transparent', border: `1px solid ${l.id === activeId ? 'rgba(255,96,8,0.25)' : 'transparent'}` }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: l.id === activeId ? 600 : 400, color: l.id === activeId ? C.orange : C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              <span style={{ fontSize: 10.5, fontFamily: MONO, color: '#a3a29a' }}>{l.keywords.length}</span>
              <button onClick={e => { e.stopPropagation(); deleteList(l.id) }} title="Delete list"
                style={{ background: 'transparent', border: 'none', color: '#b0b0a8', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      </Card>

      {/* Keywords column */}
      <Card pad="18px">
        {active ? (
          <>
            <SectionTitle right={active.keywords.length > 0 ? (
              <button onClick={() => navigator.clipboard?.writeText(active.keywords.join(', '))}
                style={{ fontSize: 12, fontFamily: MONO, color: C.orange, background: 'transparent', border: `1px solid ${C.orange}`, padding: '4px 12px', borderRadius: 100, cursor: 'pointer' }}>Copy all</button>
            ) : undefined}>
              {active.name} · {active.keywords.length} keyword{active.keywords.length === 1 ? '' : 's'}
            </SectionTitle>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKw()} placeholder="Add a keyword…" style={inputStyle} />
              <button onClick={addKw} style={smallBtn}>Add</button>
            </div>
            {active.keywords.length === 0 ? (
              <p style={{ fontSize: 13, color: '#a3a29a', padding: '20px 0', textAlign: 'center' }}>No keywords yet — add some above.</p>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {active.keywords.map(k => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontFamily: MONO, color: C.ink, background: C.bone, border: `1px solid ${C.hair}`, padding: '5px 8px 5px 13px', borderRadius: 100 }}>
                    {k}
                    <button onClick={() => removeKw(k)} style={{ background: 'transparent', border: 'none', color: '#a3a29a', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyState icon="🗂️" title="Select a list" sub="Pick a list on the left, or create a new one" />
        )}
      </Card>
    </div>
  )
}
