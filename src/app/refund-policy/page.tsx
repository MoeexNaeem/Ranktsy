'use client'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'

const sections = [
  {
    number: '01',
    title: 'Overview',
    content:
      'Rankkw is a digital, subscription-based software service. Because there is no physical product involved, there are no shipments, returns, or exchanges in the traditional sense. This policy explains when a refund may be issued for our paid subscription plans and how to request one.',
    bullets: [],
  },
  {
    number: '02',
    title: 'Payment Processing',
    content: 'Subscription payments are processed securely through our licensed payment partner, Premier PayFast, which is regulated by the State Bank of Pakistan. Accepted payment methods include debit/credit cards, RAAST, bank accounts, and mobile wallets, depending on availability at checkout.',
    bullets: [],
  },
  {
    number: '03',
    title: 'Refund Eligibility',
    content: 'Refund requests are evaluated on a case-by-case basis. You may be eligible for a refund in the following circumstances:',
    bullets: [
      { label: 'Duplicate Charge', text: 'You were billed more than once for the same subscription period due to a technical error.' },
      { label: 'Unauthorized Charge', text: 'A charge was made to your account without your authorization, subject to verification.' },
      { label: 'Service Non-Delivery', text: 'You were charged for a paid plan but were unable to access the corresponding features due to a fault on our end that we could not resolve within a reasonable time.' },
      { label: 'First 7 Days', text: 'You cancel a first-time paid subscription within 7 days of the initial charge and have not made substantial use of premium features.' },
    ],
    footer: 'Requests outside these circumstances, including simple change of mind after extended use of the Service, are considered on a discretionary basis.',
  },
  {
    number: '04',
    title: 'Non-Refundable Items',
    content: 'The following are not eligible for refund:',
    bullets: [
      { label: '', text: 'Renewal charges for subscription periods that have already substantially elapsed.' },
      { label: '', text: 'Any one-time setup or onboarding fee, once the corresponding setup work has been completed.' },
      { label: '', text: 'Partial-month usage after a mid-cycle cancellation; access continues until the end of the billed period instead.' },
    ],
  },
  {
    number: '05',
    title: 'How to Request a Refund',
    content: 'To request a refund, email us with your account details and the reason for your request. We aim to review and respond to refund requests within 5 business days.',
    bullets: [
      { label: 'Step 1', text: 'Email support@rankkw.com with the subject line "Refund Request" and the email address associated with your Rankkw account.' },
      { label: 'Step 2', text: 'Include the transaction date and, if available, the payment reference or receipt.' },
      { label: 'Step 3', text: 'We will review the request against the eligibility criteria above and respond with our decision.' },
    ],
  },
  {
    number: '06',
    title: 'Refund Method & Timeline',
    content: 'Approved refunds are issued to the original payment method used at checkout. Processing times depend on your bank or wallet provider and typically take 5 to 10 business days to reflect after approval.',
    bullets: [],
  },
  {
    number: '07',
    title: 'Cancellations',
    content: 'You may cancel your subscription at any time from your account settings, or by emailing us. Cancelling stops future renewals; it does not automatically trigger a refund for the current billing period unless you meet the eligibility criteria above.',
    bullets: [],
  },
  {
    number: '08',
    title: 'Changes to This Policy',
    content: 'We may update this Refund & Return Policy from time to time. Changes will be reflected by updating the "Last Updated" date at the top of this page.',
    bullets: [],
  },
  {
    number: '09',
    title: 'Contact Information',
    content: 'For refund or billing questions, please contact us at:',
    contact: true,
    bullets: [],
  },
]

export default function RefundPolicyPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: C.paper, minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div
          style={{
            background: C.canvas,
            padding: '150px 40px 56px',
            position: 'relative',
            overflow: 'hidden',
            borderBottom: `1px solid ${C.hair}`,
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: "'General Sans', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: '#6E6E64',
                marginBottom: 22,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              Legal
            </div>
            <h1
              style={{
                fontSize: 'clamp(40px, 5.4vw, 64px)',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                color: C.ink,
                lineHeight: 0.98,
                marginBottom: 18,
              }}
            >
              Refund &amp; Return Policy
            </h1>
            <p
              style={{
                fontSize: 13,
                fontFamily: "'General Sans', monospace",
                color: '#808080',
                letterSpacing: '0.02em',
              }}
            >
              Last Updated: July 20, 2026
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div
          className="rsplit rpad-sm"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '64px 48px',
            display: 'grid',
            gridTemplateColumns: '1fr 2.4fr',
            gap: 64,
            alignItems: 'start',
          }}
        >
          {/* Sticky TOC */}
          <nav
            style={{
              position: 'sticky',
              top: 32,
              background: C.bone,
              padding: '28px 24px',
              borderRadius: 8,
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontFamily: "'General Sans', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: C.charcoalMid,
                marginBottom: 16,
              }}
            >
              Contents
            </p>
            {sections.map((s) => (
              <a
                key={s.number}
                href={"#section-" + s.number}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  fontSize: 13,
                  color: '#666',
                  textDecoration: 'none',
                  marginBottom: 12,
                  lineHeight: 1.4,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.charcoal)}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
              >
                <span
                  style={{
                    fontFamily: "'General Sans', monospace",
                    fontSize: 10,
                    color: C.charcoalMid,
                    flexShrink: 0,
                  }}
                >
                  {s.number}
                </span>
                {s.title}
              </a>
            ))}
          </nav>

          {/* Content */}
          <div>
            {/* Intro */}
            <p
              style={{
                fontSize: 16,
                color: '#444',
                lineHeight: 1.75,
                marginBottom: 56,
                borderLeft: `3px solid ${C.orange}`,
                paddingLeft: 20,
              }}
            >
              Rankkw is a digital subscription service, so there is nothing to ship or physically return. This policy explains when a payment made through our payment partner may be refunded, and how to request it.
            </p>

            {sections.map((s, i) => (
              <div
                key={s.number}
                id={"section-" + s.number}
                style={{
                  marginBottom: 56,
                  paddingBottom: 56,
                  borderBottom: i < sections.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  scrollMarginTop: 32,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <span
                    style={{
                      fontFamily: "'General Sans', monospace",
                      fontSize: 11,
                      color: C.ink,
                      background: C.bone,
                      padding: '4px 8px',
                      borderRadius: 4,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {s.number}
                  </span>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 500,
                      color: C.ink,
                      letterSpacing: '-0.4px',
                    }}
                  >
                    {s.title}
                  </h2>
                </div>

                <p
                  style={{
                    fontSize: 15,
                    color: '#444',
                    lineHeight: 1.75,
                    marginBottom: s.bullets.length > 0 ? 20 : 0,
                  }}
                >
                  {s.content}
                </p>

                {s.bullets.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {s.bullets.map((b, bi) => (
                      <li
                        key={bi}
                        style={{
                          display: 'flex',
                          gap: 14,
                          marginBottom: 12,
                          padding: '16px 20px',
                          background: C.bone,
                          borderRadius: 8,
                          borderLeft: `3px solid ${C.orange}`,
                        }}
                      >
                        <span style={{ flexShrink: 0, marginTop: 3, color: C.orange, fontSize: 10 }}>▸</span>
                        <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, margin: 0 }}>
                          {b.label && (
                            <strong style={{ color: C.orange, fontWeight: 500 }}>{b.label}: </strong>
                          )}
                          {b.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {'footer' in s && s.footer && (
                  <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginTop: 16, fontStyle: 'italic' }}>
                    {s.footer}
                  </p>
                )}

                {'contact' in s && s.contact && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: '24px 28px',
                      background: C.charcoal,
                      borderRadius: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <a
                      href="mailto:support@rankkw.com"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        color: C.orange,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontFamily: "'General Sans', monospace",
                      }}
                    >
                      <span style={{ opacity: 0.6, fontSize: 12 }}>EMAIL</span>
                      support@rankkw.com
                    </a>
                    <a
                      href="https://rankkw.com/contact"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        color: C.orange,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontFamily: "'General Sans', monospace",
                      }}
                    >
                      <span style={{ opacity: 0.6, fontSize: 12 }}>WEB</span>
                      rankkw.com/contact
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
