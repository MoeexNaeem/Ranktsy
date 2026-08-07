import Link from 'next/link'
import { Navbar } from '@/components/landing/Navbar'
import { Footer, CTA } from '@/components/landing/Sections'
import { PlanScroller, ComparePlans, PriceNote } from '@/components/landing/plans'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

export const metadata = {
  title: 'Pricing — Rankkw',
  description: 'Simple plans that grow with your Etsy shop. Compare Free, Starter, Pro, Business and Agency — every plan runs on the same real Etsy & Google data.',
}

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section style={{ background: C.canvas, padding: 'clamp(150px,16vw,190px) 24px 40px', textAlign: 'center' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.ink, marginBottom: 18 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />
              Pricing
            </div>
            <h1 style={{ fontSize: 'clamp(38px,5.4vw,64px)', fontWeight: 600, letterSpacing: '-0.04em', color: C.ink, lineHeight: 1.02, marginBottom: 18 }}>
              Find your plan
            </h1>
            <p style={{ fontSize: 'clamp(16px,1.5vw,19px)', color: C.graphite, lineHeight: 1.55, maxWidth: 560, margin: '0 auto' }}>
              From a free start to a full agency toolkit — choose the plan that fits your shop. Every plan runs on the same real Etsy &amp; Google data.
            </p>
          </div>
        </section>

        {/* Plan cards — single-row scroller */}
        <section style={{ background: C.canvas, padding: '40px 24px 96px' }}>
          <div style={{ maxWidth: 1300, margin: '0 auto' }}>
            <PlanScroller fade={C.canvas} />
          </div>
        </section>

        {/* Compare */}
        <section style={{ background: C.paper, padding: '96px 24px 110px' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.05, marginBottom: 12 }}>
                Compare every feature
              </h2>
              <p style={{ fontSize: 17, color: C.graphite, lineHeight: 1.5, maxWidth: 520, margin: '0 auto' }}>
                Everything each plan includes, side by side.
              </p>
            </div>
            <ComparePlans />
            <p style={{ textAlign: 'center', fontSize: 13.5, color: C.graphite, marginTop: 28 }}>
              <PriceNote /> Cancel anytime — no long-term contracts.{' '}
              <Link href="/#faq" style={{ color: C.orange, textDecoration: 'none' }}>Questions? Read the FAQ →</Link>
            </p>
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </>
  )
}
