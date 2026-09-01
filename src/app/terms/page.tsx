import type { Metadata } from 'next'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'
import { abs } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: 'Terms of Service - Rankkw',
  description: 'The terms that govern your use of RankKW, the independent Etsy keyword research and analytics platform owned by Zafar Ali and operated by Letrank Marketing.',
  alternates: { canonical: abs('/terms') },
  openGraph: { title: 'Terms of Service - Rankkw', description: 'The terms that govern your use of RankKW.', url: abs('/terms'), type: 'website' },
}

const sections = [
  {
    number: '01',
    title: 'Introduction',
    content:
      'RankKW (the “Service”) is a digital software platform and website owned by Zafar Ali and operated by Letrank Marketing Software House (“Letrank Marketing”, “RankKW”, “we”, “us”, or “our”). The Service includes the RankKW website, dashboard, software tools, browser extension, analytics, integrations, subscription features, and related support services.',
    bullets: [
      { label: '', text: 'RankKW provides Etsy-focused keyword research, listing and competitor analysis, shop analytics, trend and market research, listing optimization tools, AI-assisted title/tag/description features, calculators, exports, and other digital tools made available from time to time.' },
      { label: '', text: 'By accessing rankkw.com, creating an account, connecting a shop, using a free plan, purchasing a subscription, or otherwise using the Service, you agree to these Terms and Conditions and to any policies referenced on our website, including our Privacy Policy and Refund & Return Policy.' },
      { label: '', text: 'If you need technical, billing, or account support, contact us using the support details shown on this page or through the contact page on rankkw.com.' },
    ],
  },
  {
    number: '02',
    title: 'Applicability and Updates',
    content:
      'These Terms and Conditions apply to all visitors, registered users, free-plan users, paid subscribers, agency users, and any person or entity that accesses or uses the Service.',
    bullets: [
      { label: '', text: 'You represent that you are at least 18 years old, have legal capacity to enter into a binding agreement, and are not prohibited from receiving or using the Service under the laws of Pakistan or any other applicable jurisdiction.' },
      { label: '', text: 'We may update these Terms from time to time to reflect changes to our Service, subscriptions, payment arrangements, third-party APIs, security requirements, or applicable law. The latest version posted on RankKW will govern your continued use of the Service after the effective date of the update.' },
    ],
  },
  {
    number: '03',
    title: 'Terms of Usage',
    content: 'You may use RankKW only for lawful business, research, analytics, and listing-optimization purposes. You must not:',
    bullets: [
      { label: '', text: 'use the Service for any unlawful, fraudulent, deceptive, abusive, obscene, or harmful purpose;' },
      { label: '', text: 'use the Service in a way that violates Etsy’s Terms of Use, Community Policies, API terms, or the rights of any marketplace participant;' },
      { label: '', text: 'attempt to scrape, crawl, spider, reverse-engineer, decompile, copy, reproduce, bypass, or extract the Service, its code, protected data, rate limits, or security controls except where expressly permitted by applicable law;' },
      { label: '', text: 'use bots, scripts, automated systems, or excessive requests that overload, disrupt, circumvent, or interfere with the Service or its infrastructure;' },
      { label: '', text: 'resell, sublicense, share, redistribute, or commercially exploit your RankKW account, subscription access, proprietary reports, or restricted data without our written permission;' },
      { label: '', text: 'share account credentials with unauthorized persons, impersonate another person or entity, or submit false or misleading account or payment information;' },
      { label: '', text: 'upload or transmit malware, malicious code, spam, phishing content, or material that infringes intellectual property, privacy, or other rights;' },
      { label: '', text: 'collect or track personal information of other users except where lawfully permitted and necessary for a legitimate purpose.' },
      { label: 'Fair-use limits', text: 'We may apply fair-use limits, credits, search caps, image-generation limits, shop limits, API limits, or other plan restrictions shown on the RankKW pricing or dashboard pages. Attempts to bypass or manipulate these limits may result in restriction or termination.' },
      { label: 'Account security', text: 'You are responsible for maintaining the confidentiality of your login credentials and for all activity performed through your account. You must promptly notify us if you believe your account has been compromised.' },
    ],
  },
  {
    number: '04',
    title: 'Intellectual Property and Third-Party Data',
    content:
      'The RankKW website, software, interface, original content, product design, source code, databases created by us, branding, reports, documentation, images, and related materials are owned by or licensed to Letrank Marketing / RankKW and are protected by applicable intellectual property laws. All rights not expressly granted are reserved.',
    disclaimer: true,
    bullets: [
      { label: 'Your content', text: 'You retain ownership of content or data that you lawfully upload or connect to the Service. You grant us a limited, non-exclusive right to process that content only as reasonably necessary to provide, secure, support, and improve the Service.' },
      { label: 'Third-party data', text: 'Marketplace information, trademarks, and third-party data remain the property of their respective owners. RankKW uses third-party services and APIs, including Etsy-related data sources, to provide analytics and research features.' },
      { label: 'Etsy trademarks', text: '“Etsy” and related marks are trademarks of Etsy, Inc. RankKW is an independent application and is not endorsed, sponsored, or certified by Etsy, Inc. Users who connect or analyze Etsy data remain responsible for complying with Etsy’s own policies and applicable API terms.' },
    ],
  },
  {
    number: '05',
    title: 'Subscriptions, Payments, Refunds, Indemnity and Limitation of Liability',
    content:
      'RankKW may offer free and paid subscription plans with different usage limits, features, credits, images, shop connections, research limits, support levels, and billing periods. Current plan features and prices are those displayed on the RankKW pricing page at the time of purchase, unless a written promotional offer states otherwise.',
    bullets: [
      { label: 'Digital service', text: 'RankKW is a digital subscription service. No physical goods are shipped. Payments may be processed through third-party payment providers made available at checkout. We do not require or intend to store your full card details on our own servers when a payment processor handles the transaction.' },
      { label: 'Cancellation', text: 'You may cancel a recurring paid subscription in accordance with the cancellation options made available through your account or support. Unless otherwise stated, cancellation stops future renewal and access continues until the end of the paid billing period. Refund requests are governed by the Refund & Return Policy published on rankkw.com.' },
      { label: 'Declined transactions', text: 'We may decline, cancel, suspend, or reverse a subscription or transaction where payment fails, fraud or abuse is suspected, a price or technical error occurs, the requested Service is unavailable, a legal or regulatory restriction applies, or circumstances outside our reasonable control prevent delivery of the Service.' },
      { label: 'Indemnity', text: 'You agree to indemnify, defend, and hold harmless Letrank Marketing, RankKW, and their owners, officers, employees, contractors, service providers, affiliates, and licensors from claims, losses, liabilities, and reasonable costs arising from your breach of these Terms, unlawful use of the Service, infringement of third-party rights, or misuse of data or integrations.' },
      { label: 'No guarantees', text: 'RankKW provides research, analytics, estimates, recommendations, and software tools for informational and business-support purposes. We do not guarantee sales, rankings, revenue, search position, marketplace approval, account standing, or any specific business outcome.' },
      { label: 'As-is data', text: 'Data availability and accuracy may be affected by third-party APIs, marketplace changes, Google or Etsy data availability, algorithm changes, outages, rate limits, user-provided information, or other factors outside our control. The Service is provided on an “as available” and “as is” basis to the maximum extent permitted by law.' },
      { label: 'Limitation of liability', text: 'To the maximum extent permitted by applicable law, neither Letrank Marketing nor RankKW will be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, including loss of profits, data, goodwill, business opportunity, rankings, or marketplace access. Our aggregate liability for a claim relating to a paid subscription will not exceed the amount actually paid by the user to RankKW during the 12 months preceding the event giving rise to the claim, except where the law does not permit such limitation.' },
    ],
  },
  {
    number: '06',
    title: 'Suspension and Termination',
    content:
      'We may immediately restrict, suspend, or terminate access to the Service, an account, connected shop, feature, API access, or subscription where we reasonably believe there has been a breach of these Terms, fraudulent activity, payment abuse, unauthorized automation, security risk, unlawful conduct, interference with other users, a request by a competent authority, or misuse of our intellectual property or third-party data.',
    bullets: [
      { label: '', text: 'We may also modify or discontinue any part of the Service where required by changes in law, third-party APIs, marketplace access, infrastructure, security, or business operations. Where practical, we will provide reasonable notice of material changes affecting paid users.' },
      { label: '', text: 'Upon termination, your right to use restricted parts of the Service ends immediately. Clauses relating to intellectual property, payment obligations, disclaimers, limitation of liability, indemnity, governing law, and any provisions intended by their nature to survive termination will remain in effect.' },
    ],
  },
  {
    number: '07',
    title: 'Severability and Waiver',
    content:
      'If any provision of these Terms is found unlawful, invalid, or unenforceable, that provision will be interpreted or modified to the minimum extent necessary to make it enforceable. If it cannot be made enforceable, it will be severed and the remaining provisions will continue in full force and effect. A failure by us to enforce any provision does not constitute a waiver. Any waiver must be in writing and authorized by us.',
    bullets: [],
  },
  {
    number: '08',
    title: 'Governing Law and Jurisdiction',
    content:
      'These Terms and Conditions are governed by the laws of the Islamic Republic of Pakistan. Subject to any mandatory consumer protection rights or dispute-resolution requirements that apply, the courts of competent jurisdiction in Pakistan, including any competent consumer court where applicable, will have jurisdiction over disputes arising from or relating to these Terms or the Service.',
    bullets: [],
  },
  {
    number: '09',
    title: 'Contact and Business Identification',
    content:
      'RankKW is owned by Zafar Ali and operated by Letrank Marketing Software House, Pakistan. For merchant or regulatory use, business registration details should match Letrank Marketing’s official records.',
    contact: true,
    bullets: [],
  },
]

const contactRows: { label: string; value: string; href?: string }[] = [
  { label: 'OWNER', value: 'Zafar Ali' },
  { label: 'OPERATOR', value: 'Letrank Marketing Software House, Pakistan' },
  { label: 'PHONE / WHATSAPP', value: '+92 329 7890000', href: 'tel:+923297890000' },
  { label: 'LOCATION', value: 'Leaving Dol Beauty Salone, College Road, Bahawalpur, Punjab, Pakistan' },
  { label: 'CONTACT', value: 'rankkw.com/contact', href: 'https://rankkw.com/contact' },
]

export default function TermsPage() {
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
              Terms and Conditions
            </h1>
            <p
              style={{
                fontSize: 13,
                fontFamily: "'General Sans', monospace",
                color: '#808080',
                letterSpacing: '0.02em',
              }}
            >
              Effective Date: September 1, 2026 · Owned by Zafar Ali · Operated by Letrank Marketing Software House
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
                className="toc-link"
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
              These Terms and Conditions govern your access to and use of RankKW, a digital software platform owned by Zafar Ali and operated by Letrank Marketing Software House, Pakistan. Please read them carefully before using the Service. By using RankKW, you confirm that you are at least 18 years old and agree to be bound by these Terms and the policies referenced on rankkw.com.
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
                      Important Disclaimer: The term &apos;Etsy&apos; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc. Use of Etsy&apos;s API is subject to Etsy&apos;s own Terms of Use, and users of RankKW who connect their Etsy shops remain bound by Etsy&apos;s policies.
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
                    {contactRows.map((row) => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 14, fontFamily: "'General Sans', monospace", lineHeight: 1.6 }}>
                        <span style={{ opacity: 0.55, fontSize: 11, color: '#fff', flexShrink: 0, minWidth: 132 }}>{row.label}</span>
                        {row.href ? (
                          <a href={row.href} style={{ color: C.orange, textDecoration: 'none' }}>{row.value}</a>
                        ) : (
                          <span style={{ color: '#EDEBE4' }}>{row.value}</span>
                        )}
                      </div>
                    ))}
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
