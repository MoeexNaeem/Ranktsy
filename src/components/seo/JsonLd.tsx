import type { ReactElement } from 'react'

/**
 * Renders a <script type="application/ld+json"> block SAFELY.
 *
 * JSON.stringify does not escape "<", so any page-authored field flowing into
 * structured data (a blog title, tag, or description) that contained
 * "</script><script>..." would break out of the tag and execute -- stored XSS.
 * We rewrite the HTML-significant characters (and the JS line/paragraph
 * separators, invalid raw in a script context) to their \uXXXX JSON escapes,
 * which is semantically identical for crawlers. Built with a real backslash from
 * fromCharCode so no source-escaping ambiguity can turn it into a no-op.
 */
function serialize(data: unknown): string {
  const bs = String.fromCharCode(92) // a single backslash
  return JSON.stringify(data)
    .split('<').join(bs + 'u003c')
    .split('>').join(bs + 'u003e')
    .split('&').join(bs + 'u0026')
    .split(String.fromCharCode(0x2028)).join(bs + 'u2028')
    .split(String.fromCharCode(0x2029)).join(bs + 'u2029')
}

export function JsonLd({ data }: { data: unknown }): ReactElement {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialize(data) }} />
}
