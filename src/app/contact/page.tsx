import type { Metadata } from 'next'
import { abs } from '@/lib/seo/site'
import { ContactContent } from './ContactContent'

export const metadata: Metadata = {
  title: 'Contact Rankkw — Support, feedback & partnerships',
  description: 'Get in touch with the Rankkw team for support, billing, feature requests or partnerships. We reply within 24 hours on business days.',
  alternates: { canonical: abs('/contact') },
  openGraph: { title: 'Contact Rankkw', description: 'Support, feedback and partnerships — we reply within 24 hours on business days.', url: abs('/contact'), type: 'website' },
}

export default function ContactPage() {
  return <ContactContent />
}
