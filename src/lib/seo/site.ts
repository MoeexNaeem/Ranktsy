/** Canonical site origin for absolute URLs in sitemaps, canonicals and JSON-LD. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'https://rankkw.com'
  return raw.replace(/\/+$/, '')
}

export const abs = (path: string): string => `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
