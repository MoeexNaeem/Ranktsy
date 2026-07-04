import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Sections'
import { FeeCalculatorSection } from '@/components/landing/FeeCalculatorSection'

export const metadata = {
  title: 'Etsy Fee Calculator — Ranktsy',
  description:
    "Estimate Etsy's listing, transaction and payment-processing fees, plus your net profit, margin and break-even price — free.",
}

export default function FeeCalculatorPage() {
  return (
    <>
      <Navbar />
      <main>
        <FeeCalculatorSection />
      </main>
      <Footer />
    </>
  )
}
