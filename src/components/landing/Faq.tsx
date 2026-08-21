'use client'
import { useState } from 'react'
import { Reveal } from './Reveal'
import { JsonLd } from '@/components/seo/JsonLd'
import { C } from '@/utils'

const SANS = "'General Sans',sans-serif"

const FAQS: { q: string; a: string }[] = [
  { q: 'What is RankKW?', a: `RankKW is an Etsy SEO and keyword research tool designed to help Etsy sellers discover relevant keywords, research products and competitors, optimize listings, and make better data-driven decisions for their shops.` },
  { q: 'How can RankKW help my Etsy shop?', a: `RankKW helps simplify Etsy SEO by giving you useful keyword, competition, listing, and market insights. You can use these insights to improve your titles, tags, descriptions, and overall listing strategy.` },
  { q: 'Can I use RankKW for Etsy keyword research?', a: `Yes. RankKW helps you discover relevant Etsy keywords and related search terms so you can identify phrases that potential customers may use when searching for products like yours.` },
  { q: 'How do I find the best keywords for my Etsy listings?', a: `Start with a keyword that accurately describes your product. RankKW can help you research related keywords and compare important metrics so you can select relevant terms with strong opportunities.` },
  { q: 'What is Etsy search volume?', a: `Search volume is an estimate of how frequently shoppers search for a particular keyword. It can help you understand the potential demand for a search term.` },
  { q: 'What does keyword competition mean?', a: `Keyword competition indicates how competitive a search term may be. Highly competitive keywords can be harder to rank for, while more specific keywords may provide opportunities to reach targeted shoppers.` },
  { q: 'What are long-tail keywords?', a: `Long-tail keywords are specific search phrases that usually contain multiple words, such as "personalized gold name necklace" instead of simply "necklace." They can help you target shoppers with more specific buying intentions.` },
  { q: 'Should I always choose keywords with the highest search volume?', a: `Not necessarily. High search volume can also come with high competition. A relevant keyword with moderate demand and lower competition may sometimes provide a better opportunity for your listing.` },
  { q: 'Can RankKW generate Etsy tags?', a: `Yes. RankKW can help you discover and generate relevant tag ideas based on your product or focus keyword, making it easier to optimize your Etsy listings.` },
  { q: 'Can RankKW help me create Etsy listing titles?', a: `Yes. RankKW can help create SEO-focused Etsy titles using relevant keywords while keeping the title understandable and attractive to potential customers.` },
  { q: 'Can RankKW help me write Etsy product descriptions?', a: `Yes. RankKW can help create optimized product descriptions that clearly explain your product while naturally incorporating relevant search terms.` },
  { q: 'Can I research my Etsy competitors with RankKW?', a: `Yes. Competitor research can help you understand your market, discover keyword opportunities, identify popular products, and see how other sellers position their listings.` },
  { q: 'Can RankKW help me find product ideas?', a: `Yes. You can use keyword, market, trend, and competitor research to identify potential product opportunities and niches worth investigating.` },
  { q: 'Can RankKW guarantee that my listing will rank on the first page of Etsy?', a: `No. No SEO tool can guarantee a specific Etsy search position. Etsy rankings can depend on many factors beyond keywords. RankKW provides research and optimization insights to help you make better decisions.` },
  { q: 'Will using RankKW guarantee more Etsy sales?', a: `No tool can guarantee sales. Product quality, pricing, images, customer reviews, competition, demand, conversion rate, customer service, and marketing can all affect performance. RankKW helps you improve the research and SEO side of your Etsy strategy.` },
  { q: 'How long does Etsy SEO take to work?', a: `There is no fixed timeframe. Changes in visibility can depend on your niche, competition, listing performance, keyword relevance, customer behavior, and Etsy's search system. SEO should be treated as an ongoing optimization process.` },
  { q: 'Should I change keywords on listings that are already selling well?', a: `Be careful when making major changes to successful listings. Use performance data and keyword research before changing a listing that already receives consistent traffic or sales.` },
  { q: 'Is RankKW suitable for new Etsy sellers?', a: `Yes. RankKW is designed to make Etsy research and SEO easier to understand, making it useful for beginners as well as experienced sellers who want deeper insights.` },
  { q: 'Can I use RankKW for digital and physical Etsy products?', a: `Yes. RankKW can be used to research keywords and optimize listings across many Etsy categories, including digital downloads, printables, templates, handmade products, craft supplies, clothing, jewelry, home decor, and more.` },
  { q: 'How often should I use RankKW for Etsy SEO?', a: `For the best results, use RankKW regularly to research new keywords, monitor competition, discover emerging opportunities, and review your existing listings. Regular SEO research can help you keep your Etsy strategy aligned with changing shopper searches and market trends.` },
]

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.ash}` }}>
      <button className="faq-q" onClick={onToggle} aria-expanded={open}>
        <span style={{ fontSize: 'clamp(17px,1.6vw,19px)', fontWeight: 500, color: C.ink, letterSpacing: '-0.01em' }}>{q}</span>
        <span style={{ flex: 'none', width: 30, height: 30, borderRadius: '50%', background: open ? C.orange : C.bone, color: open ? '#fff' : C.ink, display: 'grid', placeItems: 'center', transition: 'background 0.18s' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: C.graphite, padding: '0 44px 24px 4px', maxWidth: 760 }}>{a}</p>
        </div>
      </div>
    </div>
  )
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" style={{ background: C.paper, padding: '110px 40px' }}>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: FAQS.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }} />
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.11em', color: C.ink, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />
              FAQ
            </div>
            <h2 style={{ fontSize: 'clamp(32px,4.4vw,52px)', fontWeight: 600, letterSpacing: '-0.035em', color: C.ink, lineHeight: 1.05 }}>
              Questions, answered
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <div style={{ borderTop: `1px solid ${C.ash}` }}>
            {FAQS.map((f, i) => (
              <Item key={i} q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
