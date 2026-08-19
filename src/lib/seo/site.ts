/** Canonical site origin for absolute URLs in sitemaps, canonicals and JSON-LD. */
export function siteUrl(): string {
  // Prefer SITE_URL: a plain (server-only) env var. Unlike a NEXT_PUBLIC_* var it
  // is NOT inlined at build time, so it can be corrected in the deploy environment
  // without a rebuild. NEXT_PUBLIC_APP_URL is the fallback for existing setups.
  const raw = (process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')

  // A localhost origin baked into a production build is the classic cause of
  // sitemaps/canonicals pointing at localhost:3000 on the live site. In
  // production we never emit it — fall back to the real domain instead.
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(raw)
  if (!raw || (process.env.NODE_ENV === 'production' && isLocal)) return 'https://rankkw.com'

  // Canonical host is the apex domain (no www). If the deploy env still points at
  // www.rankkw.com, strip it here so sitemaps, canonicals and JSON-LD never emit
  // the www variant — without needing an env change or rebuild.
  return raw.replace(/^(https?:\/\/)www\./i, '$1')
}

export const abs = (path: string): string => `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
