/**
 * Google Ads campaign-building constants shared by the browser wizard and the server
 * (no server imports here). Limits mirror Google Ads' own rules so the wizard can
 * warn before Google rejects anything.
 */

/** sessionStorage key other tools (e.g. Keyword Search) use to prefill the campaign wizard. */
export const GADS_PREFILL_KEY = 'rk_gads_prefill'

// Country location criteria. Google's country criterion id is 2000 + the ISO 3166-1
// numeric code (e.g. United States 840 → 2840), so these are exact, not guessed.
const COUNTRY_ROWS: [string, string, number][] = [
  ['US', 'United States', 840], ['GB', 'United Kingdom', 826], ['CA', 'Canada', 124], ['AU', 'Australia', 36],
  ['NZ', 'New Zealand', 554], ['IE', 'Ireland', 372], ['DE', 'Germany', 276], ['FR', 'France', 250],
  ['ES', 'Spain', 724], ['IT', 'Italy', 380], ['NL', 'Netherlands', 528], ['BE', 'Belgium', 56],
  ['AT', 'Austria', 40], ['CH', 'Switzerland', 756], ['SE', 'Sweden', 752], ['NO', 'Norway', 578],
  ['DK', 'Denmark', 208], ['FI', 'Finland', 246], ['PT', 'Portugal', 620], ['PL', 'Poland', 616],
  ['AE', 'United Arab Emirates', 784], ['SA', 'Saudi Arabia', 682], ['IN', 'India', 356], ['PK', 'Pakistan', 586],
  ['SG', 'Singapore', 702], ['MY', 'Malaysia', 458], ['PH', 'Philippines', 608], ['JP', 'Japan', 392],
  ['ZA', 'South Africa', 710], ['BR', 'Brazil', 76], ['MX', 'Mexico', 484],
]
export const AD_COUNTRIES = COUNTRY_ROWS.map(([code, name, iso]) => ({ code, name, geoId: String(2000 + iso) }))
export const AD_COUNTRY_IDS = new Set(AD_COUNTRIES.map(c => c.geoId))

// Google Ads language constants.
export const AD_LANGUAGES = [
  { code: 'en', name: 'English', id: '1000' },
  { code: 'de', name: 'German', id: '1001' },
  { code: 'fr', name: 'French', id: '1002' },
  { code: 'es', name: 'Spanish', id: '1003' },
  { code: 'it', name: 'Italian', id: '1004' },
  { code: 'ja', name: 'Japanese', id: '1005' },
  { code: 'nl', name: 'Dutch', id: '1010' },
  { code: 'pt', name: 'Portuguese', id: '1014' },
  { code: 'ar', name: 'Arabic', id: '1019' },
]
export const AD_LANGUAGE_IDS = new Set(AD_LANGUAGES.map(l => l.id))

export type MatchType = 'BROAD' | 'PHRASE' | 'EXACT'
export type BiddingChoice = 'MAXIMIZE_CONVERSIONS' | 'TARGET_CPA' | 'TARGET_ROAS' | 'MANUAL_CPC'

export const BIDDING_OPTIONS: { id: BiddingChoice; label: string; help: string; portfolio: boolean }[] = [
  { id: 'MAXIMIZE_CONVERSIONS', label: 'Maximize conversions', help: 'Google sets bids to get the most conversions within your budget.', portfolio: false },
  { id: 'TARGET_CPA', label: 'Target CPA', help: 'Get as many conversions as possible at your target cost per conversion.', portfolio: true },
  { id: 'TARGET_ROAS', label: 'Target ROAS', help: 'Get as much conversion value as possible at your target return on ad spend.', portfolio: true },
  { id: 'MANUAL_CPC', label: 'Manual CPC', help: 'You set the maximum cost per click yourself.', portfolio: false },
]

// Responsive search ad + keyword limits (Google Ads rules).
export const RSA = { headlineMax: 30, headlinesMin: 3, headlinesMax: 15, descriptionMax: 90, descriptionsMin: 2, descriptionsMax: 4, pathMax: 15 }
export const KEYWORD = { maxChars: 80, maxWords: 10, maxPerAdGroup: 200 }

/**
 * One keyword per line, Google Ads Editor syntax:
 *   [red dress]   → exact,   "red dress" → phrase,   red dress → the default match type.
 * Returns de-duplicated keywords plus the lines that break Google's limits.
 */
export function parseKeywordLines(text: string, defaultMatch: MatchType): { keywords: { text: string; matchType: MatchType }[]; invalid: string[] } {
  const seen = new Set<string>()
  const keywords: { text: string; matchType: MatchType }[] = []
  const invalid: string[] = []
  for (const raw of text.split(/\r?\n|,/)) {
    const line = raw.trim()
    if (!line) continue
    let matchType = defaultMatch
    let kw = line
    if (/^\[.*\]$/.test(line)) { matchType = 'EXACT'; kw = line.slice(1, -1) }
    else if (/^".*"$/.test(line)) { matchType = 'PHRASE'; kw = line.slice(1, -1) }
    kw = kw.replace(/\s+/g, ' ').trim().toLowerCase()
    if (!kw || kw.length > KEYWORD.maxChars || kw.split(' ').length > KEYWORD.maxWords || /[!@%^()={};~`<>?\\|]/.test(kw)) { invalid.push(line); continue }
    const key = `${matchType}|${kw}`
    if (seen.has(key)) continue
    seen.add(key)
    keywords.push({ text: kw, matchType })
  }
  return { keywords, invalid }
}

/** Budgets and bids are in micros; Google requires whole cents (multiples of 10,000 micros). */
export const toMicros = (amount: number) => Math.round(amount * 100) * 10_000
