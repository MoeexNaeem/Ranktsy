'use client'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'

const sections = [
  {
    number: '01',
    title: 'Acceptance of Terms',
    content:
      'By accessing or using Ranktsy ("the Service," "our platform," "we," or "us"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not access or use the Service. These Terms apply to all visitors, users, and others who access or use the Service.',
    bullets: [],
  },
  {
    number: '02',
    title: 'Description of Service',
    content:
      'Ranktsy is an independent keyword research and analytics platform designed to help Etsy sellers analyze search trends, optimize listings, and track shop performance. The Service includes:',
    bullets: [
      { label: 'Keyword Research', text: 'Analysis of search volumes, click-through rates, and competition metrics across marketplace platforms.' },
      { label: 'Trend Analytics', text: 'Relative trend data derived from Etsy listing view signals to identify peak buyer interest periods. Note: Etsy\'s Open API does not expose raw search volume counts.' },
      { label: 'Competition Analysis', text: 'Insights into competing listings, tags, and titles within Etsy\'s marketplace.' },
      { label: 'Tag Optimizer', text: 'Data-backed tag recommendations to maximize listing visibility within Etsy\'s 13-tag allowance.' },
      { label: 'Shop Analytics', text: 'Optional integration to track your connected shop\'s views, favorites, and revenue trends.' },
    ],
  },
  {
    number: '03',
    title: 'User Accounts & Registration',
    content: 'To access most features of the Service, you must create an account. By registering, you agree to:',
    bullets: [
      { label: '', text: 'Provide accurate, current, and complete information during registration.' },
      { label: '', text: 'Maintain the security of your password and promptly notify us of any unauthorized account access.' },
      { label: '', text: 'Accept responsibility for all activities that occur under your account.' },
      { label: '', text: 'Not share your account credentials or allow others to use your account.' },
    ],
    footer: 'We reserve the right to terminate accounts that violate these Terms or that have been inactive for more than 12 months on free plans.',
  },
  {
    number: '04',
    title: 'Service Access & Beta Period',
    content: 'Ranktsy is currently in beta and available free of charge. During this period:',
    bullets: [
      { label: 'Free Access', text: 'All features are available at no cost while we are in beta. No credit card is required.' },
      { label: 'Future Pricing', text: 'We may introduce paid subscription tiers in the future. Existing users will receive at least 30 days\' notice before any billing begins.' },
      { label: 'No Current Charges', text: 'We do not currently collect payment information or charge any fees.' },
    ],
  },
  {
    number: '05',
    title: 'Acceptable Use Policy',
    content: 'You agree to use the Service only for lawful purposes and in accordance with these Terms. You must NOT:',
    bullets: [
      { label: '', text: 'Use the Service to engage in any activity that violates Etsy\'s own Terms of Service or Community Guidelines.' },
      { label: '', text: 'Attempt to scrape, reverse-engineer, or extract data from the Service beyond what is provided through normal use.' },
      { label: '', text: 'Use automated bots or scripts to interact with the Service in a way that places an excessive burden on our infrastructure.' },
      { label: '', text: 'Resell, redistribute, or sublicense access to the Service or any data obtained through it.' },
      { label: '', text: 'Use the Service to transmit any malware, spam, or otherwise harmful content.' },
      { label: '', text: 'Impersonate any person or entity or misrepresent your affiliation with any person or entity.' },
    ],
  },
  {
    number: '06',
    title: 'Intellectual Property',
    content:
      'The Service and its original content, features, and functionality are and will remain the exclusive property of Ranktsy and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without prior written consent.',
    bullets: [
      { label: 'Your Content', text: 'You retain ownership of any data or content you upload to the Service. By using the Service, you grant us a limited license to process that data solely to provide you with the features of the Service.' },
      { label: 'Third-Party Data', text: 'Marketplace data and trend metrics are sourced from publicly available APIs and databases. Such data remains the property of their respective owners.' },
    ],
  },
  {
    number: '07',
    title: 'Third-Party Services & Disclaimer',
    content:
      'Ranktsy uses the official Etsy Open API v3 (https://openapi.etsy.com) to retrieve publicly available marketplace data, such as active listing details, shop information, and product search results. We do not use scraping, unofficial endpoints, or any third-party data proxy services to access Etsy data.',
    disclaimer: true,
    bullets: [
      { label: 'Data Source', text: 'All Etsy data displayed in Ranktsy is retrieved via the official Etsy Open API v3. The API provides listing-level data (titles, tags, views, favorites, prices, images) for active public listings. It does not expose raw search volume, click data, or buyer country breakdowns — any engagement metrics shown are derived from listing view/favorite counts as relative proxies only.' },
      { label: 'Data Scope', text: 'We access only publicly available listing data (titles, tags, views, images, prices). We do not access private seller data without explicit OAuth consent.' },
      { label: 'No Affiliation', text: 'Ranktsy is an independent application. "Etsy" is a trademark of Etsy, Inc. This app uses the Etsy API but is not endorsed or certified by Etsy, Inc.' },
    ],
  },
  {
    number: '08',
    title: 'Limitation of Liability',
    content:
      'To the maximum extent permitted by applicable law, Ranktsy shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, resulting from:',
    bullets: [
      { label: '', text: 'Your use of or inability to use the Service.' },
      { label: '', text: 'Inaccuracies in keyword data, trend metrics, or analytics provided by the Service.' },
      { label: '', text: 'Changes to Etsy\'s platform, algorithm, or API that affect the accuracy of our data.' },
      { label: '', text: 'Unauthorized access to or alteration of your data.' },
    ],
    footer: 'Our total liability to you for any claim arising out of or relating to these Terms or the Service shall not exceed the amount paid by you to Ranktsy in the 12 months preceding the claim.',
  },
  {
    number: '09',
    title: 'Termination',
    content:
      'We may terminate or suspend your account and access to the Service immediately, without prior notice, for conduct that we determine, in our sole discretion, violates these Terms or is harmful to other users, us, third parties, or for any other reason. Upon termination, your right to use the Service will immediately cease.',
    bullets: [],
  },
  {
    number: '10',
    title: 'Changes to Terms',
    content:
      'We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating the "Last Updated" date at the top of this page and, where appropriate, by sending an email to registered users. Your continued use of the Service after any changes constitutes acceptance of the new Terms.',
    bullets: [],
  },
  {
    number: '11',
    title: 'Governing Law',
    content:
      'These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising under these Terms shall be resolved through binding arbitration, except where prohibited by law, and you waive any right to participate in a class-action lawsuit.',
    bullets: [],
  },
  {
    number: '12',
    title: 'Contact Information',
    content: 'If you have any questions about these Terms of Service, please contact us at:',
    contact: true,
    bullets: [],
  },
]

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: C.snow, minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div
          style={{
            background: C.charcoal,
            padding: '100px 48px 72px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,96,8,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,96,8,0.10) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              pointerEvents: 'none',
            }}
          />
          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: C.orange,
                marginBottom: 20,
              }}
            >
              <span style={{ width: 24, height: 1, background: C.orangeFaint, display: 'inline-block' }} />
              Legal
            </div>
            <h1
              style={{
                fontSize: 'clamp(32px, 5vw, 56px)',
                fontWeight: 300,
                letterSpacing: '-1.5px',
                color: '#FFFFFF',
                lineHeight: 1.05,
                marginBottom: 20,
              }}
            >
              Terms of Service
            </h1>
            <p
              style={{
                fontSize: 13,
                fontFamily: "'IBM Plex Mono', monospace",
                color: C.charcoalMid,
                letterSpacing: '0.02em',
              }}
            >
              Last Updated: June 7, 2026
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div
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
              background: C.warmGray,
              padding: '28px 24px',
              borderRadius: 2,
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
              Welcome to Ranktsy. These Terms of Service govern your access to and use of our platform, including all features, tools, and analytics services. Please read these terms carefully before using the Service. By using Ranktsy, you confirm that you are at least 18 years old and have the legal authority to agree to these terms.
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
                      color: C.orange,
                      background: C.charcoal,
                      padding: '4px 8px',
                      borderRadius: 2,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {s.number}
                  </span>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 500,
                      color: C.orange,
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
                          background: C.warmGray,
                          borderRadius: 2,
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
                      borderRadius: 2,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        color: '#3C3C3C',
                        lineHeight: 1.7,
                        margin: 0,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      ⚠ Important Disclaimer: The term &apos;Etsy&apos; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc. Use of Etsy&apos;s API is subject to Etsy&apos;s own Terms of Use, and users of Ranktsy who connect their Etsy shops remain bound by Etsy&apos;s policies.
                    </p>
                  </div>
                )}

                {'contact' in s && s.contact && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: '24px 28px',
                      background: C.charcoal,
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <a
                      href="mailto:legal@ranksty.com"
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
                      legal@ranksty.com
                    </a>
                    <a
                      href="https://ranksty.com/contact"
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
                      ranksty.com/contact
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
