import type { Metadata, Viewport } from 'next'
import { Providers } from '@/lib/providers'
import { Toaster }   from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title:       'Ranktsy — Etsy Keyword Research & Analytics',
  description: 'Data-driven keyword research, competition analysis, and trend tracking for Etsy sellers.',
  keywords:    ['Etsy SEO', 'Etsy keyword research', 'Etsy analytics'],
  openGraph:   { title: 'Ranktsy', description: 'Keyword research for Etsy sellers.', type: 'website' },
  robots:      { index: true, follow: true },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FF6008' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=IBM+Plex+Mono:wght@300;400&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster position="bottom-right" toastOptions={{ style: { background: '#3C3C3C', color: '#FFFFFF', borderRadius: 999, fontSize: 13, fontFamily: 'Inter, sans-serif' } }} />
        </Providers>
      </body>
    </html>
  )
}
