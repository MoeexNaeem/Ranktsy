'use client'
/**
 * Create a Google Search campaign in 5 steps: Campaign (budget + bidding) → Targeting
 * (countries, languages, networks) → Keywords (ad group, keywords with match types,
 * negative keywords) → Ad (responsive search ad) → Review. The whole campaign is sent
 * to Google in one request and created PAUSED. "Check with Google" validates without
 * creating anything.
 */
import { useEffect, useMemo, useState } from 'react'
import { C, D } from '@/utils'
import { Card, MONO, primaryBtn } from '../kit'
import { toast } from '@/components/ui/toast'
import {
  AD_COUNTRIES, AD_LANGUAGES, BIDDING_OPTIONS, RSA, parseKeywordLines, GADS_PREFILL_KEY,
  type BiddingChoice, type MatchType,
} from '@/lib/google-ads-constants'
import type { AdsAccount } from './Reports'

export { GADS_PREFILL_KEY }

const STEPS = ['Campaign', 'Targeting', 'Keywords', 'Ad', 'Review'] as const

interface Portfolio { id: string; name: string; type: string }

export function CreateCampaignWizard({ account, onClose, onCreated }: { account: AdsAccount; onClose: () => void; onCreated: () => void }) {
  const cur = account.currency || 'USD'
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState<'check' | 'create' | null>(null)
  const [checked, setChecked] = useState(false)

  // Step 1
  const [campaignName, setCampaignName] = useState('')
  const [dailyBudget, setDailyBudget] = useState('10')
  const [bidding, setBidding] = useState<BiddingChoice>('MAXIMIZE_CONVERSIONS')
  const [targetCpa, setTargetCpa] = useState('')
  const [targetRoas, setTargetRoas] = useState('400')
  const [maxCpc, setMaxCpc] = useState('0.50')
  const [portfolio, setPortfolio] = useState<'none' | 'new' | 'existing'>('none')
  const [portfolioName, setPortfolioName] = useState('')
  const [existingStrategyId, setExistingStrategyId] = useState('')
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  // null = still checking. Conversion-based bidding needs conversion tracking in the account.
  const [tracking, setTracking] = useState<boolean | null>(null)
  // Step 2
  const [countryIds, setCountryIds] = useState<string[]>(['2840'])
  const [languageIds, setLanguageIds] = useState<string[]>(['1000'])
  const [searchPartners, setSearchPartners] = useState(false)
  // Step 3
  const [adGroupName, setAdGroupName] = useState('Ad group 1')
  const [defaultMatch, setDefaultMatch] = useState<MatchType>('PHRASE')
  const [keywordText, setKeywordText] = useState('')
  const [negativeText, setNegativeText] = useState('')
  // Step 4
  const [finalUrl, setFinalUrl] = useState('')
  const [headlines, setHeadlines] = useState<string[]>(['', '', ''])
  const [descriptions, setDescriptions] = useState<string[]>(['', ''])
  const [path1, setPath1] = useState('')
  const [path2, setPath2] = useState('')

  // Prefill keywords handed over from another tool (e.g. Keyword Search).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(GADS_PREFILL_KEY)
      if (!raw) return
      sessionStorage.removeItem(GADS_PREFILL_KEY)
      const p = JSON.parse(raw) as { keywords?: string[]; name?: string }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (p.keywords?.length) setKeywordText(p.keywords.join('\n'))
      if (p.name) { setCampaignName(p.name); setAdGroupName(p.name) }
    } catch { /* storage blocked */ }
  }, [])

  // Conversion tracking decides which bidding options Google will accept.
  useEffect(() => {
    fetch('/api/google-ads/account-status').then(r => r.json()).then(j => {
      const enabled = j?.success ? !!j.data.conversionTrackingEnabled : true // unknown: let Google decide
      setTracking(enabled)
      if (!enabled) setBidding(b => (b === 'MANUAL_CPC' ? b : 'MANUAL_CPC'))
    }).catch(() => setTracking(true))
  }, [])

  // Existing portfolio strategies (for "use an existing portfolio strategy").
  useEffect(() => {
    fetch('/api/google-ads/reports?type=bidding&range=LAST_7_DAYS').then(r => r.json()).then(j => {
      if (j?.success) setPortfolios((j.data.rows as (Portfolio & { kind: string })[]).filter(r => r.kind === 'portfolio').map(r => ({ id: r.id, name: r.name, type: r.type })))
    }).catch(() => {})
  }, [])

  const kw = useMemo(() => parseKeywordLines(keywordText, defaultMatch), [keywordText, defaultMatch])
  const neg = useMemo(() => parseKeywordLines(negativeText, 'PHRASE'), [negativeText])
  const filledHeadlines = headlines.map(h => h.trim()).filter(Boolean)
  const filledDescriptions = descriptions.map(d => d.trim()).filter(Boolean)
  const canPortfolio = BIDDING_OPTIONS.find(o => o.id === bidding)?.portfolio ?? false
  const effectivePortfolio = canPortfolio ? portfolio : 'none'
  const matchingPortfolios = portfolios.filter(p => p.type === bidding)

  // Per-step problems (shown inline; Next is blocked until fixed).
  const problems = useMemo(() => {
    const p: string[][] = [[], [], [], [], []]
    if (!campaignName.trim()) p[0].push('Enter a campaign name.')
    if (!(Number(dailyBudget) > 0)) p[0].push('Enter a daily budget above 0.')
    if (bidding === 'TARGET_CPA' && effectivePortfolio !== 'existing' && !(Number(targetCpa) > 0)) p[0].push('Enter a target CPA.')
    if (bidding === 'TARGET_ROAS' && effectivePortfolio !== 'existing' && !(Number(targetRoas) > 0)) p[0].push('Enter a target ROAS.')
    if (bidding === 'MANUAL_CPC' && !(Number(maxCpc) > 0)) p[0].push('Enter a default max CPC.')
    if (effectivePortfolio === 'existing' && !existingStrategyId) p[0].push('Choose a portfolio strategy.')
    if (!countryIds.length) p[1].push('Choose at least one country.')
    if (!adGroupName.trim()) p[2].push('Enter an ad group name.')
    if (!kw.keywords.length) p[2].push('Add at least one keyword.')
    if (kw.invalid.length) p[2].push(`Fix these keywords (max ${80} characters, ${10} words, no special symbols): ${kw.invalid.slice(0, 3).join(', ')}`)
    if (neg.invalid.length) p[2].push(`Fix these negative keywords: ${neg.invalid.slice(0, 3).join(', ')}`)
    if (!/^https?:\/\/\S+\.\S+/i.test(finalUrl.trim())) p[3].push('Enter the full landing page URL, starting with https://')
    if (filledHeadlines.length < RSA.headlinesMin) p[3].push(`Add at least ${RSA.headlinesMin} headlines.`)
    if (headlines.some(h => h.trim().length > RSA.headlineMax)) p[3].push(`Headlines can be at most ${RSA.headlineMax} characters.`)
    if (new Set(filledHeadlines.map(h => h.toLowerCase())).size !== filledHeadlines.length) p[3].push('Headlines must all be different.')
    if (filledDescriptions.length < RSA.descriptionsMin) p[3].push(`Add at least ${RSA.descriptionsMin} descriptions.`)
    if (descriptions.some(d => d.trim().length > RSA.descriptionMax)) p[3].push(`Descriptions can be at most ${RSA.descriptionMax} characters.`)
    if (path2.trim() && !path1.trim()) p[3].push('Fill Path 1 before Path 2.')
    return p
  }, [campaignName, dailyBudget, bidding, effectivePortfolio, targetCpa, targetRoas, maxCpc, existingStrategyId, countryIds, adGroupName, kw, neg, finalUrl, filledHeadlines, headlines, filledDescriptions, descriptions, path1, path2])

  const allProblems = problems.flat()
  const payload = (validateOnly: boolean) => ({
    validateOnly,
    campaignName: campaignName.trim(),
    dailyBudget: Number(dailyBudget),
    bidding: {
      type: bidding,
      ...(bidding === 'TARGET_CPA' || (bidding === 'MAXIMIZE_CONVERSIONS' && Number(targetCpa) > 0) ? { targetCpa: Number(targetCpa) || undefined } : {}),
      ...(bidding === 'TARGET_ROAS' ? { targetRoasPercent: Number(targetRoas) || undefined } : {}),
      ...(bidding === 'MANUAL_CPC' ? { maxCpc: Number(maxCpc) } : {}),
      portfolio: effectivePortfolio,
      ...(effectivePortfolio === 'new' ? { portfolioName: portfolioName.trim() || undefined } : {}),
      ...(effectivePortfolio === 'existing' ? { existingStrategyId } : {}),
    },
    searchPartners,
    countryIds,
    languageIds,
    adGroupName: adGroupName.trim(),
    keywords: kw.keywords,
    negativeKeywords: neg.keywords,
    ad: { finalUrl: finalUrl.trim(), headlines: filledHeadlines, descriptions: filledDescriptions, path1: path1.trim(), path2: path2.trim() },
  })

  const submit = async (validateOnly: boolean) => {
    if (allProblems.length) { toast.error('Please fix the form first', allProblems[0]); return }
    setBusy(validateOnly ? 'check' : 'create')
    try {
      const r = await fetch('/api/google-ads/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload(validateOnly)) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success) {
        if (validateOnly) { setChecked(true); toast.success('Google approved the setup', 'Everything checks out. You can create the campaign.') }
        else { toast.success('Campaign created (paused)', `“${campaignName.trim()}” is in your Google Ads account. Enable it when you’re ready.`); onCreated() }
      } else {
        toast.error(validateOnly ? 'Google found a problem' : 'Campaign not created', j?.error || 'Please check the form and try again.')
      }
    } catch { toast.error('Network error', 'Please try again.') }
    finally { setBusy(null) }
  }

  const next = () => {
    if (problems[step].length) { toast.error('Please fix this step', problems[step][0]); return }
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  return (
    <Card pad={26}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, margin: 0 }}>New Search campaign</h2>
          <p style={{ fontSize: 13, color: C.graphite, margin: '4px 0 0' }}>In {account.name}{account.testAccount ? ' (test account)' : ''}. It’s created <strong>paused</strong>, so nothing spends until you enable it.</p>
        </div>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => {
          const done = i < step, active = i === step
          return (
            <button key={s} onClick={() => { if (i <= step || problems.slice(0, i).every(p => !p.length)) setStep(i) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: active ? '#E8F0FE' : 'transparent', color: active ? '#1A73E8' : done ? C.ink : C.stone, borderRadius: 100, padding: '6px 12px 6px 6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, background: active ? '#1A73E8' : done ? D.good : C.bone, color: active || done ? '#fff' : C.graphite }}>{done ? '✓' : i + 1}</span>
              {s}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
        {step === 0 && (
          <>
            <Field label="Campaign name"><input value={campaignName} onChange={e => setCampaignName(e.target.value)} maxLength={255} placeholder="e.g. Handmade candles - US" style={input} /></Field>
            <Field label={`Average daily budget (${cur})`} help="Google may spend up to 2x this on a busy day, but not more than 30.4x per month.">
              <input type="number" min="0.01" step="0.01" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} style={{ ...input, maxWidth: 200 }} />
            </Field>
            <Field label="Bidding">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
                {BIDDING_OPTIONS.map(o => {
                  const needsTracking = o.id !== 'MANUAL_CPC' && tracking === false
                  return (
                    <button key={o.id} disabled={needsTracking} onClick={() => { setBidding(o.id); setChecked(false) }}
                      title={needsTracking ? 'Needs conversion tracking in this Google Ads account' : undefined}
                      style={{ textAlign: 'left', border: `2px solid ${bidding === o.id ? '#1A73E8' : C.ash}`, background: bidding === o.id ? '#F4F8FE' : C.paper, borderRadius: 12, padding: '12px 14px', cursor: needsTracking ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: needsTracking ? 0.55 : 1 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.ink }}>{o.label}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.graphite, lineHeight: 1.45 }}>{o.help}</p>
                      {needsTracking && <p style={{ margin: '6px 0 0', fontSize: 11.5, fontWeight: 700, color: '#8A5A00' }}>Needs conversion tracking</p>}
                    </button>
                  )
                })}
              </div>
            </Field>
            {tracking === false && (
              <p style={{ margin: 0, fontSize: 12.5, color: '#8A5A00', background: '#FFF7E6', border: '1px solid #F2D8A7', borderRadius: 8, padding: '8px 12px', lineHeight: 1.55 }}>
                This Google Ads account has <strong>no conversion tracking</strong>, so Google only allows <strong>Manual CPC</strong> for now.
                Maximize conversions, Target CPA and Target ROAS unlock once conversion tracking is set up.
              </p>
            )}
            {canPortfolio && (
              <Field label="Strategy type" help="A portfolio strategy can be shared by several campaigns.">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {([['none', 'Standard (this campaign only)'], ['new', 'New portfolio strategy'], ['existing', 'Existing portfolio strategy']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setPortfolio(id)} style={{ ...chip, ...(portfolio === id ? chipOn : {}) }}>{label}</button>
                  ))}
                </div>
              </Field>
            )}
            {effectivePortfolio === 'new' && (
              <Field label="Portfolio strategy name"><input value={portfolioName} onChange={e => setPortfolioName(e.target.value)} maxLength={255} placeholder="e.g. Shop-wide Target CPA" style={input} /></Field>
            )}
            {effectivePortfolio === 'existing' && (
              <Field label="Portfolio strategy">
                <select value={existingStrategyId} onChange={e => setExistingStrategyId(e.target.value)} style={{ ...input, maxWidth: 360 }}>
                  <option value="">{matchingPortfolios.length ? 'Choose…' : 'No matching portfolio strategies in this account'}</option>
                  {matchingPortfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
            {(bidding === 'TARGET_CPA' || bidding === 'MAXIMIZE_CONVERSIONS') && effectivePortfolio !== 'existing' && (
              <Field label={`Target cost per conversion (${cur})${bidding === 'MAXIMIZE_CONVERSIONS' ? ' - optional' : ''}`}>
                <input type="number" min="0.01" step="0.01" value={targetCpa} onChange={e => setTargetCpa(e.target.value)} style={{ ...input, maxWidth: 200 }} />
              </Field>
            )}
            {bidding === 'TARGET_ROAS' && effectivePortfolio !== 'existing' && (
              <Field label="Target return on ad spend (%)" help="400% means 4 in conversion value for every 1 spent.">
                <input type="number" min="1" step="1" value={targetRoas} onChange={e => setTargetRoas(e.target.value)} style={{ ...input, maxWidth: 200 }} />
              </Field>
            )}
            {bidding === 'MANUAL_CPC' && (
              <Field label={`Default max CPC (${cur})`}><input type="number" min="0.01" step="0.01" value={maxCpc} onChange={e => setMaxCpc(e.target.value)} style={{ ...input, maxWidth: 200 }} /></Field>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Field label={`Countries (${countryIds.length} selected)`} help="Show ads to people in, or regularly interested in, these countries.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {AD_COUNTRIES.map(c => (
                  <button key={c.geoId} onClick={() => toggle(countryIds, setCountryIds, c.geoId)} style={{ ...chip, ...(countryIds.includes(c.geoId) ? chipOn : {}) }}>{c.name}</button>
                ))}
              </div>
            </Field>
            <Field label="Languages" help="Leave all unselected to target every language.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {AD_LANGUAGES.map(l => (
                  <button key={l.id} onClick={() => toggle(languageIds, setLanguageIds, l.id)} style={{ ...chip, ...(languageIds.includes(l.id) ? chipOn : {}) }}>{l.name}</button>
                ))}
              </div>
            </Field>
            <Field label="Networks">
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: C.ink }}>
                <input type="checkbox" checked disabled /> Google Search
              </label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: C.ink, marginTop: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={searchPartners} onChange={e => setSearchPartners(e.target.checked)} /> Also show on Google search partners
              </label>
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Ad group name"><input value={adGroupName} onChange={e => setAdGroupName(e.target.value)} maxLength={255} style={input} /></Field>
            <Field label="Default match type" help={'Per keyword: [exact], "phrase", or plain text for the default.'}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['BROAD', 'PHRASE', 'EXACT'] as MatchType[]).map(m => (
                  <button key={m} onClick={() => setDefaultMatch(m)} style={{ ...chip, ...(defaultMatch === m ? chipOn : {}) }}>{m.charAt(0) + m.slice(1).toLowerCase()}</button>
                ))}
              </div>
            </Field>
            <Field label={`Keywords (${kw.keywords.length})`} help="One per line.">
              <textarea value={keywordText} onChange={e => setKeywordText(e.target.value)} rows={7} placeholder={'handmade soy candle\n[lavender candle gift]\n"personalized candle"'} style={{ ...input, height: 'auto', padding: 12, fontFamily: MONO, resize: 'vertical' }} />
              {kw.keywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {kw.keywords.slice(0, 40).map(k => <span key={`${k.matchType}${k.text}`} style={tag}>{k.matchType === 'EXACT' ? `[${k.text}]` : k.matchType === 'PHRASE' ? `"${k.text}"` : k.text}</span>)}
                  {kw.keywords.length > 40 && <span style={{ fontSize: 12, color: C.stone }}>+{kw.keywords.length - 40} more</span>}
                </div>
              )}
            </Field>
            <Field label={`Negative keywords (${neg.keywords.length}) - optional`} help="Searches containing these won't show your ads (whole campaign). Same syntax; plain text = phrase match.">
              <textarea value={negativeText} onChange={e => setNegativeText(e.target.value)} rows={4} placeholder={'free\ndiy\ncheap'} style={{ ...input, height: 'auto', padding: 12, fontFamily: MONO, resize: 'vertical' }} />
            </Field>
          </>
        )}

        {step === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(260px,340px)', gap: 20 }} className="rsplit">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Final URL" help="Where people land after clicking, e.g. your Etsy listing or shop page.">
                <input value={finalUrl} onChange={e => setFinalUrl(e.target.value)} placeholder="https://www.etsy.com/shop/YourShop" style={input} />
              </Field>
              <Field label="Display path (optional)">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: C.stone }}>/</span>
                  <input value={path1} onChange={e => setPath1(e.target.value)} maxLength={RSA.pathMax} placeholder="candles" style={{ ...input, maxWidth: 160 }} />
                  <span style={{ fontSize: 13, color: C.stone }}>/</span>
                  <input value={path2} onChange={e => setPath2(e.target.value)} maxLength={RSA.pathMax} placeholder="gifts" style={{ ...input, maxWidth: 160 }} />
                </div>
              </Field>
              <Field label={`Headlines (${filledHeadlines.length}/${RSA.headlinesMax})`} help={`At least ${RSA.headlinesMin}, up to ${RSA.headlineMax} characters each. Google mixes them.`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {headlines.map((h, i) => (
                    <CountedInput key={i} value={h} max={RSA.headlineMax} placeholder={`Headline ${i + 1}`}
                      onChange={v => setHeadlines(hs => hs.map((x, j) => (j === i ? v : x)))}
                      onRemove={headlines.length > RSA.headlinesMin ? () => setHeadlines(hs => hs.filter((_, j) => j !== i)) : undefined} />
                  ))}
                  {headlines.length < RSA.headlinesMax && <button onClick={() => setHeadlines(hs => [...hs, ''])} style={{ ...ghostBtn, alignSelf: 'flex-start' }}>+ Add headline</button>}
                </div>
              </Field>
              <Field label={`Descriptions (${filledDescriptions.length}/${RSA.descriptionsMax})`} help={`At least ${RSA.descriptionsMin}, up to ${RSA.descriptionMax} characters each.`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {descriptions.map((d, i) => (
                    <CountedInput key={i} value={d} max={RSA.descriptionMax} placeholder={`Description ${i + 1}`}
                      onChange={v => setDescriptions(ds => ds.map((x, j) => (j === i ? v : x)))}
                      onRemove={descriptions.length > RSA.descriptionsMin ? () => setDescriptions(ds => ds.filter((_, j) => j !== i)) : undefined} />
                  ))}
                  {descriptions.length < RSA.descriptionsMax && <button onClick={() => setDescriptions(ds => [...ds, ''])} style={{ ...ghostBtn, alignSelf: 'flex-start' }}>+ Add description</button>}
                </div>
              </Field>
            </div>
            <AdPreview finalUrl={finalUrl} path1={path1} path2={path2} headlines={filledHeadlines} descriptions={filledDescriptions} />
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Summary rows={[
              ['Campaign', `${campaignName} · Search · created paused`],
              ['Budget', `${Number(dailyBudget).toFixed(2)} ${cur} per day`],
              ['Bidding', `${BIDDING_OPTIONS.find(o => o.id === bidding)?.label}${effectivePortfolio === 'new' ? ' (new portfolio)' : effectivePortfolio === 'existing' ? ` (portfolio: ${portfolios.find(p => p.id === existingStrategyId)?.name ?? ''})` : ''}${bidding === 'TARGET_CPA' && effectivePortfolio !== 'existing' ? ` · ${targetCpa} ${cur}` : ''}${bidding === 'TARGET_ROAS' && effectivePortfolio !== 'existing' ? ` · ${targetRoas}%` : ''}${bidding === 'MANUAL_CPC' ? ` · max ${maxCpc} ${cur}` : ''}`],
              ['Countries', countryIds.map(id => AD_COUNTRIES.find(c => c.geoId === id)?.name).join(', ')],
              ['Languages', languageIds.length ? languageIds.map(id => AD_LANGUAGES.find(l => l.id === id)?.name).join(', ') : 'All languages'],
              ['Networks', searchPartners ? 'Google Search + search partners' : 'Google Search'],
              ['Ad group', adGroupName],
              ['Keywords', `${kw.keywords.length} (${kw.keywords.slice(0, 6).map(k => k.text).join(', ')}${kw.keywords.length > 6 ? '…' : ''})`],
              ['Negative keywords', neg.keywords.length ? `${neg.keywords.length} (${neg.keywords.slice(0, 6).map(k => k.text).join(', ')})` : 'None'],
              ['Ad', `${filledHeadlines.length} headlines, ${filledDescriptions.length} descriptions → ${finalUrl}`],
            ]} />
            {allProblems.length > 0 && (
              <p style={{ margin: 0, fontSize: 13, color: C.danger, background: C.dangerBg, borderRadius: 8, padding: '8px 12px' }}>Fix before creating: {allProblems[0]}</p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => submit(true)} disabled={!!busy || allProblems.length > 0} style={{ ...ghostBtn, height: 46, padding: '0 20px' }}>
                {busy === 'check' ? 'Checking…' : checked ? '✓ Checked with Google' : 'Check with Google'}
              </button>
              <button onClick={() => submit(false)} disabled={!!busy || allProblems.length > 0} style={{ ...primaryBtn, background: '#1A73E8', opacity: busy || allProblems.length ? 0.6 : 1 }}>
                {busy === 'create' ? 'Creating…' : 'Create campaign (paused)'}
              </button>
            </div>
          </div>
        )}

        {problems[step].length > 0 && step < 4 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.graphite, lineHeight: 1.7 }}>
            {problems[step].map(p => <li key={p}>{p}</li>)}
          </ul>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.hair}`, paddingTop: 16 }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{ ...ghostBtn, opacity: step === 0 ? 0.4 : 1 }}>← Back</button>
          {step < STEPS.length - 1 && <button onClick={next} style={{ ...primaryBtn, height: 40, background: '#1A73E8' }}>Next: {STEPS[step + 1]} →</button>}
        </div>
      </div>
    </Card>
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

function CountedInput({ value, max, placeholder, onChange, onRemove }: { value: string; max: number; placeholder: string; onChange: (v: string) => void; onRemove?: () => void }) {
  const over = value.length > max
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...input, paddingRight: 56, borderColor: over ? C.danger : C.ash }} />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11.5, fontFamily: MONO, color: over ? C.danger : C.stone }}>{value.length}/{max}</span>
      </div>
      {onRemove && <button onClick={onRemove} aria-label="Remove" style={{ ...ghostBtn, width: 36, padding: 0 }}>×</button>}
    </div>
  )
}

function AdPreview({ finalUrl, path1, path2, headlines, descriptions }: { finalUrl: string; path1: string; path2: string; headlines: string[]; descriptions: string[] }) {
  let host = 'www.example.com'
  try { if (finalUrl) host = new URL(finalUrl).hostname } catch { /* typing */ }
  const path = [path1, path2].map(p => p.trim()).filter(Boolean).join('/')
  return (
    <div style={{ alignSelf: 'start', position: 'sticky', top: 12 }}>
      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</p>
      <div style={{ border: `1px solid ${C.ash}`, borderRadius: 12, padding: 16, background: '#fff', fontFamily: 'Arial, sans-serif' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#202124' }}><strong>Sponsored</strong></p>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#202124' }}>{host}{path ? ` › ${path.replace('/', ' › ')}` : ''}</p>
        <p style={{ margin: '6px 0 0', fontSize: 18, lineHeight: 1.3, color: '#1a0dab' }}>{headlines.slice(0, 3).join(' | ') || 'Your headlines appear here'}</p>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.5, color: '#4d5156' }}>{descriptions.slice(0, 2).join(' ') || 'Your descriptions appear here.'}</p>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: C.stone }}>One possible combination. Google tests different mixes of your headlines and descriptions.</p>
    </div>
  )
}

function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ border: `1px solid ${C.ash}`, borderRadius: 12, overflow: 'hidden' }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, padding: '10px 14px', background: i % 2 ? C.canvas : C.paper, fontSize: 13.5 }}>
          <span style={{ color: C.graphite, fontWeight: 600 }}>{k}</span>
          <span style={{ color: C.ink, wordBreak: 'break-word' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40, border: `1px solid ${C.ash}`, borderRadius: 10, background: C.paper, color: C.ink, fontSize: 14, fontFamily: 'inherit', padding: '0 12px', outline: 'none' }
const ghostBtn: React.CSSProperties = { height: 38, borderRadius: 10, border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', padding: '0 14px', cursor: 'pointer' }
const chip: React.CSSProperties = { border: `1px solid ${C.ash}`, background: C.paper, color: C.ink, borderRadius: 100, padding: '6px 12px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }
const chipOn: React.CSSProperties = { background: '#E8F0FE', borderColor: '#1A73E8', color: '#1A73E8', fontWeight: 600 }
const tag: React.CSSProperties = { fontSize: 12, fontFamily: MONO, background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '3px 10px', color: C.ink }
