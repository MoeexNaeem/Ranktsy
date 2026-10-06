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
  type LocalMethod, type LocalPlan, type LocalAccount,
} from '@/lib/local-payments'
import { PLAN_LABELS, type PlanSlug } from '@/lib/plans'
import { PLANS } from '@/components/landing/plans-data'

// What each plan includes: the same lists as the pricing cards, so they never drift.
const PLAN_INFO = new Map(PLANS.map(p => [p.slug, p]))
const LOGO: Record<LocalMethod, { src: string; alt: string }> = {
  bank: { src: '/payments/allied-bank.png', alt: 'Allied Bank' },
  jazzcash: { src: '/payments/jazzcash.png', alt: 'JazzCash' },
}

function Tick({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

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
                <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img src={LOGO[m].src} alt={LOGO[m].alt} width={52} height={40} style={{ width: 52, height: 40, objectFit: 'contain', flexShrink: 0 }} />
                  <span>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{m === 'bank' ? 'Bank transfer' : 'JazzCash'}</span>
                    <span style={{ display: 'block', fontSize: 13, color: C.graphite }}>{m === 'bank' ? 'Allied Bank, any bank app or branch' : 'Send from your JazzCash wallet'}</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Step 2: plan */}
      {method && (
        <section ref={planRef} style={card}>
          <StepTitle n={2} done={!!plan}>Choose your plan</StepTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {LOCAL_PLANS.map(p => {
              const active = plan?.slug === p.slug
              const info = PLAN_INFO.get(p.slug)
              const accent = info?.accent ?? C.orange
              return (
                <button key={p.slug} onClick={() => pickPlan(p)}
                  style={{ textAlign: 'left', padding: '16px 16px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column',
                    border: `2px solid ${active ? accent : C.ash}`, background: active ? `${accent}14` : C.paper, position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent }} />
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.07em', color: accent, marginBottom: 8 }}>
                    {p.label}{info?.popular ? ' · Popular' : ''}
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 700, color: C.ink, letterSpacing: '-0.02em' }}>{formatPkr(p.pkr)}</span>
                  <span style={{ fontSize: 12.5, color: C.stone, marginTop: 2, marginBottom: 10 }}>{p.period} · {p.usd}</span>
                  {info && (
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: `1px solid ${C.hair}`, paddingTop: 10 }}>
                      {info.features.slice(0, 3).map(f => (
                        <span key={f} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.35 }}><Tick color={accent} />{f}</span>
                      ))}
                      {info.features.length > 3 && <span style={{ fontSize: 12, color: C.stone, paddingLeft: 22 }}>+{info.features.length - 3} more</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Everything the chosen plan includes. */}
          {plan && PLAN_INFO.get(plan.slug) && (() => {
            const info = PLAN_INFO.get(plan.slug)!
            return (
              <div style={{ marginTop: 16, border: `1px solid ${info.accent}55`, background: `${info.accent}0D`, borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 4 }}>What you get with {plan.label}</p>
                {info.blurb && <p style={{ fontSize: 13.5, color: C.graphite, marginBottom: 12 }}>{info.blurb}</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '8px 18px' }}>
                  {[...info.features, ...(info.expandable ?? [])].map(f => (
                    <span key={f} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: C.ink, lineHeight: 1.4 }}><Tick color={info.accent} />{f}</span>
                  ))}
                </div>
              </div>
            )
          })()}
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

              {/* How to pay: sits under the order, next to the payment details it refers to. */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.hair}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.stone, marginBottom: 12 }}>How to pay</p>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    account.qr
                      ? <>Open the <strong style={{ color: C.ink }}>JazzCash app</strong> and scan the QR code, or dial <strong style={{ color: C.ink }}>*786*10#</strong> and enter the Till ID.</>
                      : <>Open your banking app and send to the {account.label} details shown here.</>,
                    <>Pay exactly <strong style={{ color: C.orange }}>{formatPkr(plan.pkr)}</strong>{account.qr ? <> to <strong style={{ color: C.ink }}>{account.rows[0]?.value}</strong></> : null}.</>,
                    <>Take a screenshot of the successful payment (it shows the amount and transaction ID).</>,
                    <>Attach it below and press <strong style={{ color: C.ink }}>Submit payment</strong>. We verify it and turn your plan on.</>,
                  ].map((text, i) => (
                    <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 13.5, color: C.graphite, lineHeight: 1.55 }}>
                      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: C.paper, border: `1px solid ${C.ash}`, color: C.ink, fontSize: 11.5, fontWeight: 700, display: 'grid', placeItems: 'center', marginTop: 1 }}>{i + 1}</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Where to send it */}
            <div style={{ background: C.canvas, borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.stone }}>Send to ({account.label})</p>
                <img src={LOGO[method].src} alt={LOGO[method].alt} width={36} height={28} style={{ width: 36, height: 28, objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {account.qr && <PaymentQr qr={account.qr} />}
                <div style={{ minWidth: 0 }}>
                  {account.rows.map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: r.big ? '10px 0' : '6px 0', borderBottom: `1px solid ${C.hair}` }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: C.graphite }}>{r.label}</p>
                        <p style={{ fontSize: r.big ? 24 : 14.5, color: C.ink, fontWeight: r.big ? 700 : 600, fontFamily: MONO, letterSpacing: r.big ? '0.12em' : undefined, wordBreak: 'break-all', lineHeight: 1.25 }}>{r.value}</p>
                      </div>
                      {r.copy && (
                        <button onClick={() => copyWithToast(r.value, r.label)}
                          style={{ flexShrink: 0, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: C.ink }}>Copy</button>
                      )}
                    </div>
                  ))}

                </div>
              </div>
            </div>
          </div>


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

/**
 * The payment QR, shown large and crisp in a white frame (scanners need the white
 * margin). "Save QR" downloads the full poster so someone paying on this same
 * phone can scan it from their gallery inside the JazzCash app.
 */
function PaymentQr({ qr }: { qr: NonNullable<LocalAccount['qr']> }) {
  return (
    <figure style={{ margin: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 12, border: `1px solid ${C.hair}`, boxShadow: '0 10px 28px rgba(61,62,59,0.12)' }}>
        <img src={qr.src} alt={qr.alt} width={232} height={232}
          style={{ display: 'block', width: 'min(232px, 62vw)', height: 'auto', aspectRatio: '1 / 1', imageRendering: 'pixelated' }} />
      </div>
      <figcaption style={{ fontSize: 12.5, color: C.graphite, textAlign: 'center', maxWidth: 280, lineHeight: 1.45 }}>{qr.caption}</figcaption>
      <a href={qr.download} download="Rankkw-JazzCash-QR.jpg"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: C.ink, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '6px 13px', textDecoration: 'none' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
        Save QR
      </a>
    </figure>
  )
}
