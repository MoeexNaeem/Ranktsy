'use client'
/**
 * Edit an existing Search campaign: name, daily budget, search partners, countries,
 * languages and bidding (Maximize conversions, Target CPA / Target ROAS standard or
 * portfolio, Manual CPC). Only fields that changed are sent, in one Google request.
 */
import { useEffect, useState } from 'react'
import { C } from '@/utils'
import { Card, primaryBtn } from '../kit'
import { toast } from '@/components/ui/toast'
import { AD_COUNTRIES, AD_LANGUAGES, BIDDING_OPTIONS, type BiddingChoice } from '@/lib/google-ads-constants'
import type { AdsAccount } from './Reports'
import { NegativeKeywordsEditor } from './AccountSetup'

interface Settings {
  id: string; name: string; status: string; dailyBudget: number | null; budgetShared: boolean; searchPartners: boolean
  biddingType: string; portfolioStrategyId: string | null; portfolioStrategyName: string | null
  targetCpa: number | null; targetRoasPercent: number | null; maxCpc: number | null
  countryIds: string[]; languageIds: string[]
}
interface Portfolio { id: string; name: string; type: string }

// Google reports standard Target CPA/ROAS as Maximize conversions (value) with a target.
function choiceFrom(s: Settings): BiddingChoice {
  if (s.portfolioStrategyId) return s.biddingType === 'TARGET_ROAS' ? 'TARGET_ROAS' : 'TARGET_CPA'
  if (s.biddingType === 'MANUAL_CPC') return 'MANUAL_CPC'
  if (s.biddingType === 'MAXIMIZE_CONVERSION_VALUE' || s.biddingType === 'TARGET_ROAS') return 'TARGET_ROAS'
  if (s.biddingType === 'TARGET_CPA') return 'TARGET_CPA'
  return s.targetCpa ? 'TARGET_CPA' : 'MAXIMIZE_CONVERSIONS'
}

export function EditCampaignPanel({ account, campaignId, onClose, onSaved }: { account: AdsAccount; campaignId: string; onClose: () => void; onSaved: () => void }) {
  const cur = account.currency || 'USD'
  const [orig, setOrig] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState<boolean | null>(null)
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  const [partners, setPartners] = useState(false)
  const [countries, setCountries] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [bidding, setBidding] = useState<BiddingChoice>('MANUAL_CPC')
  const [targetCpa, setTargetCpa] = useState('')
  const [targetRoas, setTargetRoas] = useState('')
  const [maxCpc, setMaxCpc] = useState('')
  const [portfolio, setPortfolio] = useState<'none' | 'new' | 'existing'>('none')
  const [portfolioName, setPortfolioName] = useState('')
  const [existingStrategyId, setExistingStrategyId] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`/api/google-ads/campaigns/${campaignId}`, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/google-ads/account-status').then(r => r.json()).catch(() => null),
      fetch('/api/google-ads/reports?type=bidding&range=LAST_7_DAYS').then(r => r.json()).catch(() => null),
    ]).then(([s, st, bid]) => {
      if (cancelled) return
      if (!s?.success) { setError(s?.error || 'Could not load this campaign.'); return }
      const d = s.data as Settings
      setOrig(d)
      setName(d.name); setBudget(d.dailyBudget != null ? String(d.dailyBudget) : ''); setPartners(d.searchPartners)
      setCountries(d.countryIds); setLanguages(d.languageIds)
      setBidding(choiceFrom(d))
      setTargetCpa(d.targetCpa != null ? String(d.targetCpa) : ''); setTargetRoas(d.targetRoasPercent != null ? String(d.targetRoasPercent) : '')
      setMaxCpc(d.maxCpc != null ? String(d.maxCpc) : '0.50')
      setPortfolio(d.portfolioStrategyId ? 'existing' : 'none'); setExistingStrategyId(d.portfolioStrategyId ?? '')
      setTracking(st?.success ? !!st.data.conversionTrackingEnabled : true)
      if (bid?.success) setPortfolios((bid.data.rows as (Portfolio & { kind: string })[]).filter(r => r.kind === 'portfolio').map(r => ({ id: r.id, name: r.name, type: r.type })))
    }).catch(() => { if (!cancelled) setError('Network error. Please try again.') })
    return () => { cancelled = true }
  }, [campaignId])

  if (error) return <Card><p style={{ margin: 0, color: C.danger }}>{error}</p><button onClick={onClose} style={{ ...ghostBtn, marginTop: 12 }}>Back</button></Card>
  if (!orig) return <Card><div className="shimmer" style={{ height: 260, borderRadius: 8, background: '#e8e7e2' }} /></Card>

  const canPortfolio = bidding === 'TARGET_CPA' || bidding === 'TARGET_ROAS'
  const effPortfolio = canPortfolio ? portfolio : 'none'
  const origChoice = choiceFrom(orig)
  const biddingChanged =
    bidding !== origChoice ||
    effPortfolio !== (orig.portfolioStrategyId ? 'existing' : 'none') ||
    (effPortfolio === 'existing' && existingStrategyId !== (orig.portfolioStrategyId ?? '')) ||
    (effPortfolio === 'none' && (bidding === 'TARGET_CPA' || bidding === 'MAXIMIZE_CONVERSIONS') && Number(targetCpa || 0) !== Number(orig.targetCpa ?? 0)) ||
    (effPortfolio === 'none' && bidding === 'TARGET_ROAS' && Number(targetRoas || 0) !== Number(orig.targetRoasPercent ?? 0)) ||
    (bidding === 'MANUAL_CPC' && Number(maxCpc || 0) !== Number(orig.maxCpc ?? 0))

  const body = (validateOnly: boolean) => {
    const b: Record<string, unknown> = { validateOnly }
    if (name.trim() !== orig.name) b.name = name.trim()
    if (Number(budget) !== Number(orig.dailyBudget ?? 0)) b.dailyBudget = Number(budget)
    if (partners !== orig.searchPartners) b.searchPartners = partners
    if ([...countries].sort().join() !== [...orig.countryIds].sort().join()) b.countryIds = countries
    if ([...languages].sort().join() !== [...orig.languageIds].sort().join()) b.languageIds = languages
    if (biddingChanged) {
      b.bidding = {
        type: bidding,
        ...((bidding === 'TARGET_CPA' || bidding === 'MAXIMIZE_CONVERSIONS') && Number(targetCpa) > 0 ? { targetCpa: Number(targetCpa) } : {}),
        ...(bidding === 'TARGET_ROAS' && Number(targetRoas) > 0 ? { targetRoasPercent: Number(targetRoas) } : {}),
        ...(bidding === 'MANUAL_CPC' ? { maxCpc: Number(maxCpc) } : {}),
        portfolio: effPortfolio,
        ...(effPortfolio === 'new' && portfolioName.trim() ? { portfolioName: portfolioName.trim() } : {}),
        ...(effPortfolio === 'existing' ? { existingStrategyId } : {}),
      }
    }
    return b
  }
  const changes = Object.keys(body(false)).filter(k => k !== 'validateOnly')

  const problems: string[] = []
  if (!name.trim()) problems.push('Enter a campaign name.')
  if (!(Number(budget) > 0)) problems.push('Enter a daily budget above 0.')
  if (!countries.length) problems.push('Choose at least one country.')
  if (biddingChanged) {
    if (bidding === 'TARGET_CPA' && effPortfolio !== 'existing' && !(Number(targetCpa) > 0)) problems.push('Enter a target CPA.')
    if (bidding === 'TARGET_ROAS' && effPortfolio !== 'existing' && !(Number(targetRoas) > 0)) problems.push('Enter a target ROAS.')
    if (bidding === 'MANUAL_CPC' && !(Number(maxCpc) > 0)) problems.push('Enter a max CPC.')
    if (effPortfolio === 'existing' && !existingStrategyId) problems.push('Choose a portfolio strategy.')
  }

  const save = async () => {
    if (problems.length) { toast.error('Please fix the form', problems[0]); return }
    if (!changes.length) { toast.info('Nothing to save', 'You haven’t changed anything.'); return }
    setBusy(true)
    try {
      const r = await fetch(`/api/google-ads/campaigns/${campaignId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(false)) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) { toast.success('Campaign updated', `Saved: ${(j.data.changed as string[]).join(', ')}.`); onSaved() }
      else toast.error('Changes not saved', j?.error || 'Please try again.')
    } catch { toast.error('Network error', 'Please try again.') }
    finally { setBusy(false) }
  }

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  const matching = portfolios.filter(p => p.type === bidding)

  return (
    <Card pad={26}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, margin: 0 }}>Edit campaign</h2>
          <p style={{ fontSize: 13, color: C.graphite, margin: '4px 0 0' }}>{orig.name} · {orig.status === 'ENABLED' ? 'Enabled' : 'Paused'}</p>
        </div>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
        <Section title="Settings">
          <Field label="Campaign name"><input value={name} onChange={e => setName(e.target.value)} maxLength={255} style={input} /></Field>
          <Field label={`Average daily budget (${cur})`} help={orig.budgetShared ? 'This budget is shared with other campaigns; changing it affects them too.' : undefined}>
            <input type="number" min="0.01" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} style={{ ...input, maxWidth: 200 }} />
          </Field>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: C.ink, cursor: 'pointer' }}>
            <input type="checkbox" checked={partners} onChange={e => setPartners(e.target.checked)} /> Also show on Google search partners
          </label>
        </Section>

        <Section title="Targeting">
          <Field label={`Countries (${countries.length})`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {AD_COUNTRIES.map(c => <button key={c.geoId} onClick={() => toggle(countries, setCountries, c.geoId)} style={{ ...chip, ...(countries.includes(c.geoId) ? chipOn : {}) }}>{c.name}</button>)}
            </div>
          </Field>
          <Field label="Languages" help="None selected = all languages.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {AD_LANGUAGES.map(l => <button key={l.id} onClick={() => toggle(languages, setLanguages, l.id)} style={{ ...chip, ...(languages.includes(l.id) ? chipOn : {}) }}>{l.name}</button>)}
            </div>
          </Field>
        </Section>

        <Section title="Negative keywords (saved immediately)">
          <NegativeKeywordsEditor campaignId={campaignId} />
        </Section>

        <Section title="Bidding">
          {tracking === false && (
            <p style={{ margin: 0, fontSize: 12.5, color: '#8A5A00', background: '#FFF7E6', border: '1px solid #F2D8A7', borderRadius: 8, padding: '8px 12px' }}>
              No conversion tracking in this account, so only <strong>Manual CPC</strong> is available.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BIDDING_OPTIONS.map(o => {
              const locked = o.id !== 'MANUAL_CPC' && tracking === false
              return (
                <button key={o.id} disabled={locked} onClick={() => setBidding(o.id)} title={locked ? 'Needs conversion tracking' : o.help}
                  style={{ ...chip, ...(bidding === o.id ? chipOn : {}), opacity: locked ? 0.5 : 1, cursor: locked ? 'not-allowed' : 'pointer' }}>{o.label}</button>
              )
            })}
          </div>
          {canPortfolio && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['none', 'Standard'], ['new', 'New portfolio'], ['existing', 'Existing portfolio']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setPortfolio(id)} style={{ ...chip, ...(portfolio === id ? chipOn : {}) }}>{label}</button>
              ))}
            </div>
          )}
          {effPortfolio === 'new' && <Field label="Portfolio strategy name"><input value={portfolioName} onChange={e => setPortfolioName(e.target.value)} style={input} /></Field>}
          {effPortfolio === 'existing' && (
            <Field label="Portfolio strategy" help="To change a portfolio's target, use Edit target in Bidding strategies.">
              <select value={existingStrategyId} onChange={e => setExistingStrategyId(e.target.value)} style={{ ...input, maxWidth: 360 }}>
                <option value="">{matching.length ? 'Choose…' : 'No matching portfolio strategies'}</option>
                {matching.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          {(bidding === 'TARGET_CPA' || bidding === 'MAXIMIZE_CONVERSIONS') && effPortfolio !== 'existing' && (
            <Field label={`Target CPA (${cur})${bidding === 'MAXIMIZE_CONVERSIONS' ? ' - optional' : ''}`}><input type="number" min="0.01" step="0.01" value={targetCpa} onChange={e => setTargetCpa(e.target.value)} style={{ ...input, maxWidth: 200 }} /></Field>
          )}
          {bidding === 'TARGET_ROAS' && effPortfolio !== 'existing' && (
            <Field label="Target ROAS (%)"><input type="number" min="1" step="1" value={targetRoas} onChange={e => setTargetRoas(e.target.value)} style={{ ...input, maxWidth: 200 }} /></Field>
          )}
          {bidding === 'MANUAL_CPC' && (
            <Field label={`Max CPC for all ad groups (${cur})`}><input type="number" min="0.01" step="0.01" value={maxCpc} onChange={e => setMaxCpc(e.target.value)} style={{ ...input, maxWidth: 200 }} /></Field>
          )}
        </Section>

        {problems.length > 0 && <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{problems[0]}</p>}
        <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={save} disabled={busy || !!problems.length} style={{ ...primaryBtn, background: '#1A73E8', opacity: busy || problems.length ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save changes'}</button>
          <span style={{ fontSize: 12.5, color: C.graphite }}>{changes.length ? `Changing: ${changes.map(c => ({ name: 'name', dailyBudget: 'budget', searchPartners: 'networks', countryIds: 'countries', languageIds: 'languages', bidding: 'bidding' } as Record<string, string>)[c]).join(', ')}` : 'No changes yet'}</span>
        </div>
      </div>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${C.hair}`, borderRadius: 12, padding: 16 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</p>
      {children}
    </div>
  )
}
function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 13.5, fontWeight: 600, color: C.ink }}>{label}</p>
      {help && <p style={{ margin: '-2px 0 8px', fontSize: 12.5, color: C.graphite }}>{help}</p>}
      {children}
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40, border: `1px solid ${C.ash}`, borderRadius: 10, background: C.paper, color: C.ink, fontSize: 14, fontFamily: 'inherit', padding: '0 12px', outline: 'none' }
const ghostBtn: React.CSSProperties = { height: 38, borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', padding: '0 14px', cursor: 'pointer' }
const chip: React.CSSProperties = { border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, borderRadius: 100, padding: '6px 12px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }
const chipOn: React.CSSProperties = { background: '#E8F0FE', borderColor: '#1A73E8', color: '#1A73E8', fontWeight: 600 }
