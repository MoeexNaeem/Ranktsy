'use client'
import { useState, useCallback, useMemo } from 'react'
import axios from 'axios'
import { C } from '@/utils'
import { Card, SectionTitle, ErrorBox, EmptyState, primaryBtn, MONO } from '../kit'
import type { EtsyListing } from '@/types'

// Curated common misspellings (English + Etsy craft/jewelry terms). Only clear,
// unambiguous typos are included so we never flag a valid word.
const MISSPELL: Record<string, string> = {
  jewelery: 'jewelry', jewlery: 'jewelry', jewelrey: 'jewelry', jewellry: 'jewellery',
  neckalce: 'necklace', necklance: 'necklace', necklase: 'necklace', necklac: 'necklace',
  braclet: 'bracelet', bracelett: 'bracelet', bracelette: 'bracelet', bracelt: 'bracelet',
  earing: 'earring', earings: 'earrings', erring: 'earring', pendent: 'pendant', pendan: 'pendant',
  sterlin: 'sterling', turquiose: 'turquoise', turqoise: 'turquoise', diamand: 'diamond',
  handmaid: 'handmade', hnadmade: 'handmade', handemade: 'handmade',
  personlized: 'personalized', personilized: 'personalized', personalied: 'personalized',
  vintge: 'vintage', vintague: 'vintage', antuque: 'antique', antiuqe: 'antique',
  uniqe: 'unique', unqiue: 'unique', weding: 'wedding', anniversay: 'anniversary', aniversary: 'anniversary',
  birhday: 'birthday', birthdya: 'birthday', chirstmas: 'christmas', christmss: 'christmas',
  hallowen: 'halloween', valentin: 'valentine', valemtine: 'valentine', easer: 'easter',
  thanksgivng: 'thanksgiving', crotchet: 'crochet', embroidary: 'embroidery', kntting: 'knitting',
  ceramick: 'ceramic', potery: 'pottery', woodden: 'wooden', leathr: 'leather', cotten: 'cotton',
  minimalst: 'minimalist', boquet: 'bouquet', keychan: 'keychain', accesory: 'accessory',
  accessary: 'accessory', gfit: 'gift', decoraton: 'decoration', recieve: 'receive',
  seperate: 'separate', occassion: 'occasion', newbron: 'newborn', toddlr: 'toddler',
}

const parseTags = (t: string) => t.split(/[,\n]/).map(s => s.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)

function checkTag(tag: string): { word: string; suggestion: string } | null {
  for (const raw of tag.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^a-z]/g, '')
    if (w && MISSPELL[w]) return { word: w, suggestion: MISSPELL[w] }
  }
  return null
}

export function SpellCheckerTab() {
  const [text, setText] = useState('handmade jewelery\nsilver braclet\nvintage necklace\npersonlized gift\nsterling silver earring')
  const [checked, setChecked] = useState<string[] | null>(null)
  const [loadId, setLoadId] = useState('')
  const [err, setErr] = useState('')

  const loadFromListing = useCallback(async () => {
    const m = loadId.match(/listing\/(\d+)/) || loadId.match(/(\d{6,})/)
    if (!m) { setErr('Paste a listing URL or ID to load its tags.'); return }
    setErr('')
    try {
      const { data } = await axios.get(`/api/etsy/listing?id=${m[1]}`)
      const l = data.data as EtsyListing
      setText((l.tags ?? []).join('\n'))
    } catch { setErr('Listing not found.') }
  }, [loadId])

  const results = useMemo(() => {
    if (!checked) return null
    return checked.map(tag => ({ tag, issue: checkTag(tag) }))
  }, [checked])

  const flagged = results?.filter(r => r.issue).length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="18px">
        <SectionTitle right={
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={loadId} onChange={e => setLoadId(e.target.value)} placeholder="…or load a listing URL/ID"
              style={{ background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 100, padding: '6px 12px', fontSize: 12, fontFamily: MONO, outline: 'none', color: '#1a1a1a', width: 200 }} />
            <button onClick={loadFromListing} style={{ fontSize: 12, fontFamily: MONO, color: C.orange, background: 'transparent', border: `1px solid ${C.orange}`, padding: '5px 12px', borderRadius: 100, cursor: 'pointer' }}>Load</button>
          </div>
        }>Check your tags for typos</SectionTitle>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
          placeholder="One tag per line (or comma-separated)…"
          style={{ width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '12px 14px', fontSize: 13.5, fontFamily: MONO, color: '#1a1a1a', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
        <button onClick={() => setChecked(parseTags(text))} style={{ ...primaryBtn, marginTop: 12 }}>Check spelling →</button>
      </Card>

      {err && <ErrorBox>{err}</ErrorBox>}

      {results && (
        <div>
          <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: flagged ? C.danger : C.success }}>{flagged ? `${flagged} possible issue${flagged === 1 ? '' : 's'}` : 'All clear ✓'}</span>}>
            {results.length} tags checked
          </SectionTitle>
          <Card pad="16px">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {results.map(({ tag, issue }) => (
                <span key={tag} title={issue ? `"${issue.word}" → "${issue.suggestion}"` : 'Looks good'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontFamily: MONO, padding: '5px 11px', borderRadius: 100, border: `1px solid ${issue ? C.danger : C.hair}`, background: issue ? C.dangerBg : C.canvas, color: issue ? C.danger : C.inkSoft }}>
                  {issue ? '⚠' : '✓'} {tag}
                  {issue && <span style={{ color: C.ink }}>→ {issue.suggestion}</span>}
                </span>
              ))}
            </div>
          </Card>
          <p style={{ fontSize: 12, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
            Flags known misspellings from a built-in dictionary of common English &amp; craft terms. Craft-specific brand words won&apos;t be flagged.
          </p>
        </div>
      )}

      {!results && !err && <EmptyState icon="🔤" title="Spell-check your tags" sub="Paste your tags (or load a listing) to catch typos that cost you traffic" />}
    </div>
  )
}
