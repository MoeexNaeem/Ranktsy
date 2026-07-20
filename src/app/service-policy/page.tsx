'use client'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'

const sections = [
  {
    number: '01',
    title: 'Overview',
    content:
      'This Service Policy describes how Rankkw ("the Service," "we," "us") delivers its keyword research and analytics platform to Etsy sellers, including the scope of what we provide, how the Service is supported, and what you can expect in terms of availability. This policy works alongside our Terms of Service and Privacy Policy.',
    bullets: [],
  },
  {
    number: '02',
    title: 'Description of the Service',
    content: 'Rankkw provides software-as-a-service tools delivered entirely online. There is no physical product, shipment, or delivery involved. Our core offerings include:',
    bullets: [
      { label: 'Keyword Research', text: 'Live analysis of Etsy listing competition, engagement, and pricing, supplemented with Google search-volume data where available.' },
      { label: 'Trend Analytics', text: 'Seasonality and listing-creation trends sourced from Google Ads data and the Etsy Open API.' },
      { label: 'Tag Optimizer', text: 'Data-backed tag recommendations within Etsy\'s 13-tag allowance.' },
      { label: 'Shop Analytics', text: 'Optional shop-level tracking of views, favorites, and revenue trends via Etsy OAuth integration.' },
    ],
  },
  {
    number: '03',
    title: 'Account Activation',
    content: 'Access to paid features is activated once your payment has been successfully processed by our payment partner. Activation is typically immediate; in rare cases involving manual verification it may take up to 24 hours.',
    bullets: [],
  },
  {
    number: '04',
    title: 'Service Availability',
    content: 'We aim to keep Rankkw available and performant at all times, but the Service is provided on an "as available" basis. We do not guarantee uninterrupted access, and availability may be affected by:',
    bullets: [
      { label: '', text: 'Scheduled maintenance, which we will attempt to perform during low-traffic hours and announce in advance where practical.' },
      { label: '', text: 'Outages or rate limits imposed by third-party providers we depend on, including the Etsy Open API and Google Ads data.' },
      { label: '', text: 'Circumstances beyond our reasonable control, including hosting-provider incidents, internet infrastructure failures, or force majeure events.' },
    ],
    footer: 'We do not offer a formal Service Level Agreement (SLA) or uptime guarantee at this time.',
  },
  {
    number: '05',
    title: 'Support',
    content: 'Customer support is available by email. We aim to respond to all inquiries within 2 business days, and sooner for account or billing issues.',
    bullets: [],
  },
  {
    number: '06',
    title: 'Fair Use',
    content: 'To keep the Service reliable for everyone, accounts are expected to use Rankkw for legitimate keyword research and shop analytics. We reserve the right to throttle, suspend, or terminate access for accounts that place excessive automated load on our infrastructure or otherwise breach the Acceptable Use section of our Terms of Service.',
    bullets: [],
  },
  {
    number: '07',
    title: 'Changes to the Service',
    content: 'We continuously improve Rankkw and may add, modify, or discontinue individual features at our discretion. Where a change materially reduces functionality available to paying subscribers, we will provide reasonable notice by email.',
    bullets: [],
  },
  {
    number: '08',
    title: 'Third-Party Dependency Disclaimer',
    content:
      'Certain features rely on data made available by Etsy, Inc. and Google through their respective official APIs. We are not responsible for inaccuracies, delays, or interruptions in the Service that result from changes to those third-party platforms or APIs.',
    disclaimer: true,
    bullets: [],
  },
  {
    number: '09',
    title: 'Contact Information',
    content: 'If you have questions about this Service Policy, please contact us at:',
    contact: true,
    bullets: [],
  },
]

export default function ServicePolicyPage() {
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
              Service Policy
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
              This Service Policy explains what Rankkw provides, how the Service is supported, and what you can expect from us as a subscriber. It should be read together with our Terms of Service and Privacy Policy.
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

                {'disclaimer' in s && s.disclaimer && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: '20px 24px',
                      background: '#FFF4EE',
                      border: '1px solid rgba(255,122,46,0.10)',
                      borderRadius: 8,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        color: '#3D3E3B',
                        lineHeight: 1.7,
                        margin: 0,
                        fontFamily: "'General Sans', monospace",
                      }}
                    >
                      Important Disclaimer: The term &apos;Etsy&apos; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
                    </p>
                  </div>
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
