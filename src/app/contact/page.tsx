'use client'
import { useState } from 'react'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'
import { Icon } from '@/components/ui/Icon'
import { SocialRow } from '@/components/ui/Social'

/**
 * One inbox, one phone, one address — all real and monitored.
 *
 * There used to be hello@ / support@ / billing@. Only support@ exists, so the
 * other two silently bounced: worse than listing nothing, and a live contact
 * route is something Etsy's API review actually looks for.
 *
 * `href` is optional — the postal address isn't a link, and inventing a maps URL
 * for it would just be a guess.
 */
const CONTACT_CHANNELS: {
  icon: 'mail' | 'phone' | 'pin'
  label: string
  value: string
  href?: string
  desc: string
}[] = [
  {
    icon: 'mail',
    label: 'Email',
    value: 'support@rankkw.com',
    href: 'mailto:support@rankkw.com',
    desc: 'Support, billing, partnerships and press — everything reaches the same inbox. We reply within 24 hours on business days.',
  },
  {
    icon: 'phone',
    label: 'Phone',
    value: '0329 7890000',
    // tel: needs the international form or it won't dial from outside Pakistan.
    href: 'tel:+923297890000',
    desc: 'Pakistan Standard Time, business hours. Dial +92 329 7890000 from abroad.',
  },
  {
    icon: 'pin',
    label: 'Office',
    value: 'Bahawalpur, Pakistan',
    desc: 'Riaz Colony, Street No. 1, Bahawalpur, Punjab, Pakistan.',
  },
]

const FAQS = [
  {
    q: 'How quickly do you respond?',
    a: 'We aim to respond to all inquiries within 24 hours on business days. Technical support tickets usually get a first response within a few hours.',
  },
  {
    q: 'Is Rankkw officially affiliated with Etsy?',
    a: "No. Rankkw is an independent analytics tool. The term 'Etsy' is a trademark of Etsy, Inc. We are not endorsed, certified, or affiliated with Etsy, Inc. in any way.",
  },
  {
    q: 'Do you offer a free trial?',
    a: "Yes! Our Sprout plan is forever free with 5 keyword searches per day. Paid plans include a 14-day free trial — no credit card required to start.",
  },
  {
    q: 'Can I request a feature?',
    a: "Absolutely. We love hearing from sellers. Use the contact form and select 'Feature Request' as the subject — our product team reads every one.",
  },
]

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  border: `1px solid ${C.hair}`,
  borderRadius: 8,
  fontSize: 14,
  color: '#1a1a1a',
  background: C.canvas,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s',
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.message) return
    setSubmitted(true)
  }

  return (
    <>
      <Navbar />
      <main style={{ background: C.paper, minHeight: '100vh' }}>

        {/* ── Header ── */}
        <div
          style={{
            background: C.canvas,
            padding: '150px 40px 72px',
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
              Contact Us
            </div>
            <h1
              style={{
                fontSize: 'clamp(44px, 6vw, 80px)',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                color: C.ink,
                lineHeight: 0.95,
                marginBottom: 22,
              }}
            >
              We&apos;d love to hear<br />from you.
            </h1>
            <p
              style={{
                fontSize: 18,
                color: '#6E6E64',
                lineHeight: 1.6,
                letterSpacing: '-0.14px',
                maxWidth: 500,
              }}
            >
              Whether you have a question, a feature idea, or just want to say hello — our team is here and happy to help.
            </p>
          </div>
        </div>

        {/* ── Channels ── */}
        <div style={{ background: C.bone, padding: '56px 40px' }}>
          <div
            className="rgrid-3"
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
            }}
          >
            {CONTACT_CHANNELS.map((ch) => {
              // The address card has no href. Rendering it as an <a> anyway would
              // give a link that looks clickable and goes nowhere, so it becomes a
              // plain div and drops the lift-on-hover affordance with it.
              const Tag = (ch.href ? 'a' : 'div') as 'a' | 'div'
              const interactive = Boolean(ch.href)
              return (
              <Tag
                key={ch.label}
                {...(ch.href ? { href: ch.href } : {})}
                style={{
                  background: C.paper,
                  border: `1px solid ${C.hairInk}`,
                  borderRadius: 22,
                  padding: '30px',
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'transform 0.18s',
                }}
                onMouseEnter={(e) => { if (interactive) e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { if (interactive) e.currentTarget.style.transform = 'none' }}
              >
                <Icon name={ch.icon} size={22} color={C.ink} style={{ marginBottom: 16 }} />
                <p
                  style={{
                    fontSize: 11,
                    fontFamily: "'General Sans', monospace",
                    color: '#808080',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    marginBottom: 8,
                  }}
                >
                  {ch.label}
                </p>
                <p
                  style={{
                    fontSize: 17,
                    fontWeight: 500,
                    color: C.ink,
                    marginBottom: 8,
                    letterSpacing: '-0.3px',
                  }}
                >
                  {ch.value}
                </p>
                <p style={{ fontSize: 14, color: '#6E6E64', lineHeight: 1.55 }}>{ch.desc}</p>
              </Tag>
              )
            })}
          </div>

          {/* Social — a fourth way to reach us, but not a support channel, so it
              sits below the cards rather than becoming one of them. */}
          <div
            className="rstack-sm"
            style={{
              maxWidth: 1100,
              margin: '32px auto 0',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontFamily: "'General Sans', monospace",
                color: '#808080',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                margin: 0,
              }}
            >
              Follow Rankkw
            </p>
            <SocialRow color="#6E6E64" hoverColor={C.orange} size={19} gap={16} />
          </div>
        </div>

        {/* ── Form + FAQ ── */}
        <div style={{ padding: '72px 48px' }}>
          <div
            className="rsplit"
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 64,
              alignItems: 'start',
            }}
          >
            {/* Contact Form */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  fontFamily: "'General Sans', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: C.orange,
                  marginBottom: 16,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
                Send a message
              </div>
              <h2
                style={{
                  fontSize: 'clamp(24px, 3vw, 36px)',
                  fontWeight: 400,
                  letterSpacing: '-1.2px',
                  color: C.ink,
                  marginBottom: 40,
                }}
              >
                Drop us a line
              </h2>

              {submitted ? (
                <div
                  style={{
                    background: C.orangeFaint,
                    border: `1px solid rgba(251,94,9,0.15)`,
                    borderRadius: 2,
                    padding: '40px 36px',
                    textAlign: 'center',
                  }}
                >
                  <Icon name='check' size={36} color={C.orange} strokeWidth={2} style={{ marginBottom: 16, margin: '0 auto 16px' }} />
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 500,
                      color: C.orange,
                      marginBottom: 8,
                    }}
                  >
                    Message sent!
                  </h3>
                  <p style={{ fontSize: 14, color: C.charcoalMid, lineHeight: 1.6 }}>
                    Thanks for reaching out, {form.name}. We&apos;ll get back to you at {form.email} within 24 hours.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Name + Email row */}
                  <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontFamily: "'General Sans', monospace",
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: C.charcoalMid,
                          marginBottom: 8,
                        }}
                      >
                        Full Name *
                      </label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        style={inputStyle}
                        onFocus={(e) => (e.currentTarget.style.borderColor = C.charcoal)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(60,60,60,0.15)')}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontFamily: "'General Sans', monospace",
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: C.charcoalMid,
                          marginBottom: 8,
                        }}
                      >
                        Email Address *
                      </label>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        style={inputStyle}
                        onFocus={(e) => (e.currentTarget.style.borderColor = C.charcoal)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(60,60,60,0.15)')}
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontFamily: "'General Sans', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: C.charcoalMid,
                        marginBottom: 8,
                      }}
                    >
                      Subject
                    </label>
                    <select
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = C.charcoal)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(60,60,60,0.15)')}
                    >
                      <option>General</option>
                      <option>Technical Support</option>
                      <option>Billing & Subscriptions</option>
                      <option>Feature Request</option>
                      <option>Partnership</option>
                      <option>Press & Media</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontFamily: "'General Sans', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        color: C.charcoalMid,
                        marginBottom: 8,
                      }}
                    >
                      Message *
                    </label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell us how we can help..."
                      rows={6}
                      style={{
                        ...inputStyle,
                        resize: 'vertical',
                        minHeight: 140,
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = C.charcoal)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(60,60,60,0.15)')}
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    style={{
                      background: C.orange,
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '14px 32px',
                      borderRadius: 28,
                      fontSize: 14.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      width: 'fit-content',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    Send message →
                  </button>
                </div>
              )}
            </div>

            {/* FAQ */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  fontFamily: "'General Sans', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: C.orange,
                  marginBottom: 16,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, display: 'inline-block' }} />
                Common questions
              </div>
              <h2
                style={{
                  fontSize: 'clamp(24px, 3vw, 36px)',
                  fontWeight: 400,
                  letterSpacing: '-1.2px',
                  color: C.ink,
                  marginBottom: 40,
                }}
              >
                FAQs
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {FAQS.map((faq, i) => (
                  <div
                    key={i}
                    style={{
                      background: openFaq === i ? C.charcoal : C.warmGray,
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <div
                      style={{
                        padding: '20px 24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 500,
                          color: openFaq === i ? C.snow : C.charcoal,
                          letterSpacing: '-0.2px',
                          transition: 'color 0.2s',
                        }}
                      >
                        {faq.q}
                      </span>
                      <span
                        style={{
                          fontSize: 18,
                          color: openFaq === i ? C.orange : C.charcoal,
                          flexShrink: 0,
                          transform: openFaq === i ? 'rotate(45deg)' : 'none',
                          transition: 'transform 0.2s, color 0.2s',
                          lineHeight: 1,
                        }}
                      >
                        +
                      </span>
                    </div>
                    {openFaq === i && (
                      <div style={{ padding: '0 24px 20px' }}>
                        <p
                          style={{
                            fontSize: 14,
                            color: 'rgba(252,252,247,0.75)',
                            lineHeight: 1.7,
                            margin: 0,
                          }}
                        >
                          {faq.a}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Response time note */}
              <div
                style={{
                  marginTop: 32,
                  padding: '20px 24px',
                  background: C.orangeFaint,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <Icon name='bolt' size={18} color={C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13, color: C.orange, lineHeight: 1.6, margin: 0 }}>
                  <strong>Typical response time:</strong> We reply to most messages within 24 hours on business days. Premium plan users get priority support.
                </p>
              </div>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </>
  )
}

