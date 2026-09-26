import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { LocalPaymentFlow } from '@/components/local-payment/LocalPaymentFlow'
import { C } from '@/utils'

export const metadata = {
  title: 'Local Payment (PKR) - Rankkw',
  description: 'Pay for your Rankkw plan in Pakistani Rupees by bank transfer or JazzCash.',
  robots: { index: false, follow: false },
}

// Login-gated in proxy.ts: a payment is attached to the signed-in account.
export default function LocalPaymentPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: C.canvas, padding: 'clamp(130px,14vw,170px) 16px 90px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 'clamp(30px,4.4vw,48px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.05, marginBottom: 12 }}>
              Pay in Pakistani Rupees
            </h1>
            <p style={{ fontSize: 16.5, color: C.graphite, lineHeight: 1.55, maxWidth: 560, margin: '0 auto' }}>
              Pay by bank transfer or JazzCash, attach your payment screenshot, and we turn your plan on as soon as we verify it.
            </p>
          </div>
          <LocalPaymentFlow />
        </div>
      </main>
      <Footer />
    </>
  )
}
