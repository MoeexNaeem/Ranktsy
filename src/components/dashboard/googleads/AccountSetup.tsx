'use client'
/**
 * Account setup sections for the Google Ads tab:
 *   - Conversion tracking: create website / call conversion actions, show the Google tag
 *     to install, remove actions. Turning tracking on unlocks conversion-based bidding.
 *   - Callouts: account-level callout extensions (add, remove).
 *   - AddKeywordsForm: add keywords to an existing ad group.
 */
import { useCallback, useEffect, useState } from 'react'
import { C, D } from '@/utils'
import { Card, EmptyState, MONO } from '../kit'
import { toast, copyWithToast } from '@/components/ui/toast'
import { parseKeywordLines, type MatchType } from '@/lib/google-ads-constants'
import type { AdsAccount } from './Reports'

const CALLOUT_MAX = 25

interface Conversion {
  id: string; name: string; status: string; type: string; category: string; countingType: string; defaultValue: number | null; primaryForGoal: boolean
  snippets: { type: string; pageFormat: string; globalSiteTag: string | null; eventSnippet: string | null }[]
}

const TYPE_LABEL: Record<string, string> = { WEBPAGE: 'Website', AD_CALL: 'Calls from ads', WEBSITE_CALL: 'Calls from your website' }
const CATEGORY_LABEL: Record<string, string> = {
  PURCHASE: 'Purchase', ADD_TO_CART: 'Add to cart', BEGIN_CHECKOUT: 'Begin checkout', SIGNUP: 'Sign-up',
  SUBMIT_LEAD_FORM: 'Submit lead form', CONTACT: 'Contact', PAGE_VIEW: 'Page view', PHONE_CALL_LEAD: 'Phone call lead', DEFAULT: 'Other',
}

function useList<T>(url: string) {
  const [state, setState] = useState<{ rows: T[] | null; error: string | null }>({ rows: null, error: null })
  const load = useCallback(async () => {
    try {
      const r = await fetch(url, { cache: 'no-store' })
      const j = await r.json()
      setState(j?.success ? { rows: j.data, error: null } : { rows: null, error: j?.error || 'Could not load.' })
    } catch { setState({ rows: null, error: 'Network error. Please try again.' }) }
  }, [url])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  return { ...state, reload: load }
}

// ─── Conversion tracking ──────────────────────────────────────────────────────
export function ConversionsSection({ account }: { account: AdsAccount }) {
  const { rows, error, reload } = useList<Conversion>('/api/google-ads/conversions')
  const [creating, setCreating] = useState(false)
  const [openTag, setOpenTag] = useState<string | null>(null)
  const cur = account.currency || 'USD'

  const [name, setName] = useState('Etsy purchase')
  const [type, setType] = useState<'WEBPAGE' | 'AD_CALL' | 'WEBSITE_CALL'>('WEBPAGE')
  const [category, setCategory] = useState('PURCHASE')
  const [value, setValue] = useState('25')
  const [counting, setCounting] = useState<'ONE_PER_CLICK' | 'MANY_PER_CLICK'>('ONE_PER_CLICK')
  const [days, setDays] = useState('30')
  const [callSeconds, setCallSeconds] = useState('60')
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!name.trim()) { toast.error('Enter a name'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/google-ads/conversions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, category, defaultValue: Number(value) || 0, countingType: counting, clickThroughDays: Number(days) || 30, callDurationSeconds: Number(callSeconds) || 60 }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) {
        toast.success('Conversion action created', type === 'WEBPAGE' ? 'Install the Google tag shown below on your website.' : 'Calls from your ads will now be counted.')
        setCreating(false); await reload()
        if (j.data?.id) setOpenTag(j.data.id)
      } else toast.error('Conversion action not created', j?.error || 'Please try again.')
    } catch { toast.error('Network error', 'Please try again.') }
    finally { setBusy(false) }
  }

  const remove = async (c: Conversion) => {
    if (!window.confirm(`Remove the conversion action “${c.name}”? Google Ads stops counting these conversions.`)) return
    const r = await fetch(`/api/google-ads/conversions/${c.id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => null)
    if (r.ok && j?.success) { toast.success('Conversion action removed', c.name); reload() }
    else toast.error('Not removed', j?.error || 'Please try again.')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>Conversion tracking</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.graphite, lineHeight: 1.6 }}>
              Count the sales, sign-ups or calls your ads bring. Once tracking is on, you can use Maximize conversions, Target CPA and Target ROAS bidding.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#8A5A00', lineHeight: 1.55 }}>
              Etsy shop pages don’t allow custom tracking code. Use a website conversion on your own site, or call conversions if customers phone you.
            </p>
          </div>
          {!creating && <button onClick={() => setCreating(true)} style={blueBtn}>+ New conversion action</button>}
        </div>
        {creating && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, borderTop: `1px solid ${C.hair}`, paddingTop: 16 }}>
            <Labeled label="Name"><input value={name} onChange={e => setName(e.target.value)} maxLength={100} style={field} /></Labeled>
            <Labeled label="What to track">
              <select value={type} onChange={e => setType(e.target.value as typeof type)} style={field}>
                <option value="WEBPAGE">Website action (purchase, sign-up…)</option>
                <option value="AD_CALL">Calls from ads</option>
                <option value="WEBSITE_CALL">Calls from your website</option>
              </select>
            </Labeled>
            {type === 'WEBPAGE' && (
              <Labeled label="Category">
                <select value={category} onChange={e => setCategory(e.target.value)} style={field}>
                  {Object.entries(CATEGORY_LABEL).filter(([k]) => k !== 'PHONE_CALL_LEAD').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Labeled>
            )}
            <Labeled label={`Value per conversion (${cur})`}><input type="number" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} style={field} /></Labeled>
            <Labeled label="Count">
              <select value={counting} onChange={e => setCounting(e.target.value as typeof counting)} style={field}>
                <option value="ONE_PER_CLICK">One per click (leads, sign-ups)</option>
                <option value="MANY_PER_CLICK">Every conversion (purchases)</option>
              </select>
            </Labeled>
            <Labeled label="Click-through window (days)"><input type="number" min="1" max="90" value={days} onChange={e => setDays(e.target.value)} style={field} /></Labeled>
            {type !== 'WEBPAGE' && <Labeled label="Minimum call length (seconds)"><input type="number" min="0" value={callSeconds} onChange={e => setCallSeconds(e.target.value)} style={field} /></Labeled>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button onClick={create} disabled={busy} style={blueBtn}>{busy ? 'Creating…' : 'Create'}</button>
              <button onClick={() => setCreating(false)} style={ghost}>Cancel</button>
            </div>
          </div>
        )}
      </Card>

      {error ? <Card><EmptyState icon="🚫" title="Couldn’t load conversion actions" sub={error} /></Card>
        : !rows ? <Card><div className="shimmer" style={{ height: 120, borderRadius: 8, background: '#e8e7e2' }} /></Card>
        : !rows.length ? <Card><EmptyState icon="🎯" title="No conversion actions yet" sub="Create one to start measuring what your ads bring in." /></Card>
        : rows.map(c => {
          const web = c.snippets.find(s => s.type === 'WEBPAGE' && s.pageFormat === 'HTML')
          return (
            <Card key={c.id} pad={18}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.ink }}>{c.name}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: C.graphite }}>
                    {TYPE_LABEL[c.type] ?? c.type} · {CATEGORY_LABEL[c.category] ?? c.category} · {c.countingType === 'ONE_PER_CLICK' ? 'One per click' : 'Every conversion'}
                    {c.defaultValue != null ? ` · value ${c.defaultValue} ${cur}` : ''}{c.primaryForGoal ? ' · used for bidding' : ''}
                  </p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: c.status === 'ENABLED' ? D.good : C.graphite, background: c.status === 'ENABLED' ? 'rgba(31,138,76,0.10)' : C.canvas, borderRadius: 100, padding: '3px 10px' }}>{c.status === 'ENABLED' ? 'Enabled' : c.status}</span>
                {web && <button onClick={() => setOpenTag(o => (o === c.id ? null : c.id))} style={ghost}>{openTag === c.id ? 'Hide tag' : 'Show tag'}</button>}
                <button onClick={() => remove(c)} style={{ ...ghost, color: C.danger, borderColor: 'rgba(207,70,58,0.35)' }}>Remove</button>
              </div>
              {openTag === c.id && web && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Snippet title="1. Google tag: paste into the <head> of every page" code={web.globalSiteTag ?? ''} />
                  <Snippet title="2. Event snippet: paste on the page shown after the conversion (e.g. order confirmation)" code={web.eventSnippet ?? ''} />
                </div>
              )}
            </Card>
          )
        })}
    </div>
  )
}

function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: C.ink, flex: 1 }}>{title}</p>
        <button onClick={() => copyWithToast(code, 'Code')} style={{ ...ghost, height: 30 }}>Copy</button>
      </div>
      <pre style={{ margin: 0, background: '#1f2430', color: '#e8eaf0', borderRadius: 10, padding: 12, fontSize: 12, fontFamily: 'ui-monospace, monospace', overflowX: 'auto', whiteSpace: 'pre' }}>{code}</pre>
    </div>
  )
}

// ─── Callouts ─────────────────────────────────────────────────────────────────
export function CalloutsSection() {
  const { rows, error, reload } = useList<{ assetId: string; text: string; status: string }>('/api/google-ads/callouts')
  const [lines, setLines] = useState<string[]>(['', ''])
  const [busy, setBusy] = useState(false)
  const texts = lines.map(l => l.trim()).filter(Boolean)
  const tooLong = lines.some(l => l.trim().length > CALLOUT_MAX)

  const add = async () => {
    if (!texts.length) { toast.error('Add at least one callout'); return }
    if (tooLong) { toast.error('Callout too long', `Callouts can be at most ${CALLOUT_MAX} characters.`); return }
    setBusy(true)
    try {
      const r = await fetch('/api/google-ads/callouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) { toast.success('Callouts added', `${j.data.created} callout${j.data.created === 1 ? '' : 's'} now show with your ads.`); setLines(['', '']); reload() }
      else toast.error('Callouts not added', j?.error || 'Please try again.')
    } catch { toast.error('Network error', 'Please try again.') }
    finally { setBusy(false) }
  }
  const remove = async (c: { assetId: string; text: string }) => {
    const r = await fetch(`/api/google-ads/callouts/${c.assetId}`, { method: 'DELETE' })
    const j = await r.json().catch(() => null)
    if (r.ok && j?.success) { toast.success('Callout removed', c.text); reload() }
    else toast.error('Not removed', j?.error || 'Please try again.')
  }

  return (
    <Card>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>Callouts</p>
      <p style={{ margin: '4px 0 14px', fontSize: 13, color: C.graphite, lineHeight: 1.6 }}>
        Short extra lines Google can show under your ads, like “Free Shipping” or “Handmade To Order”. These apply to every campaign in the account.
      </p>
      {error ? <p style={{ color: C.danger, fontSize: 13 }}>{error}</p>
        : !rows ? <div className="shimmer" style={{ height: 40, borderRadius: 8, background: '#e8e7e2' }} />
        : rows.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {rows.map(c => (
              <span key={c.assetId} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '5px 6px 5px 12px', fontSize: 13, color: C.ink, background: C.paper }}>
                {c.text}
                <button onClick={() => remove(c)} aria-label={`Remove ${c.text}`} style={{ border: 'none', background: C.canvas, borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: C.graphite }}>×</button>
              </span>
            ))}
          </div>
        ) : <p style={{ fontSize: 13, color: C.stone, margin: '0 0 12px' }}>No callouts yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <input value={l} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? 'Free Shipping Over $35' : 'Handmade To Order'}
              style={{ ...field, paddingRight: 52, borderColor: l.trim().length > CALLOUT_MAX ? C.danger : C.ash }} />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11.5, fontFamily: MONO, color: l.trim().length > CALLOUT_MAX ? C.danger : C.stone }}>{l.trim().length}/{CALLOUT_MAX}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {lines.length < 10 && <button onClick={() => setLines(ls => [...ls, ''])} style={ghost}>+ Another</button>}
          <button onClick={add} disabled={busy || !texts.length || tooLong} style={{ ...blueBtn, opacity: busy || !texts.length || tooLong ? 0.6 : 1 }}>{busy ? 'Adding…' : 'Add callouts'}</button>
        </div>
      </div>
    </Card>
  )
}

// ─── Add keywords to an existing ad group ─────────────────────────────────────
export function AddKeywordsForm({ onClose, onAdded, campaignId }: { onClose: () => void; onAdded: () => void; campaignId?: string }) {
  const { rows: groups } = useList<{ id: string; name: string; campaignId: string; campaignName: string }>('/api/google-ads/ad-groups')
  const [adGroupId, setAdGroupId] = useState('')
  const [match, setMatch] = useState<MatchType>('PHRASE')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const parsed = parseKeywordLines(text, match)
  const options = (groups ?? []).filter(g => !campaignId || g.campaignId === campaignId)
  const chosen = adGroupId || (options.length === 1 ? options[0].id : '')

  const add = async () => {
    if (!chosen) { toast.error('Choose an ad group'); return }
    if (!parsed.keywords.length) { toast.error('Add at least one keyword'); return }
    if (parsed.invalid.length) { toast.error('Fix these keywords', parsed.invalid.slice(0, 3).join(', ')); return }
    setBusy(true)
    try {
      const r = await fetch('/api/google-ads/keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adGroupId: chosen, keywords: parsed.keywords }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) { toast.success('Keywords added', `${j.data.added} keyword${j.data.added === 1 ? '' : 's'} added.`); onAdded() }
      else toast.error('Keywords not added', j?.error || 'Please try again.')
    } catch { toast.error('Network error', 'Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) minmax(260px,1.4fr)', gap: 14 }} className="rsplit">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Labeled label="Ad group">
            <select value={chosen} onChange={e => setAdGroupId(e.target.value)} style={field}>
              <option value="">{groups ? (options.length ? 'Choose…' : 'No ad groups') : 'Loading…'}</option>
              {options.map(g => <option key={g.id} value={g.id}>{g.campaignName} › {g.name}</option>)}
            </select>
          </Labeled>
          <Labeled label="Default match type">
            <select value={match} onChange={e => setMatch(e.target.value as MatchType)} style={field}>
              <option value="BROAD">Broad</option><option value="PHRASE">Phrase</option><option value="EXACT">Exact</option>
            </select>
          </Labeled>
        </div>
        <Labeled label={`Keywords (${parsed.keywords.length}) - one per line, [exact] or "phrase"`}>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5} style={{ ...field, height: 'auto', padding: 10, fontFamily: MONO, resize: 'vertical' }} placeholder={'soy wax candle\n[lavender soy candle]'} />
        </Labeled>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={add} disabled={busy} style={blueBtn}>{busy ? 'Adding…' : 'Add keywords'}</button>
        <button onClick={onClose} style={ghost}>Cancel</button>
      </div>
    </Card>
  )
}

// ─── Negative keywords of one campaign ────────────────────────────────────────
export function NegativeKeywordsEditor({ campaignId }: { campaignId: string }) {
  const { rows, error, reload } = useList<{ criterionId: string; text: string; matchType: string }>(`/api/google-ads/campaigns/${campaignId}/negatives`)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const parsed = parseKeywordLines(text, 'PHRASE')

  const patch = async (body: object, ok: string) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/google-ads/campaigns/${campaignId}/negatives`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) { toast.success(ok); reload(); return true }
      toast.error('Negative keywords not updated', j?.error || 'Please try again.')
    } catch { toast.error('Network error', 'Please try again.') }
    finally { setBusy(false) }
    return false
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {error ? <p style={{ margin: 0, color: C.danger, fontSize: 13 }}>{error}</p>
        : !rows ? <div className="shimmer" style={{ height: 32, borderRadius: 8, background: '#e8e7e2' }} />
        : rows.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {rows.map(n => (
              <span key={n.criterionId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '3px 5px 3px 10px', fontSize: 12.5, fontFamily: MONO, color: C.ink }}>
                {n.matchType === 'EXACT' ? `[${n.text}]` : n.matchType === 'PHRASE' ? `"${n.text}"` : n.text}
                <button disabled={busy} onClick={() => patch({ removeCriterionIds: [n.criterionId] }, `Removed negative keyword “${n.text}”`)} aria-label={`Remove ${n.text}`} style={{ border: 'none', background: C.canvas, borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', color: C.graphite }}>×</button>
              </span>
            ))}
          </div>
        ) : <p style={{ margin: 0, fontSize: 13, color: C.stone }}>No negative keywords.</p>}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={'free\n[diy candle]'} style={{ ...field, height: 'auto', padding: 10, fontFamily: MONO, resize: 'vertical' }} />
      <div>
        <button disabled={busy || !parsed.keywords.length} onClick={async () => { if (await patch({ add: parsed.keywords }, `Added ${parsed.keywords.length} negative keyword${parsed.keywords.length === 1 ? '' : 's'}`)) setText('') }}
          style={{ ...ghost, opacity: busy || !parsed.keywords.length ? 0.6 : 1 }}>Add negative keywords</button>
      </div>
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, fontWeight: 600, color: C.graphite }}>{label}{children}</label>
}

const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 38, border: `1px solid ${C.ash}`, borderRadius: 10, background: C.paper, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', padding: '0 10px', outline: 'none' }
const ghost: React.CSSProperties = { height: 36, borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: '0 12px', cursor: 'pointer', whiteSpace: 'nowrap' }
const blueBtn: React.CSSProperties = { ...ghost, background: '#1A73E8', borderColor: '#1A73E8', color: '#fff' }
