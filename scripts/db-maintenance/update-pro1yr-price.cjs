// One-time (2026-10-01): Pro 1-Year is now $49.99/year with no bonus pack.
// Updates the live deal page and the live popup ad, which are stored in the
// database (the code defaults only apply when they don't exist yet):
//   - price "$99.99" -> "$49.99", "about $7.50 / month" -> "about $4.17 / month"
//   - removes the "A serious head start for your shop" bonus-pack section
//   - em dashes -> " - " (house style)
// Safe to re-run.
//
// Preview:  node scripts/db-maintenance/update-pro1yr-price.cjs
// Apply:    node scripts/db-maintenance/update-pro1yr-price.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true)
const { MongoClient } = require('mongodb')

const APPLY = process.argv.includes('--apply')
const dash = s => (s || '').replace(/\s*—\s*/g, ' - ')
const fixDeal = s => dash(s)
  .replace(/\$7\.50\s*\/\s*month/g, '$4.17 / month')
  .replace(/~\$7\.50\/mo/g, '~$4.17/mo')
  .replace(/\$99\.99/g, '$49.99')
  .replace(/\n## A serious head start for your shop\n[\s\S]*?(?=\n## )/, '\n')
  // Match the current Pro 1-Year card (1 credit per search).
  .replace(/^- \*\*1,000 credits every day\*\*.*$/m, '- **150 credits every day** (1 per search) - plenty of room to research, generate and optimize.')
  .replace(/^- \*\*(?:Up to )?\d[\d,]* keyword searches \/ day\*\*/m, '- **Up to 150 keyword searches / day**')
  .replace(/\n{3,}/g, '\n\n')

;(async () => {
  const c = new MongoClient(process.env.MONGODB_URI)
  await c.connect()
  const db = c.db()
  console.log(APPLY ? 'APPLYING' : 'PREVIEW (add --apply to save)')

  const deal = await db.collection('deals').findOne({ seedKey: 'pro-1yr-deal' })
  if (deal) {
    const next = {
      title: dash(deal.title),
      summary: 'A full year of Rankkw Pro for $49.99 (about $4.17/mo), with 20 AI listing images a month.',
      content: fixDeal(deal.content),
    }
    console.log('\n--- DEAL summary ---\n' + next.summary + '\n--- DEAL content ---\n' + next.content)
    if (APPLY) await db.collection('deals').updateOne({ _id: deal._id }, { $set: { ...next, updatedAt: new Date() } })
  } else console.log('No Pro 1-Year deal found.')

  const ads = await db.collection('popupads').find({ $or: [{ price: /99\.99/ }, { priceNote: /7\.50/ }, { description: /bonus pack/i }] }).toArray()
  for (const ad of ads) {
    const next = {
      title: dash(ad.title),
      price: '$49.99',
      priceNote: 'per year · ~$4.17 / mo',
      description: 'A full year of Rankkw Pro at a locked-in price, with 20 AI listing images every month.',
    }
    console.log('\n--- POPUP AD ---\n' + JSON.stringify(next, null, 2))
    if (APPLY) await db.collection('popupads').updateOne({ _id: ad._id }, { $set: { ...next, updatedAt: new Date() } })
  }
  if (!ads.length) console.log('\nNo popup ad with the old price.')

  console.log(APPLY ? '\nSaved.' : '\nNothing saved (preview).')
  await c.close()
})().catch(e => { console.error(e); process.exit(1) })
