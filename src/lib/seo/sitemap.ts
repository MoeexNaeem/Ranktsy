/** Tiny sitemap XML builders (urlset + sitemap index). */
export interface UrlEntry { loc: string; lastmod?: string; changefreq?: string; priority?: number }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function urlset(entries: UrlEntry[]): string {
  const rows = entries.map(e =>
    `  <url>\n    <loc>${esc(e.loc)}</loc>` +
    (e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : '') +
    (e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : '') +
    (e.priority != null ? `\n    <priority>${e.priority}</priority>` : '') +
    `\n  </url>`,
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>`
}

export function sitemapIndex(maps: { loc: string; lastmod?: string }[]): string {
  const rows = maps.map(m =>
    `  <sitemap>\n    <loc>${esc(m.loc)}</loc>` +
    (m.lastmod ? `\n    <lastmod>${m.lastmod}</lastmod>` : '') +
    `\n  </sitemap>`,
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</sitemapindex>`
}

export const XML_HEADERS = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
