'use client'
import { useMemo, useState } from 'react'
import { C } from '@/utils'
import { Reveal } from './Reveal'

/**
 * Public Etsy Fee Calculator — landing section (Huddle-styled).
 * Same fee model as the dashboard tool. Estimates only; Etsy sets actual rates.
 */
const MONO = "'General Sans',monospace"
const LISTING_FEE = 0.20
const TRANSACTION_RATE = 0.065
const OFFSITE_ADS_RATE = 0.15

const PROCESSING: Record<string, { label: string; rate: number; flat: number; cur: string }> = {
  US: { label: 'United States',  rate: 0.03, flat: 0.25, cur: '$' },
  GB: { label: 'United Kingdom',  rate: 0.04, flat: 0.20, cur: '£' },
  EU: { label: 'Eurozone (EU)',   rate: 0.04, flat: 0.30, cur: '€' },
  CA: { label: 'Canada',          rate: 0.03, flat: 0.25, cur: 'C$' },
  AU: { label: 'Australia',       rate: 0.03, flat: 0.25, cur: 'A$' },
  NZ: { label: 'New Zealand',     rate: 0.03, flat: 0.25, cur: 'NZ$' },
}

const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) && n > 0 ? n : 0 }

function Field({ label, value, onChange, prefix, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6E6E64', marginBottom: 8 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', background: C.paper, border: `1px solid ${C.hair}`, borderRadius: 8, overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 2px 0 12px', fontSize: 13, color: '#808080', fontFamily: MONO, flexShrink: 0 }}>{prefix}</span>}
        <input type="number" min="0" step="0.01" inputMode="decimal" value={value} placeholder={placeholder ?? '0.00'}
          onChange={e => onChange(e.target.value)}
          style={{ background: 'transparent', border: 'none', padding: '11px 10px', fontSize: 14, fontFamily: MONO, outline: 'none', flex: 1, color: '#1a1a1a', width: '100%', minWidth: 0 }} />
      </div>
    </label>
  )
}

function Row({ label, value, cur, strong, accent }: { label: string; value: number; cur: string; strong?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.hair}` }}>
      <span style={{ fontSize: strong ? 13 : 12.5, fontWeight: strong ? 500 : 400, color: strong ? C.ink : '#6E6E64' }}>{label}</span>
      <span style={{ fontSize: strong ? 13.5 : 13, fontWeight: strong ? 500 : 400, fontFamily: MONO, color: accent ?? (strong ? C.ink : '#6E6E64') }}>
        {value < 0 ? '-' : ''}{cur}{Math.abs(value).toFixed(2)}
      </span>
    </div>
  )
}

export function FeeCalculatorSection() {
  const [price, setPrice] = useState('25.00')
  const [shipping, setShipping] = useState('5.00')
  const [cost, setCost] = useState('8.00')
  const [qty, setQty] = useState('1')
  const [region, setRegion] = useState('US')
  const [offsiteAds, setOffsiteAds] = useState(false)

  const proc = PROCESSING[region]
  const cur = proc.cur

  const r = useMemo(() => {
    const quantity = Math.max(1, Math.floor(num(qty) || 1))
    const revenue = (num(price) + num(shipping)) * quantity
    const listingFee = LISTING_FEE * quantity
    const transactionFee = revenue * TRANSACTION_RATE
    const processingFee = revenue * proc.rate + proc.flat
    const adsFee = offsiteAds ? revenue * OFFSITE_ADS_RATE : 0
    const totalFees = listingFee + transactionFee + processingFee + adsFee
    const itemCostTotal = num(cost) * quantity
    const net = revenue - totalFees - itemCostTotal
    const margin = revenue > 0 ? (net / revenue) * 100 : 0
    const feeRate = TRANSACTION_RATE + proc.rate + (offsiteAds ? OFFSITE_ADS_RATE : 0)
    const breakEven = Math.max(0, (LISTING_FEE * quantity + proc.flat + itemCostTotal) / (1 - feeRate) / quantity - num(shipping))
    return { quantity, revenue, listingFee, transactionFee, processingFee, adsFee, totalFees, itemCostTotal, net, margin, breakEven }
  }, [price, shipping, cost, qty, offsiteAds, proc.rate, proc.flat])

  const netAccent = r.net >= 0 ? C.success : C.danger

  return (
    <section id="fee-calculator" style={{ padding: '150px 40px 96px', background: C.canvas, minHeight: '100vh' }}>
      <Reveal style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#6E6E64', marginBottom: 18 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
          Fee Calculator
        </div>
        <h2 style={{ fontSize: 'clamp(34px,4.6vw,56px)', fontWeight: 500, letterSpacing: '-0.03em', color: C.ink, lineHeight: 1.0, marginBottom: 16, maxWidth: 760 }}>
          Know your profit before you list.
        </h2>
        <p style={{ fontSize: 18, color: '#6E6E64', lineHeight: 1.5, letterSpacing: '-0.14px', maxWidth: 520, marginBottom: 48 }}>
          Estimate Etsy&apos;s listing, transaction, and payment-processing fees — and see exactly what you keep.
        </p>

        <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 16, alignItems: 'start' }}>
          {/* Inputs */}
          <div style={{ background: C.paper, border: `1px solid ${C.hairInk}`, borderRadius: 8, padding: '24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 16, letterSpacing: '-0.3px' }}>Order details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Item price" value={price} onChange={setPrice} prefix={cur} />
                <Field label="Shipping charged" value={shipping} onChange={setShipping} prefix={cur} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Item cost" value={cost} onChange={setCost} prefix={cur} />
                <Field label="Quantity" value={qty} onChange={setQty} placeholder="1" />
              </div>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 11, fontFamily: MONO, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6E6E64', marginBottom: 8 }}>Region</span>
                <select value={region} onChange={e => setRegion(e.target.value)}
                  style={{ width: '100%', background: C.paper, border: `1px solid ${C.hair}`, borderRadius: 8, padding: '11px 12px', fontSize: 13, fontFamily: 'inherit', color: '#1a1a1a', outline: 'none', cursor: 'pointer' }}>
                  {Object.entries(PROCESSING).map(([k, v]) => <option key={k} value={k}>{v.label} — {(v.rate * 100).toFixed(0)}% + {v.cur}{v.flat.toFixed(2)}</option>)}
                </select>
              </label>
              <button onClick={() => setOffsiteAds(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: offsiteAds ? C.softOrange : C.canvas, border: `1px solid ${offsiteAds ? C.orange : C.hair}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                <span style={{ width: 34, height: 20, borderRadius: 999, background: offsiteAds ? C.orange : '#d8d6d0', position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
                  <span style={{ position: 'absolute', top: 2, left: offsiteAds ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: C.ink }}>Offsite Ads fee (15%)</span>
              </button>
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ background: C.paper, border: `1px solid ${C.hairInk}`, borderRadius: 8, padding: '24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, color: C.ink, marginBottom: 16, letterSpacing: '-0.3px' }}>Fee breakdown</h3>
            <Row label="Revenue (item + shipping)" value={r.revenue} cur={cur} strong />
            <Row label="Listing fee" value={-r.listingFee} cur={cur} accent="#6E6E64" />
            <Row label="Transaction fee (6.5%)" value={-r.transactionFee} cur={cur} accent="#6E6E64" />
            <Row label={`Payment processing (${(proc.rate * 100).toFixed(0)}% + ${cur}${proc.flat.toFixed(2)})`} value={-r.processingFee} cur={cur} accent="#6E6E64" />
            {r.adsFee > 0 && <Row label="Offsite Ads (15%)" value={-r.adsFee} cur={cur} accent="#6E6E64" />}
            <Row label="Total Etsy fees" value={-r.totalFees} cur={cur} strong accent={C.danger} />
            {r.itemCostTotal > 0 && <Row label="Your item cost" value={-r.itemCostTotal} cur={cur} accent="#6E6E64" />}

            <div style={{ marginTop: 14, background: r.net >= 0 ? C.successBg : C.dangerBg, borderRadius: 8, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, fontFamily: MONO, color: netAccent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>You keep</p>
                <p style={{ fontSize: 30, fontWeight: 500, color: netAccent, letterSpacing: '-1px', lineHeight: 1.05 }}>{r.net < 0 ? '-' : ''}{cur}{Math.abs(r.net).toFixed(2)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, fontFamily: MONO, color: netAccent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Margin</p>
                <p style={{ fontSize: 24, fontWeight: 500, color: netAccent, letterSpacing: '-0.5px' }}>{r.margin.toFixed(1)}%</p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#808080', marginTop: 12, lineHeight: 1.5 }}>
              Break-even item price: <strong style={{ color: C.ink, fontFamily: MONO }}>{cur}{r.breakEven.toFixed(2)}</strong>. Fees are estimates — confirm current rates with Etsy.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
