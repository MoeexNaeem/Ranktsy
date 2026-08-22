import type { Metadata, Viewport } from 'next'
import { Providers } from '@/lib/providers'
import { Toaster }   from 'react-hot-toast'
import { siteUrl }   from '@/lib/seo/site'
import './globals.css'

export const metadata: Metadata = {
  // Resolves relative canonical/OG image URLs to absolute - without this, social
  // cards and canonicals silently break.
  metadataBase: new URL(siteUrl()),
  title: {
    default:  'Rankkw - Etsy Keyword Research & Analytics',
    template: '%s',   // child pages set full titles themselves
  },
  description: 'Data-driven keyword research, competition analysis, and trend tracking for Etsy sellers - measured from the official Etsy & Google APIs, never estimated.',
  keywords:    ['Etsy SEO', 'Etsy keyword research', 'Etsy analytics', 'Etsy tags', 'Etsy competitor analysis'],
  applicationName: 'Rankkw',
  alternates:  { canonical: '/' },
  openGraph: {
    title: 'Rankkw - Etsy Keyword Research & Analytics',
    description: 'Real Etsy keyword data - search volume, competition and trends from the official APIs.',
    url: siteUrl(), siteName: 'Rankkw', type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Rankkw - Etsy Keyword Research', description: 'Real Etsy keyword data, not estimates.' },
  robots: { index: true, follow: true },
  // Trustpilot one-time domain-verification tag. Renders:
  // <meta name="trustpilot-one-time-domain-verification-id" content="…">
  other: {
    'trustpilot-one-time-domain-verification-id': 'a93072bb-7251-41aa-ae54-3d354cdd9150',
  },
}
// Emits <meta name="viewport" content="width=device-width, initial-scale=1">.
//
// This silently did nothing while the layout rendered a manual <head>: Next's
// metadata injection de-duplicates head elements and a hand-written <head>
// suppressed it, so phones fell back to a 980px virtual viewport, no max-width
// media query ever matched, and the whole responsive layer in globals.css was
// dead code. Next 16 is explicit that root layouts must NOT hand-roll <head>.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FB5E09' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* General Sans (Fontshare) - closest free match to Perk's OTSono geometric
            grotesk. No <head> wrapper: React 19 hoists link tags into the head on
            its own, and adding one back would break the viewport meta again. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link href="https://api.fontshare.com/v2/css?f=general-sans@400,500,600,700&display=swap" rel="stylesheet" />
        <Providers>
          {children}
          <Toaster position="bottom-right" toastOptions={{ style: { background: '#3D3E3B', color: '#FFFFFF', borderRadius: 999, fontSize: 13, fontFamily: 'General Sans, sans-serif' } }} />
        </Providers>
      </body>
    </html>
  )
}
