/**
 * Markdown to plain text, for anything a seller pastes into Etsy.
 *
 * The AI writes descriptions as markdown (## headings, **bold**, - bullets) so the
 * app can render them nicely, but Etsy's description box is PLAIN TEXT: pasted
 * markdown shows up literally as "#### Why you'll love it" and "**Handmade**".
 * Copy buttons run the text through this first.
 */
export function markdownToPlainText(md: string): string {
  if (!md) return ''
  return md
    // Fenced code blocks: keep the code, drop the fences.
    .replace(/```[a-z]*\n?/gi, '')
    // Headings: "## Why you'll love it" → "Why you'll love it"
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    // Bold / italic / strikethrough, including __bold__ and _italic_.
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_]([\s).,!?]|$)/g, '$1$2$3')
    .replace(/~~(.*?)~~/g, '$1')
    // Links and images: keep the visible text.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // Inline code.
    .replace(/`([^`]+)`/g, '$1')
    // Bullets: "- item" / "* item" → "• item" (Etsy shows these fine).
    .replace(/^\s{0,3}[-*+]\s+/gm, '• ')
    // Blockquotes and horizontal rules.
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}([-*_]\s?){3,}\s*$/gm, '')
    // Tidy: no more than one blank line, no trailing spaces.
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
