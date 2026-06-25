'use client'
import { useState } from 'react'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'

const CONTACT_CHANNELS = [
  {
    icon: '📧',
    label: 'General Inquiries',
    value: 'hello@ranksty.com',
    href: 'mailto:hello@ranksty.com',
    desc: 'For general questions, partnerships, and press.',
  },
  {
    icon: '🛠️',
    label: 'Technical Support',
    value: 'support@ranksty.com',
    href: 'mailto:support@ranksty.com',
    desc: 'Having trouble with the platform? We respond within 24 hours.',
  },
  {
    icon: '💼',
    label: 'Business & Billing',
    value: 'billing@ranksty.com',
    href: 'mailto:billing@ranksty.com',
    desc: 'Questions about your subscription, invoices, or enterprise plans.',
  },
]

const FAQS = [
  {
    q: 'How quickly do you respond?',
    a: 'We aim to respond to all inquiries within 24 hours on business days. Technical support tickets usually get a first response within a few hours.',
  },
  {
    q: 'Is Ranksty officially affiliated with Etsy?',
    a: "No. Ranksty is an independent analytics tool. The term 'Etsy' is a trademark of Etsy, Inc. We are not endorsed, certified, or affiliated with Etsy, Inc. in any way.",
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
  border: '1px solid rgba(60,60,60,0.15)',
  borderRadius: 2,
  fontSize: 14,
  color: C.orange,
  background: C.snow,
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
                color: C.pale,
                marginBottom: 20,
              }}
            >
              <span style={{ width: 24, height: 1, background: C.orangeFaint, display: 'inline-block' }} />
              Contact Us
            </div>
            <h1
              style={{
                fontSize: 'clamp(36px, 5vw, 60px)',
                fontWeight: 300,
                letterSpacing: '-2px',
                color: '#FFFFFF',
                lineHeight: 1.05,
                marginBottom: 20,
              }}
            >
              We&apos;d love to hear<br />from you.
            </h1>
            <p
              style={{
                fontSize: 17,
                color: 'rgba(252,252,247,0.65)',
                lineHeight: 1.7,
                maxWidth: 500,
              }}
            >
              Whether you have a question, a feature idea, or just want to say hello — our team is here and happy to help.
            </p>
          </div>
        </div>

        {/* ── Channels ── */}
        <div style={{ background: C.warmGray, padding: '48px' }}>
          <div
            style={{
              maxWidth: 1200,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 2,
            }}
          >
            {CONTACT_CHANNELS.map((ch) => (
              <a
                key={ch.label}
                href={ch.href}
                style={{
                  background: C.snow,
                  padding: '32px',
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: C.orangeFaint,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    marginBottom: 16,
                  }}
                >
                  {ch.icon}
                </div>
                <p
                  style={{
                    fontSize: 11,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: C.charcoalMid,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    marginBottom: 6,
                  }}
                >
                  {ch.label}
                </p>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: C.orange,
                    marginBottom: 8,
                    letterSpacing: '-0.2px',
                  }}
                >
                  {ch.value}
                </p>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{ch.desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* ── Form + FAQ ── */}
        <div style={{ padding: '72px 48px' }}>
          <div
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
                  fontFamily: "'IBM Plex Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: C.orange,
                  marginBottom: 16,
                }}
              >
                <span style={{ width: 24, height: 1, background: C.charcoal, display: 'inline-block' }} />
                Send a message
              </div>
              <h2
                style={{
                  fontSize: 'clamp(24px, 3vw, 36px)',
                  fontWeight: 300,
                  letterSpacing: '-1px',
                  color: C.orange,
                  marginBottom: 40,
                }}
              >
                Drop us a line
              </h2>

              {submitted ? (
                <div
                  style={{
                    background: C.orangeFaint,
                    border: `1px solid rgba(255,96,8,0.15)`,
                    borderRadius: 2,
                    padding: '40px 36px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 16 }}>✅</div>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontFamily: "'IBM Plex Mono', monospace",
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
                        onFocus={(e) => (e.currentTarget.style.borderColor = C.forest)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(60,60,60,0.15)')}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontFamily: "'IBM Plex Mono', monospace",
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
                        onFocus={(e) => (e.currentTarget.style.borderColor = C.forest)}
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
                        fontFamily: "'IBM Plex Mono', monospace",
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = C.forest)}
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
                        fontFamily: "'IBM Plex Mono', monospace",
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = C.forest)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(60,60,60,0.15)')}
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    style={{
                      background: C.charcoal,
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '14px 32px',
                      borderRadius: 999,
                      fontSize: 14,
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
                  fontFamily: "'IBM Plex Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: C.orange,
                  marginBottom: 16,
                }}
              >
                <span style={{ width: 24, height: 1, background: C.charcoal, display: 'inline-block' }} />
                Common questions
              </div>
              <h2
                style={{
                  fontSize: 'clamp(24px, 3vw, 36px)',
                  fontWeight: 300,
                  letterSpacing: '-1px',
                  color: C.orange,
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
                      background: openFaq === i ? C.forest : C.warmGray,
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
                          color: openFaq === i ? C.snow : C.forest,
                          letterSpacing: '-0.2px',
                          transition: 'color 0.2s',
                        }}
                      >
                        {faq.q}
                      </span>
                      <span
                        style={{
                          fontSize: 18,
                          color: openFaq === i ? C.pale : C.forest,
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
                <span style={{ fontSize: 20, flexShrink: 0 }}>⚡</span>
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
