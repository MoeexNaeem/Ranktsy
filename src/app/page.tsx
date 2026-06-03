import { Navbar }            from '@/components/landing/Navbar'
import { Hero }              from '@/components/landing/Hero'
import { Features, HowItWorks, Pricing, CTA, Footer } from '@/components/landing/Sections'
import { KeywordTool }       from '@/components/landing/KeywordTool'
import { DashboardSection }  from '@/components/landing/DashboardSection'

export const revalidate = 86400

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <KeywordTool />
        <DashboardSection />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
