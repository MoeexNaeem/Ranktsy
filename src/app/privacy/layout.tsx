import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Rankkw',
  description: 'Learn how Rankkw collects, uses, and protects your personal information.',
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}