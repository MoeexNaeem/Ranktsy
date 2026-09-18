import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { JsonLd } from '@/components/seo/JsonLd'
import { Icon, type IconName } from '@/components/ui/Icon'
import { abs } from '@/lib/seo/site'
import { BASE_RATE, BONUS_RATE, TIER_THRESHOLD, BONUS_WINDOW_END, RECURRING_MONTHS, PAYOUT_MIN_USD, REF_COOKIE_MAX_AGE } from '@/lib/affiliate'
import { C } from '@/utils'

/**
 * Public affiliate landing page (server rendered, ISR-cached).
 *
 * Marketing surface for the referral programme: every number on it is read from
 * lib/affiliate.ts rather than typed here, so the page can never advertise a
 * rate the payout code does not actually pay. The single CTA deep-links to the
 * Refer and Earn tab in the dashboard, which is where a signed-in user enrols,
 * gets their link and creates custom links.
 */

const SANS = "'General Sans',sans-serif"

const RATE_PCT = Math.round(BASE_RATE * 100)
const BONUS_PCT = Math.round(BONUS_RATE * 100)
const COOKIE_DAYS = Math.round(REF_COOKIE_MAX_AGE / 86400)
const DASH_CTA = '/dashboard?tab=affiliate'

const TITLE = `Rankkw Affiliate Program: Earn ${RATE_PCT}% Recurring Commission`
const DESCRIPTION = `Join the Rankkw affiliate program and earn ${RATE_PCT}% recurring commission on every Etsy SEO plan you refer, for up to ${RECURRING_MONTHS} payments. Free to join, ${COOKIE_DAYS}-day cookie, custom referral links and live stats.`

export const revalidate = 86400

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'rankkw affiliate program',
    'etsy seo affiliate program',
    'etsy tool affiliate',
    'recurring affiliate commission',
    'etsy seller affiliate',
    'refer and earn etsy tools',
  ],
  alternates: { canonical: abs('/affiliate') },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: abs('/affiliate'),
    type: 'website',
    siteName: 'Rankkw',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
}

/* ── Content ──────────────────────────────────────────────────────────────── */

const STATS = [
  { number: `${RATE_PCT}%`, label: 'Recurring commission', bg: '#FCE7D8', fg: '#C2510B' },
  { number: `${RECURRING_MONTHS}`, label: 'Paid payments per customer', bg: '#DEEFE4', fg: '#1F7A42' },
  { number: `${COOKIE_DAYS} days`, label: 'Referral cookie window', bg: '#DEE6FF', fg: '#2E44C4' },
  { number: `$${PAYOUT_MIN_USD}`, label: 'Payout threshold', bg: C.bone, fg: C.ink },
]

const PERKS: { icon: IconName; title: string; desc: string; bg: string; fg: string; chip: string; chipIc: string }[] = [
  {
    icon: 'chart',
    title: 'Recurring, not one and done',
    desc: `You earn on every successful payment a referred customer makes, for up to ${RECURRING_MONTHS} payments, not just their first month.`,
    bg: C.charcoal, fg: '#fff', chip: 'rgba(255,255,255,0.14)', chipIc: '#fff',
  },
  {
    icon: 'link',
    title: 'Custom links you control',
    desc: 'Create your own readable links for each place you promote, edit them, delete them and swap them out whenever you like.',
    bg: '#FCE7D8', fg: C.ink, chip: '#fff', chipIc: '#C2510B',
  },
  {
    icon: 'trophy',
    title: `A ${BONUS_PCT}% bonus window`,
    desc: `Once you pass ${TIER_THRESHOLD} paying referrals, referrals ${TIER_THRESHOLD + 1} to ${BONUS_WINDOW_END} earn ${BONUS_PCT}% instead of ${RATE_PCT}%.`,
    bg: '#DEEFE4', fg: C.ink, chip: '#fff', chipIc: '#1F7A42',
  },
  {
    icon: 'eye',
    title: 'Stats you can actually check',
    desc: 'Clicks, signups, sales and what you are owed, all live in your dashboard. Nothing is hidden behind a monthly report.',
    bg: C.orange, fg: '#fff', chip: 'rgba(255,255,255,0.16)', chipIc: '#fff',
  },
]

const STEPS: { title: string; desc: string }[] = [
  {
    title: 'Join in one click',
    desc: 'Open the Refer and Earn tab in your Rankkw dashboard and enrol. It is free, there is nothing to apply for and no traffic minimum.',
  },
  {
    title: 'Share your link',
    desc: `Use your default link or create a custom one per channel. Anyone who arrives through it is tied to you for ${COOKIE_DAYS} days, so a visitor who signs up later still counts.`,
  },
  {
    title: 'Get paid every month they stay',
    desc: `When a referral buys a paid plan you earn ${RATE_PCT}% of that payment, and again on each renewal for up to ${RECURRING_MONTHS} payments. Withdraw once your approved balance passes $${PAYOUT_MIN_USD}.`,
  },
]

const AUDIENCE = [
  'Etsy coaches and course creators whose students need keyword data',
  'YouTube and TikTok creators reviewing Etsy seller tools',
  'Print on demand and digital product communities',
  'Bloggers writing Etsy SEO and shop growth guides',
  'Agencies and VAs who already manage Etsy shops for clients',
  'Facebook groups and Discord servers full of active sellers',
]

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How much does the Rankkw affiliate program pay?',
    a: `You earn ${RATE_PCT}% of every successful payment made by a customer you referred, for up to ${RECURRING_MONTHS} payments per subscription. Once you have more than ${TIER_THRESHOLD} paying referrals, referrals ${TIER_THRESHOLD + 1} to ${BONUS_WINDOW_END} earn ${BONUS_PCT}%. Each customer locks the rate they were acquired at, so their renewals keep paying you that same rate.`,
  },
  {
    q: 'Is it free to join?',
    a: 'Yes. Enrolling is free and instant from your Rankkw dashboard. You do not need a paid plan, an audience of a certain size or an application review.',
  },
  {
    q: 'How long does my referral link stay attached to a visitor?',
    a: `${COOKIE_DAYS} days. We store a first party cookie when someone arrives through your link, and the referral is credited to you when they create their account, even if that happens days later.`,
  },
  {
    q: 'Can I create my own custom referral links?',
    a: 'Yes. In the Refer and Earn tab you can create custom links, for example one for your newsletter and one for a video description, then edit or delete them at any time. Custom links are unique across Rankkw, so if a name is already in use you are told immediately and can pick another.',
  },
  {
    q: 'When and how do I get paid?',
    a: `Commissions are recorded as soon as a referred payment clears, then approved and paid out by the Rankkw team. You can withdraw once your approved balance passes $${PAYOUT_MIN_USD}, to a bank account, JazzCash or Easypaisa.`,
  },
  {
    q: 'What happens if a referred customer asks for a refund?',
    a: 'That payment is voided and the commission for it is removed. Commissions are only ever paid on payments Rankkw actually kept.',
  },
  {
    q: 'Can I refer myself or my own second account?',
    a: 'No. Self referrals are detected and are not commissioned. The program is for sending new sellers to Rankkw.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': abs('/affiliate#webpage'),
      url: abs('/affiliate'),
      name: TITLE,
      description: DESCRIPTION,
      isPartOf: { '@id': abs('/#website') },
      about: { '@id': abs('/#org') },
      breadcrumb: { '@id': abs('/affiliate#breadcrumb') },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': abs('/affiliate#breadcrumb'),
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/') },
        { '@type': 'ListItem', position: 2, name: 'Affiliate Program', item: abs('/affiliate') },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': abs('/affiliate#faq'),
      mainEntity: FAQS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
}

/* ── UI helpers (same language as /about and /methodology) ────────────────── */

const tag = (label: string, color: string = C.orange) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.1em', color, marginBottom: 18 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{label}
  </div>
)

const primaryCta: React.CSSProperties = {
  background: C.orange, color: '#fff', textDecoration: 'none', padding: '15px 32px',
  borderRadius: 30, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em',
  boxShadow: '0 14px 30px rgba(251,94,9,0.32)', display: 'inline-block',
}

export default function AffiliatePage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <Navbar />
      <main style={{ background: C.paper, minHeight: '100vh' }}>

        {/* ── Hero ── */}
        <section style={{ background: C.canvas, padding: 'clamp(140px,15vw,170px) 40px 84px', borderBottom: `1px solid ${C.hair}` }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {tag('Affiliate Program')}
            <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 72, alignItems: 'start' }}>
              <h1 style={{ fontSize: 'clamp(38px,5vw,62px)', fontWeight: 600, letterSpacing: '-0.04em', color: C.ink, lineHeight: 1.03, margin: 0 }}>
                Earn {RATE_PCT}% recurring for every Etsy seller you send to Rankkw.
              </h1>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 6 }}>
                <p style={{ fontSize: 17, color: C.graphite, lineHeight: 1.7, margin: 0 }}>
                  Rankkw gives Etsy sellers real keyword, competitor and sales data from the official Etsy Open API.
                  If you already talk to sellers, the affiliate program turns that into recurring income.
                </p>
                <p style={{ fontSize: 17, color: C.graphite, lineHeight: 1.7, margin: 0 }}>
                  You get {RATE_PCT}% of every payment a referred customer makes for up to {RECURRING_MONTHS} payments,
                  custom links you create and manage yourself, and live stats on clicks, signups and earnings.
                </p>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                  <Link href={DASH_CTA} style={primaryCta}>Go to affiliate dashboard →</Link>
                  <Link href="/register" style={{ color: C.ink, fontSize: 16, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                    Create a free account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Headline numbers ── */}
        <section style={{ background: C.paper, padding: '56px 40px' }}>
          <div className="rgrid-4" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 22, padding: '28px 26px' }}>
                <div style={{ fontSize: 'clamp(30px,3.4vw,44px)', fontWeight: 700, color: s.fg, letterSpacing: '-0.04em', lineHeight: 0.98, marginBottom: 8 }}>
                  {s.number}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: SANS, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.75 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Why this program ── */}
        <section style={{ padding: '92px 40px', background: C.canvas }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {tag('Why promote Rankkw')}
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.06, marginBottom: 14, maxWidth: 680 }}>
              A tool sellers keep paying for, and a commission that keeps paying you
            </h2>
            <p style={{ fontSize: 16.5, color: C.graphite, lineHeight: 1.6, maxWidth: 560, marginBottom: 44 }}>
              Etsy SEO is not a one week problem, so Rankkw is not a one month subscription. That is what makes a
              recurring commission worth having.
            </p>
            <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
              {PERKS.map(v => (
                <div key={v.title} style={{ background: v.bg, borderRadius: 26, padding: '34px 34px 36px', color: v.fg, display: 'flex', flexDirection: 'column', minHeight: 210 }}>
                  <span style={{ width: 50, height: 50, borderRadius: 15, background: v.chip, display: 'grid', placeItems: 'center', marginBottom: 22 }}>
                    <Icon name={v.icon} size={24} color={v.chipIc} />
                  </span>
                  <h3 style={{ fontSize: 23, fontWeight: 600, marginBottom: 12, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{v.title}</h3>
                  <p style={{ fontSize: 15.5, lineHeight: 1.6, margin: 0, opacity: v.fg === '#fff' ? 0.92 : 0.82 }}>{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section style={{ padding: '92px 40px', background: C.paper }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {tag('How it works')}
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.06, marginBottom: 44, maxWidth: 700 }}>
              Three steps, and no waiting on approval
            </h2>
            <div className="rgrid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
              {STEPS.map((s, i) => (
                <div key={s.title} style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 24, padding: '30px 28px 32px' }}>
                  <div style={{ fontSize: 13, fontFamily: SANS, fontWeight: 700, color: C.orange, letterSpacing: '0.08em', marginBottom: 14 }}>
                    STEP {i + 1}
                  </div>
                  <h3 style={{ fontSize: 20.5, fontWeight: 600, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.62, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who it suits ── */}
        <section style={{ padding: '0 40px 92px', background: C.paper }}>
          <div className="rsplit" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 72, alignItems: 'start' }}>
            <div>
              {tag('Who it suits')}
              <h2 style={{ fontSize: 'clamp(26px,3.2vw,38px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.08, margin: '0 0 14px' }}>
                Built for people who already have a seller audience
              </h2>
              <p style={{ fontSize: 16, color: C.graphite, lineHeight: 1.7, margin: 0 }}>
                You do not need a big following. You need an audience that is actually trying to sell on Etsy, because
                that is who gets value from Rankkw and stays subscribed.
              </p>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
              {AUDIENCE.map(a => (
                <li key={a} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 14, padding: '14px 16px' }}>
                  <span style={{ color: C.orange, display: 'inline-flex', flexShrink: 0, marginTop: 1 }}><Icon name="check" size={18} /></span>
                  <span style={{ fontSize: 15.5, color: C.ink, lineHeight: 1.5 }}>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Terms in plain words ── */}
        <section style={{ padding: '92px 40px', background: C.canvas, borderTop: `1px solid ${C.hair}` }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {tag('The rules, in plain words')}
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.06, marginBottom: 40, maxWidth: 680 }}>
              Nothing buried in the small print
            </h2>
            <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
              {[
                { t: 'Commission is per payment', d: `${RATE_PCT}% of each payment that clears, recorded the moment it does, up to ${RECURRING_MONTHS} payments per subscription.` },
                { t: 'The rate is locked per customer', d: 'A customer keeps the rate they were acquired at, so their renewals always pay you the same percentage.' },
                { t: 'Refunds reverse the commission', d: 'If a payment is refunded, the commission on it is voided. Nothing is clawed back from money you were already paid out.' },
                { t: 'Attribution is first touch at signup', d: `The ${COOKIE_DAYS}-day cookie is set on the first visit through your link, and the referral is stamped when the account is created.` },
                { t: 'Payouts are manual and traceable', d: `Rankkw collects the full sale and settles your share out of it. Withdraw once your approved balance passes $${PAYOUT_MIN_USD}.` },
                { t: 'No self referrals, no fake accounts', d: 'Referring yourself is not commissioned, and accounts created to farm commission are removed from the program.' },
              ].map(r => (
                <div key={r.t} style={{ background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 20, padding: '24px 26px' }}>
                  <h3 style={{ fontSize: 17.5, fontWeight: 600, color: C.ink, letterSpacing: '-0.015em', margin: '0 0 8px' }}>{r.t}</h3>
                  <p style={{ fontSize: 15, color: C.graphite, lineHeight: 1.6, margin: 0 }}>{r.d}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: C.stone, lineHeight: 1.6, marginTop: 26, maxWidth: 760 }}>
              The full legal version lives in our{' '}
              <Link href="/terms" style={{ color: C.orange, textDecoration: 'underline', textUnderlineOffset: 3 }}>Terms of Service</Link>{' '}
              and{' '}
              <Link href="/refund-policy" style={{ color: C.orange, textDecoration: 'underline', textUnderlineOffset: 3 }}>Refund Policy</Link>.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ padding: '92px 40px', background: C.paper }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            {tag('Questions')}
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.06, marginBottom: 36 }}>
              Affiliate program FAQ
            </h2>
            <div style={{ display: 'grid', gap: 14 }}>
              {FAQS.map(f => (
                <details key={f.q} style={{ background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 16, padding: '18px 22px' }}>
                  <summary style={{ fontSize: 16.5, fontWeight: 600, color: C.ink, cursor: 'pointer', letterSpacing: '-0.015em' }}>
                    {f.q}
                  </summary>
                  <p style={{ fontSize: 15.5, color: C.graphite, lineHeight: 1.7, margin: '12px 0 0' }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{ background: C.paper, padding: '0 40px 96px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', background: C.charcoal, borderRadius: 40, padding: 'clamp(60px,7vw,84px) 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(50% 50% at 50% 50%, rgba(251,94,9,0.22), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              {tag('Start earning', C.orange)}
              <h2 style={{ fontSize: 'clamp(30px,4.2vw,52px)', fontWeight: 600, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.04, marginBottom: 16 }}>
                Get your referral link in under a minute
              </h2>
              <p style={{ fontSize: 18, color: 'rgba(245,245,235,0.7)', marginBottom: 36, letterSpacing: '-0.01em' }}>
                Enrol from your dashboard, create the links you need, and share them today.
              </p>
              <div style={{ display: 'flex', gap: 22, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <Link href={DASH_CTA} style={primaryCta}>Open the affiliate dashboard →</Link>
                <Link href="/contact" style={{ color: '#fff', fontSize: 16, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 4 }}>
                  Talk to us first
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
