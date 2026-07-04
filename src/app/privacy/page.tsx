'use client'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'

const sections = [
  {
    number: '01',
    title: 'Information We Collect',
    content: `We only collect information necessary to provide you with SEO, analytics, and market research tools.`,
    bullets: [
      {
        label: 'Account Data',
        text: 'When you register on Ranktsy, we may collect personal identifiers such as your name, email address, and account credentials.',
      },
      {
        label: 'Payment Information',
        text: 'If you subscribe to our commercial tiers, financial transactions are handled securely through our third-party payment processors. We do not store your full credit card details on our servers.',
      },
      {
        label: 'Integration & Application Data',
        text: 'If you connect an Etsy shop to our platform via standard OAuth authorization, we access only the specific read-only permissions you explicitly grant (such as shop listing details or search visibility metrics). We do not collect or store your private login credentials.',
      },
    ],
  },
  {
    number: '02',
    title: 'How We Use Your Information',
    content: 'We use the collected data strictly to run, maintain, and optimize our software utilities, including:',
    bullets: [
      { label: '', text: 'Providing shop analysis, keyword tracking, and search trends.' },
      { label: '', text: 'Managing your user account and processing premium billing.' },
      { label: '', text: 'Communicating technical updates, service announcements, or customer support responses.' },
      { label: '', text: 'Ensuring platform security and preventing fraudulent or abusive activity.' },
    ],
  },
  {
    number: '03',
    title: 'Data Sharing and Third-Party Services',
    content: 'We do not sell, rent, or trade your personal data to third parties. Data is only shared in the following limited contexts:',
    bullets: [
      {
        label: 'Third-Party APIs',
        text: 'Ranktsy utilizes official application programming interfaces (APIs) from platforms like Etsy to fetch public marketplace metrics and trend analytics.',
      },
      {
        label: 'Service Providers',
        text: 'We may share basic data with trusted hosting partners, database providers, and analytical services required to keep our platform running efficiently.',
      },
      {
        label: 'Legal Compliance',
        text: 'We may disclose information if required to do so by law or in response to valid requests by public authorities.',
      },
    ],
  },
  {
    number: '04',
    title: 'Data Security',
    content: 'We implement robust, industry-standard technical and organizational security measures to protect your information from unauthorized access, alteration, or disclosure. However, please remember that no method of transmission over the internet or electronic storage is 100% secure.',
    bullets: [],
  },
  {
    number: '05',
    title: 'Your Rights and Choices',
    content: 'Depending on your location, you may have specific rights regarding your personal data, including:',
    bullets: [
      { label: '', text: 'The right to access, update, or delete the information we hold on you.' },
      { label: '', text: 'The right to object to or restrict certain processing activities.' },
      { label: '', text: 'The right to withdraw consent at any time for features relying on OAuth or integrations.' },
    ],
    footer: 'To exercise any of these rights, please contact us at our support email address.',
  },
  {
    number: '06',
    title: 'Third-Party Trademarks and Disclaimers',
    content: 'Ranktsy is an independent analytics tool.',
    disclaimer: true,
    bullets: [],
  },
  {
    number: '07',
    title: 'Changes to This Policy',
    content: `We reserve the right to update this Privacy Policy at any time. We will notify users of any significant changes by updating the "Effective Date" at the top of this page or via direct notification within the app dashboard.`,
    bullets: [],
  },
  {
    number: '08',
    title: 'Contact Us',
    content: 'If you have any questions or concerns about this Privacy Policy, please reach out to us at:',
    contact: true,
    bullets: [],
  },
]

export default function PrivacyPage() {
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
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: '#3a4444',
                marginBottom: 22,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
              Legal
            </div>
            <h1
              style={{
                fontSize: 'clamp(36px, 5vw, 56px)',
                fontWeight: 300,
                letterSpacing: '-1.6px',
                color: C.ink,
                lineHeight: 1.04,
                marginBottom: 18,
              }}
            >
              Privacy Policy
            </h1>
            <p
              style={{
                fontSize: 13,
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#808080',
                letterSpacing: '0.02em',
              }}
            >
              Effective Date: June 3, 2026
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 48px', display: 'grid', gridTemplateColumns: '1fr 2.4fr', gap: 64, alignItems: 'start' }}>

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
                fontFamily: "'IBM Plex Mono', monospace",
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
                    fontFamily: "'IBM Plex Mono', monospace",
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
              Welcome to Ranktsy ("we," "our," or "us"). We are committed to protecting your privacy
              and ensuring a transparent relationship with our users. This Privacy Policy explains how
              we collect, use, disclose, and safeguard your information when you visit our website at{' '}
              <a href="https://ranktsy.com" style={{ color: C.orange, textDecoration: 'underline' }}>
                ranktsy.com
              </a>
              .
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
                      fontFamily: "'IBM Plex Mono', monospace",
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

                <p style={{ fontSize: 15, color: '#444', lineHeight: 1.75, marginBottom: s.bullets.length > 0 ? 20 : 0 }}>
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
                          marginBottom: 14,
                          padding: '16px 20px',
                          background: C.bone,
                          borderRadius: 8,
                          borderLeft: `3px solid ${C.orange}`,
                        }}
                      >
                        <span style={{ flexShrink: 0, marginTop: 3, color: C.orange, fontSize: 10 }}>▸</span>
                        <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, margin: 0 }}>
                          {b.label && (
                            <strong style={{ color: C.orange, fontWeight: 600 }}>{b.label}: </strong>
                          )}
                          {b.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {'footer' in s && s.footer && (
                  <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginTop: 16 }}>
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
                    <p style={{ fontSize: 13, color: '#3C3C3C', lineHeight: 1.7, margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>
                      ⚠ Important Disclaimer: The term &apos;Etsy&apos; is a trademark of Etsy, Inc. This
                      application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
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
                      href="mailto:support@ranktsy.com"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        color: C.orange,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      <span style={{ opacity: 0.6, fontSize: 12 }}>EMAIL</span>
                      support@ranktsy.com
                    </a>
                    <a
                      href="https://ranktsy.com"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        color: C.orange,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      <span style={{ opacity: 0.6, fontSize: 12 }}>WEB</span>
                      ranktsy.com
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