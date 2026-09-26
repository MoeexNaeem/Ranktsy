'use client'
/**
 * Local payment (Pakistan): choose Bank transfer or JazzCash → choose a plan (PKR) →
 * see the account details with your name, email, plan and amount → pay → attach the
 * screenshot → an admin verifies and turns the plan on. Prices and accounts live in
 * lib/local-payments.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { C } from '@/utils'
import { useAuth } from '@/hooks/useAuth'
import { copyWithToast, errorToast } from '@/components/ui/toast'
import {
  LOCAL_PLANS, LOCAL_ACCOUNTS, METHOD_LABELS, PROOF_ACCEPT, formatPkr, localPlanFor, validateProof,
  type LocalMethod, type LocalPlan,
} from '@/lib/local-payments'
import { PLAN_LABELS, type PlanSlug } from '@/lib/plans'

const MONO = "'General Sans',monospace"

interface MyPayment {
  id: string; plan: string; method: LocalMethod; amountPkr: number; status: 'pending' | 'approved' | 'rejected'
  adminNote: string | null; grantedPlan: string | null; grantedUntil: string | null; createdAt: string
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending:  { bg: '#FEF3C7', fg: '#92400E', label: 'Waiting for verification' },
  approved: { bg: '#DCFCE7', fg: '#166534', label: 'Approved' },
  rejected: { bg: '#FEE2E2', fg: '#991B1B', label: 'Rejected' },
}

const card: React.CSSProperties = { background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 18, padding: 24 }
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

function StepTitle({ n, children, done }: { n: number; children: React.ReactNode; done?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700,
        background: done ? '#16A34A' : C.orange, color: '#fff', flexShrink: 0 }}>{done ? '✓' : n}</span>
      <h2 style={{ fontSize: 19, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em' }}>{children}</h2>
    </div>
  )
}

export function LocalPaymentFlow() {
  const { data: user } = useAuth()
  const [method, setMethod] = useState<LocalMethod | null>(null)
  const [plan, setPlan] = useState<LocalPlan | null>(null)
  const [reference, setReference] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState<MyPayment | null>(null)
  const [mine, setMine] = useState<MyPayment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const payRef = useRef<HTMLDivElement>(null)

  const loadMine = useCallback(async () => {
    try {
      const r = await fetch('/api/local-payments')
      const j = await r.json()
      if (j?.success) setMine(j.data)
    } catch { /* ignore */ }
  }, [])

  // Preselect from the link (?plan=pro&method=bank) and load past requests.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const m = q.get('method')
    const p = localPlanFor(q.get('plan') ?? '')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (m === 'bank' || m === 'jazzcash') setMethod(m)
    if (p) setPlan(p)
    void loadMine()
  }, [loadMine])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pickMethod = (m: LocalMethod) => {
    setMethod(m)
    setTimeout(() => (plan ? payRef : planRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const pickPlan = (p: LocalPlan) => {
    setPlan(p)
    setTimeout(() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const check = validateProof(f.type, f.size)
    if (!check.ok) { errorToast('Can’t use that file', check.error); return }
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  const submit = async () => {
    if (!method || !plan || !file || sending) return
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('plan', plan.slug)
      fd.append('method', method)
      fd.append('reference', reference.trim())
      fd.append('file', file)
      const r = await fetch('/api/local-payments', { method: 'POST', body: fd })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.success) { errorToast('Payment not submitted', j?.error || 'Please try again.'); return }
      setSubmitted(j.data)
      setFile(null); setPreview(null); setReference('')
      void loadMine()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      errorToast('Payment not submitted', 'Network error. Please try again.')
    } finally { setSending(false) }
  }

  const account = method ? LOCAL_ACCOUNTS[method] : null

  if (submitted) {
    const p = localPlanFor(submitted.plan)
    return (
      <div style={{ ...card, textAlign: 'center', padding: '40px 28px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'grid', placeItems: 'center', fontSize: 28, margin: '0 auto 16px' }}>✓</div>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Payment submitted</h2>
        <p style={{ fontSize: 15, color: C.graphite, lineHeight: 1.6, maxWidth: 480, margin: '0 auto 22px' }}>
          We received your {METHOD_LABELS[submitted.method]} payment of <strong style={{ color: C.ink }}>{formatPkr(submitted.amountPkr)}</strong> for
          the <strong style={{ color: C.ink }}>{p?.label ?? submitted.plan}</strong> plan. We usually verify within a few hours (at most 24).
          You will get a notification as soon as your plan is active.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ background: C.orange, color: '#fff', padding: '12px 22px', borderRadius: 100, fontWeight: 600, textDecoration: 'none' }}>Go to dashboard</Link>
          <button onClick={() => setSubmitted(null)} style={{ background: C.paper, color: C.ink, border: `1px solid ${C.ash}`, padding: '12px 22px', borderRadius: 100, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Make another payment</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Step 1: method */}
      <section style={card}>
        <StepTitle n={1} done={!!method}>How do you want to pay?</StepTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {(['bank', 'jazzcash'] as LocalMethod[]).map(m => {
            const active = method === m
            return (
              <button key={m} onClick={() => pickMethod(m)}
                style={{ textAlign: 'left', padding: '18px 18px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${active ? C.orange : C.ash}`, background: active ? C.orangeFaint : C.paper }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{m === 'bank' ? '🏦 Bank transfer' : '📱 JazzCash'}</p>
                <p style={{ fontSize: 13, color: C.graphite }}>{m === 'bank' ? 'Allied Bank, any bank app or branch' : 'Send from your JazzCash wallet'}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Step 2: plan */}
      {method && (
        <section ref={planRef} style={card}>
          <StepTitle n={2} done={!!plan}>Choose your plan</StepTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {LOCAL_PLANS.map(p => {
              const active = plan?.slug === p.slug
              return (
                <button key={p.slug} onClick={() => pickPlan(p)}
                  style={{ textAlign: 'left', padding: '16px 16px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                    border: `2px solid ${active ? C.orange : C.ash}`, background: active ? C.orangeFaint : C.paper }}>
                  <p style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.07em', color: active ? C.orange : C.graphite, marginBottom: 8 }}>{p.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>{formatPkr(p.pkr)}</p>
                  <p style={{ fontSize: 12.5, color: C.stone, marginTop: 2 }}>{p.period} · {p.usd}</p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Step 3: pay + proof */}
      {method && plan && account && (
        <section ref={payRef} style={card}>
          <StepTitle n={3}>Send the payment, then attach the screenshot</StepTitle>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 18 }}>
            {/* What you are paying for */}
            <div style={{ background: C.canvas, borderRadius: 14, padding: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.stone, marginBottom: 10 }}>Your order</p>
              {[
                ['Name', user?.name || '-'],
                ['Email', user?.email || '-'],
                ['Plan', `${plan.label} (${plan.period})`],
                ['Method', METHOD_LABELS[method]],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14, borderBottom: `1px solid ${C.hair}` }}>
                  <span style={{ color: C.graphite }}>{k}</span><span style={{ color: C.ink, fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12 }}>
                <span style={{ color: C.graphite, fontSize: 14 }}>Amount to send</span>
                <span style={{ fontSize: 26, fontWeight: 700, color: C.orange, letterSpacing: '-0.02em' }}>{formatPkr(plan.pkr)}</span>
              </div>
            </div>

            {/* Where to send it */}
            <div style={{ background: C.canvas, borderRadius: 14, padding: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.stone, marginBottom: 10 }}>Send to ({account.label})</p>
              {account.rows.map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.hair}` }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: C.graphite }}>{r.label}</p>
                    <p style={{ fontSize: 14.5, color: C.ink, fontWeight: 600, fontFamily: MONO, wordBreak: 'break-all' }}>{r.value}</p>
                  </div>
                  {r.copy && (
                    <button onClick={() => copyWithToast(r.value, r.label)}
                      style={{ flexShrink: 0, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: C.ink }}>Copy</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <ol style={{ fontSize: 14, color: C.graphite, lineHeight: 1.7, paddingLeft: 20, marginBottom: 18 }}>
            <li>Send exactly <strong style={{ color: C.ink }}>{formatPkr(plan.pkr)}</strong> to the {account.label} details above.</li>
            <li>Take a screenshot of the successful payment (it should show the amount and transaction ID).</li>
            <li>Attach it below and press <strong style={{ color: C.ink }}>Submit payment</strong>. We verify it and turn your plan on.</li>
          </ol>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>Transaction ID (optional)</label>
          <input value={reference} onChange={e => setReference(e.target.value)} maxLength={200} placeholder="e.g. the TID / reference number on your receipt"
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.ash}`, borderRadius: 10, background: C.paper, color: C.ink, fontSize: 14, fontFamily: 'inherit', padding: '11px 13px', outline: 'none', marginBottom: 14 }} />

          <input ref={fileRef} type="file" accept={PROOF_ACCEPT} onChange={onFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()}
            style={{ width: '100%', border: `2px dashed ${file ? '#16A34A' : C.ash}`, borderRadius: 14, background: file ? '#F0FDF4' : C.canvas, padding: '22px 16px', cursor: 'pointer', fontFamily: 'inherit', color: C.ink, marginBottom: 16 }}>
            {preview
              ? <img src={preview} alt="Payment screenshot" style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 10, display: 'block', margin: '0 auto 10px' }} />
              : null}
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{file ? `✓ ${file.name} (tap to change)` : '📎 Attach payment screenshot'}</span>
            {!file && <span style={{ display: 'block', fontSize: 12.5, color: C.stone, marginTop: 4 }}>PNG, JPG, WebP or PDF</span>}
          </button>

          <button onClick={submit} disabled={!file || sending}
            style={{ width: '100%', padding: '14px 18px', borderRadius: 100, border: 'none', fontSize: 15.5, fontWeight: 700, fontFamily: 'inherit',
              background: !file || sending ? C.ash : C.orange, color: '#fff', cursor: !file || sending ? 'default' : 'pointer' }}>
            {sending ? 'Submitting…' : `Submit payment of ${formatPkr(plan.pkr)}`}
          </button>
        </section>
      )}

      {/* Past requests */}
      {mine.length > 0 && (
        <section style={card}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 12 }}>Your local payments</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mine.map(m => {
              const st = STATUS_STYLE[m.status] ?? STATUS_STYLE.pending
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 14px', border: `1px solid ${C.hair}`, borderRadius: 12 }}>
                  <div>
                    <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>
                      {localPlanFor(m.plan)?.label ?? PLAN_LABELS[m.plan as PlanSlug] ?? m.plan} · {formatPkr(m.amountPkr)}
                    </p>
                    <p style={{ fontSize: 12.5, color: C.stone }}>
                      {METHOD_LABELS[m.method]} · sent {fmtDate(m.createdAt)}
                      {m.status === 'approved' && m.grantedUntil ? ` · active until ${fmtDate(m.grantedUntil)}` : ''}
                      {m.status === 'rejected' && m.adminNote ? ` · ${m.adminNote}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 100, background: st.bg, color: st.fg }}>{st.label}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
