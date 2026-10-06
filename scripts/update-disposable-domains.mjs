// Refresh data/disposable-domains.txt from the two public lists, keeping our own
// additions (lines after "# rankkw-seen") and never blocking real providers.
// Usage: node scripts/update-disposable-domains.mjs   (then deploy)
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCES = [
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf',
  'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt',
]
const SEEN = ['worxx.com', 'workxx.com', 'workmail.com', 'hotmmail.com']
const SAFE = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'zoho.com', 'yandex.com', 'yandex.ru', 'mail.ru', 'hey.com', 'fastmail.com',
  'tutanota.com', 'tuta.io', 'rocketmail.com', 'att.net', 'comcast.net', 'verizon.net', 'qq.com', '163.com', '126.com', 'naver.com', 'rediffmail.com'])

const out = new Set(SEEN)
for (const url of SOURCES) {
  const text = await (await fetch(url)).text()
  for (const line of text.split('\n')) {
    const d = line.trim().toLowerCase()
    if (d && !d.startsWith('#') && /^[a-z0-9.-]+\.[a-z0-9-]+$/.test(d)) out.add(d)
  }
}
for (const d of SAFE) out.delete(d)
const head = readFileSync('data/disposable-domains.txt', 'utf8').split('\n').filter(l => l.startsWith('#')).join('\n')
writeFileSync('data/disposable-domains.txt', head + '\n' + [...out].sort().join('\n') + '\n')
console.log(`${out.size} domains written to data/disposable-domains.txt`)
