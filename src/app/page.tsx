import { Navbar }            from '@/components/landing/Navbar'
import { Hero }              from '@/components/landing/Hero'
import { Features, HowItWorks, Pricing, CTA, Footer, AboutContactTeaser } from '@/components/landing/Sections'
import { KeywordTool }       from '@/components/landing/KeywordTool'
import { ConnectSection }    from '@/components/landing/ConnectSection'
import { Reviews }           from '@/components/landing/Reviews'
import { Faq }               from '@/components/landing/Faq'
import { abs, siteUrl }      from '@/lib/seo/site'
import { JsonLd }            from '@/components/seo/JsonLd'

export const revalidate = 86400

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': abs('/#org'), name: 'Rankkw', url: siteUrl(), logo: abs('/website_logo.png'),
      description: 'Etsy SEO & analytics platform: keyword research, competitor analysis, trends and listing optimization from real Etsy & Google data.',
      email: 'support@rankkw.com',
      contactPoint: { '@type': 'ContactPoint', email: 'support@rankkw.com', contactType: 'customer support', url: abs('/contact'), availableLanguage: 'English' },
      address: { '@type': 'PostalAddress', addressCountry: 'PK' } },
    { '@type': 'WebSite', '@id': abs('/#website'), url: siteUrl(), name: 'Rankkw', publisher: { '@id': abs('/#org') } },
    { '@type': 'SoftwareApplication', name: 'Rankkw', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: siteUrl(),
      description: 'Research Etsy keywords with real search volume, competition and trends - measured from the official Etsy Open API and Google Ads, never estimated.',
      offers: { '@type': 'AggregateOffer', priceCurrency: 'USD', lowPrice: '0', highPrice: '49.99', offerCount: 8 } },
  ],
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <ConnectSection />
        <HowItWorks />
        <KeywordTool />
        <Reviews />
        <Pricing />
        <Faq />
        <AboutContactTeaser />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
