'use client'
import { useState } from 'react'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { C } from '@/utils'
import { Icon } from '@/components/ui/Icon'
import { SocialRow } from '@/components/ui/Social'

const SANS = "'General Sans',sans-serif"

/**
 * One inbox, one phone, one address — all real and monitored.
 *
 * There used to be hello@ / support@ / billing@. Only support@ exists, so the
 * other two silently bounced: worse than listing nothing, and a live contact
 * route is something Etsy's API review actually looks for.
 *
 * `href` is optional — the postal address isn't a link, and inventing a maps URL
 * for it would just be a guess. `bg`/`fg`/`chip` carry the August colour block.
 */
const CONTACT_CHANNELS: {
  icon: 'mail' | 'phone' | 'pin'
  label: string
  value: string
  href?: string
  desc: string
  bg: string
  fg: string
  chip: string
  chipIc: string
}[] = [
  {
    icon: 'mail',
    label: 'Email',
    value: 'support@rankkw.com',
    href: 'mailto:support@rankkw.com',
    desc: 'Support, billing, partnerships and press — everything reaches the same inbox. We reply within 24 hours on business days.',
    bg: C.charcoal, fg: '#fff', chip: 'rgba(255,255,255,0.14)', chipIc: '#fff',
  },
  {
    icon: 'phone',
    label: 'Phone',
    value: '0329 7890000',
    // tel: needs the international form or it won't dial from outside Pakistan.
    href: 'tel:+923297890000',
    desc: 'Pakistan Standard Time, business hours. Dial +92 329 7890000 from abroad.',
    bg: C.orange, fg: '#fff', chip: 'rgba(255,255,255,0.16)', chipIc: '#fff',
  },
  {
    icon: 'pin',
    label: 'Office',
    value: 'Bahawalpur, Pakistan',
    desc: 'Leaving Dol Beauty Salone, College Road, Bahawalpur, Punjab, Pakistan.',
    bg: '#DEEFE4', fg: C.ink, chip: '#fff', chipIc: '#1F7A42',
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
  padding: '13px 16px',
  border: `1px solid ${C.hair}`,
  borderRadius: 12,
  fontSize: 14.5,
  color: C.ink,
  background: C.paper,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s',
}
const labelStyle = {
  display: 'block' as const,
  fontSize: 11,
  fontFamily: SANS,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  color: C.graphite,
  marginBottom: 8,
}

const tag = (label: string, color = C.orange) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.1em', color, marginBottom: 16 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{label}
  </div>
)

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
        <section style={{ background: C.canvas, padding: 'clamp(140px,15vw,170px) 40px 76px', borderBottom: `1px solid ${C.hair}` }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {tag('Contact us')}
            <h1 style={{ fontSize: 'clamp(40px,5.6vw,72px)', fontWeight: 600, letterSpacing: '-0.04em', color: C.ink, lineHeight: 1.0, marginBottom: 22, maxWidth: 760 }}>
              We&apos;d love to hear from you.
            </h1>
            <p style={{ fontSize: 18, color: C.graphite, lineHeight: 1.6, maxWidth: 520 }}>
              Whether you have a question, a feature idea, or just want to say hello — our team is here and happy to help.
            </p>
          </div>
        </section>

        {/* ── Channels — colourful blocks ── */}
        <section style={{ background: C.paper, padding: '64px 40px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
              {CONTACT_CHANNELS.map((ch) => {
                // The address card has no href — render it as a plain div so it
                // doesn't look clickable and go nowhere.
                const Tag = (ch.href ? 'a' : 'div') as 'a' | 'div'
                const interactive = Boolean(ch.href)
                return (
                  <Tag
                    key={ch.label}
                    {...(ch.href ? { href: ch.href } : {})}
                    style={{
                      background: ch.bg,
                      color: ch.fg,
                      borderRadius: 26,
                      padding: '32px 32px 34px',
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 230,
                      transition: 'transform 0.18s',
                    }}
                    onMouseEnter={(e) => { if (interactive) e.currentTarget.style.transform = 'translateY(-3px)' }}
                    onMouseLeave={(e) => { if (interactive) e.currentTarget.style.transform = 'none' }}
                  >
                    <span style={{ width: 50, height: 50, borderRadius: 15, background: ch.chip, display: 'grid', placeItems: 'center', marginBottom: 'auto' }}>
                      <Icon name={ch.icon} size={23} color={ch.chipIc} />
                    </span>
                    <p style={{ fontSize: 11, fontFamily: SANS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 24, marginBottom: 8, opacity: 0.75 }}>
                      {ch.label}
                    </p>
                    <p style={{ fontSize: 19, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.02em' }}>
                      {ch.value}
                    </p>
                    <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0, opacity: ch.fg === '#fff' ? 0.85 : 0.72 }}>{ch.desc}</p>
                  </Tag>
                )
              })}
            </div>

            {/* Social — a fourth way to reach us, but not a support channel. */}
            <div className="rstack-sm" style={{ margin: '28px 0 0', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 11, fontFamily: SANS, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                Follow Rankkw
              </p>
              <SocialRow color={C.graphite} hoverColor={C.orange} size={19} gap={16} />
            </div>
          </div>
        </section>

        {/* ── Form + FAQ ── */}
        <section style={{ padding: '20px 40px 96px', background: C.paper }}>
          <div className="rsplit" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48, alignItems: 'start' }}>

            {/* Contact form — soft rounded panel */}
            <div style={{ background: C.canvas, borderRadius: 30, padding: 'clamp(32px,4vw,48px)' }}>
              {tag('Send a message')}
              <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 600, letterSpacing: '-0.03em', color: C.ink, marginBottom: 32 }}>
                Drop us a line
              </h2>

              {submitted ? (
                <div style={{ background: C.paper, border: `1px solid ${C.hair}`, borderRadius: 20, padding: '44px 36px', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DEEFE4', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
                    <Icon name="check" size={28} color="#1F8A4C" strokeWidth={2.4} />
                  </div>
                  <h3 style={{ fontSize: 21, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Message sent!</h3>
                  <p style={{ fontSize: 14.5, color: C.graphite, lineHeight: 1.6 }}>
                    Thanks for reaching out, {form.name}. We&apos;ll get back to you at {form.email} within 24 hours.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={labelStyle}>Full Name *</label>
                      <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" style={inputStyle}
                        onFocus={(e) => (e.currentTarget.style.borderColor = C.ink)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = C.hair)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Email Address *</label>
                      <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" style={inputStyle}
                        onFocus={(e) => (e.currentTarget.style.borderColor = C.ink)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = C.hair)} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Subject</label>
                    <select name="subject" value={form.subject} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = C.ink)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = C.hair)}>
                      <option>General</option>
                      <option>Technical Support</option>
                      <option>Billing &amp; Subscriptions</option>
                      <option>Feature Request</option>
                      <option>Partnership</option>
                      <option>Press &amp; Media</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Message *</label>
                    <textarea name="message" value={form.message} onChange={handleChange} placeholder="Tell us how we can help..." rows={6}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 140 }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = C.ink)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = C.hair)} />
                  </div>

                  <button onClick={handleSubmit}
                    style={{ background: C.orange, border: 'none', color: '#fff', padding: '14px 32px', borderRadius: 30, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: 'fit-content', boxShadow: '0 12px 26px rgba(251,94,9,0.28)', transition: 'opacity 0.2s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                    Send message →
                  </button>
                </div>
              )}
            </div>

            {/* FAQ */}
            <div>
              {tag('Common questions')}
              <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 600, letterSpacing: '-0.03em', color: C.ink, marginBottom: 28 }}>
                FAQs
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FAQS.map((faq, i) => {
                  const open = openFaq === i
                  return (
                    <div key={i} style={{ background: open ? C.charcoal : C.canvas, borderRadius: 18, transition: 'background 0.2s', cursor: 'pointer', overflow: 'hidden' }}
                      onClick={() => setOpenFaq(open ? null : i)}>
                      <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: open ? '#F5F5EB' : C.ink, letterSpacing: '-0.01em', transition: 'color 0.2s' }}>
                          {faq.q}
                        </span>
                        <span style={{ fontSize: 20, color: open ? C.orange : C.graphite, flexShrink: 0, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s, color 0.2s', lineHeight: 1 }}>
                          +
                        </span>
                      </div>
                      {open && (
                        <div style={{ padding: '0 22px 20px' }}>
                          <p style={{ fontSize: 14, color: 'rgba(245,245,235,0.75)', lineHeight: 1.7, margin: 0 }}>{faq.a}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 22, padding: '20px 22px', background: C.orangeFaint, borderRadius: 18, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <Icon name="bolt" size={18} color={C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13.5, color: C.orange, lineHeight: 1.6, margin: 0 }}>
                  <strong>Typical response time:</strong> We reply to most messages within 24 hours on business days. Premium plan users get priority support.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
