import type { Metadata } from 'next'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'
import { abs } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: 'Terms & Conditions - Rankkw',
  description: 'The Terms and Conditions that apply to your use of the Rankkw website and services.',
  alternates: { canonical: abs('/terms-and-conditions') },
  openGraph: { title: 'Terms & Conditions - Rankkw', description: 'The Terms and Conditions that apply to your use of Rankkw.', url: abs('/terms-and-conditions'), type: 'website' },
}

type Bullet = { label?: string; text: string }
type Section = {
  number: string
  title: string
  paras?: string[]
  bullets?: Bullet[]
  footer?: string
  contact?: boolean
}

const sections: Section[] = [
  {
    number: '01',
    title: 'Introduction',
    paras: [
      'This website is owned and operated by Rankkw (hereinafter and throughout this website referred to as “we”, “us” and “our”). Our registered office is at Leaving Dol Beauty Salone, College Road, Bahawalpur, Punjab, Pakistan. Our principal place of business is located at Leaving Dol Beauty Salone, College Road, Bahawalpur, Punjab, Pakistan.',
      'We offer this website, including all information, tools, products and services available from this website to you, the user, conditioned upon your acceptance of all terms, conditions, policies and notices stated here.',
      'If you have any problems using our website, or require support after placing an order through our website, please contact us by phone at +92 329 7890000 or by email at support@rankkw.com.',
    ],
  },
  {
    number: '02',
    title: 'Applicability and Updates',
    paras: [
      'By visiting our site and/or purchasing something from us, you engage in our “Service” and agree to be bound by the following terms and conditions (“Terms and Conditions”), including those additional terms and conditions and policies referenced herein and/or available by hyperlink. These Terms and Conditions apply to all users of the site, including without limitation users who are browsers, vendors, customers, merchants, and/or contributors of content.',
      'In consideration of your use of our website and services, you represent that you are of legal age to form a binding contract and are not a person barred from receiving products and services under the laws of Pakistan or other applicable jurisdiction.',
      'We may need to update our Terms and Conditions from time to time. Each time you place an order on our website you will be agreeing to the latest version of our Terms and Conditions.',
    ],
  },
  {
    number: '03',
    title: 'Terms of Usage',
    paras: ['You are prohibited from using this website or its content:'],
    bullets: [
      { text: 'for any unlawful purpose;' },
      { text: 'to solicit others to perform or participate in any unlawful acts;' },
      { text: 'to violate any international, federal, provincial or state laws, regulations and rules;' },
      { text: 'to infringe upon or violate our intellectual property rights or the intellectual property rights of others;' },
      { text: 'to harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate based on gender, sexual orientation, religion, ethnicity, race, age, national origin, or disability;' },
      { text: 'to submit false or misleading information;' },
      { text: 'to upload or transmit viruses or any other type of malicious code that will or may be used in any way that will affect the functionality or operation of the service or interfere with or circumvent the security features of our service, any related website, other websites, or the internet;' },
      { text: 'to collect or track the personal information of others, or to spam, phish, pharm, pretext, spider, crawl, or scrape; or' },
      { text: 'for any obscene or immoral purpose.' },
    ],
    footer: 'We reserve the right to terminate your use of the Service or any related website for violating any of the prohibited uses.',
  },
  {
    number: '04',
    title: 'Intellectual Property',
    paras: [
      'This website and its related software and content (including images and designs) are the intellectual property of and are exclusively owned by us. The structure, organization, and code of the website and its related software contain valuable trade secrets and confidential information of Rankkw. Except as expressly stated herein, these terms and conditions do not grant you any intellectual property rights whatsoever in the website and its related software, and all rights are reserved by Rankkw.',
    ],
  },
  {
    number: '05',
    title: 'Indemnity and Limitation of Liability',
    paras: [
      'You agree to indemnify us, defend and hold us harmless, and our parent, subsidiaries, affiliates, partners, officers, directors, agents, contractors, licensors, service providers, subcontractors, suppliers, interns and employees, harmless from any claim or demand, including reasonable attorneys’ fees, made by any third-party due to or arising out of your breach of these Terms and Conditions or the documents they incorporate by reference, or your violation of any law or the rights of a third-party.',
      'Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness, performance, completeness or suitability of the information and materials found or offered on this website for any particular purpose. You acknowledge that such information and materials may contain inaccuracies or errors and we expressly exclude liability for any such inaccuracies or errors to the fullest extent permitted by law.',
      'Your use of any information or materials on this website is entirely at your own risk, for which we shall not be liable. It shall be your own responsibility to ensure that any products, services or information available through this website meet your specific requirements.',
      'To the extent permitted by law, we also disclaim all warranties, whether express or implied, including the implied warranties of merchantability, fitness for a particular purpose, title and non-infringement.',
      'We reserve the right to not process an order that you place on our website. This is usually for the following reasons:',
    ],
    bullets: [
      { text: 'We no longer hold stock of the goods or services that you ordered from us.' },
      { text: 'We are unable to ship goods to your location.' },
      { text: 'The goods or services that you have ordered are no longer available.' },
      { text: 'Any reason outside of our control.' },
    ],
  },
  {
    number: '06',
    title: 'Termination',
    paras: [
      'We may immediately change or terminate your access to our products, services and this website, or any online membership(s) with us, with or without notice, at any time, without liability to you, any other user or any third party. We reserve the right to terminate your access if, without limitation, you have: (1) provided us with false or misleading registration information; (2) interfered with other users or the administration of our services or websites; (3) upon a request by law enforcement or other governmental authorities; or (4) otherwise violated these Terms and Conditions.',
    ],
  },
  {
    number: '07',
    title: 'Severability and Waiver',
    paras: [
      'If any portion of these terms is found to be unenforceable, the unenforceable portion will be deemed amended to the minimum extent necessary to make it enforceable, and if it cannot be made enforceable, then it will be severed and the remaining portion will remain in full force and effect. If we fail to enforce any of these terms, it will not be considered a waiver. Any amendment to or waiver of these terms must be made in writing and signed by us.',
    ],
  },
  {
    number: '08',
    title: 'Governing Law',
    paras: [
      'Our Terms and Conditions are governed by the laws of the Islamic Republic of Pakistan and you agree that the courts of Bahawalpur (including any consumer court) will have exclusive jurisdiction in any dispute that you have with us.',
    ],
  },
  {
    number: '09',
    title: 'Contact Us',
    paras: ['If you have any questions about these Terms and Conditions, please contact us at:'],
    contact: true,
  },
]

export default function TermsAndConditionsPage() {
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
              Terms &amp; Conditions
            </h1>
            <p
              style={{
                fontSize: 13,
                fontFamily: "'General Sans', monospace",
                color: '#808080',
                letterSpacing: '0.02em',
              }}
            >
              Last Updated: September 1, 2026
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
                href={'#section-' + s.number}
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
              These Terms and Conditions govern your access to and use of the Rankkw website and services. Please read them carefully. By visiting our site or purchasing something from us, you agree to be bound by these Terms and Conditions.
            </p>

            {sections.map((s, i) => (
              <div
                key={s.number}
                id={'section-' + s.number}
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

                {s.paras?.map((p, pi) => (
                  <p
                    key={pi}
                    style={{
                      fontSize: 15,
                      color: '#444',
                      lineHeight: 1.75,
                      marginBottom: pi < (s.paras!.length - 1) || s.bullets?.length ? 16 : 0,
                    }}
                  >
                    {p}
                  </p>
                ))}

                {s.bullets && s.bullets.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0' }}>
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

                {s.footer && (
                  <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginTop: 16, fontStyle: 'italic' }}>
                    {s.footer}
                  </p>
                )}

                {s.contact && (
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
