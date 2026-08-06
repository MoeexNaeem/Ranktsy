/** Blog helpers shared by the public pages, admin API and sitemap. */

/** Title → URL-safe slug (e.g. "How Keyword Research helps?" → "how-keyword-research-helps"). */
export function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/['’"]/g, '')                          // drop apostrophes/quotes
    .replace(/[^a-z0-9]+/g, '-')                          // non-alnum → hyphen
    .replace(/^-+|-+$/g, '')                              // trim hyphens
    .slice(0, 90)
}

/** Rough reading time in minutes from markdown body (~200 wpm, min 1). */
export function readingMinutes(markdown: string): number {
  const words = (markdown.replace(/[#*_>`!\[\]()-]/g, ' ').match(/\S+/g) || []).length
  return Math.max(1, Math.round(words / 200))
}

/** First ~160 chars of plain text from markdown, for meta description / cards. */
export function excerptFrom(markdown: string, max = 160): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')         // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // links → text
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain
}
