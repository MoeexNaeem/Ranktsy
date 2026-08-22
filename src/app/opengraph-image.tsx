import { ImageResponse } from 'next/og'

// Default social/preview card for every page that doesn't set its own. Previously
// the whole site shipped no OG image, so shares and rich results had no thumbnail.
export const runtime = 'nodejs'
export const alt = 'Rankkw - Etsy Keyword Research & Analytics'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '0 90px', background: '#F5F5EB',
          fontFamily: 'sans-serif', position: 'relative',
        }}
      >
        {/* Brand accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: '#FB5E09' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FB5E09', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 30, fontWeight: 800 }}>R</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#3C3C3A', letterSpacing: -1 }}>Rankkw</div>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, color: '#232320', letterSpacing: -2, lineHeight: 1.05, maxWidth: 960 }}>
          Etsy Keyword Research &amp; Analytics
        </div>
        <div style={{ fontSize: 30, color: '#5B5B54', marginTop: 26, maxWidth: 900, lineHeight: 1.35 }}>
          Real search volume, competition and trends - measured from official data, never estimated.
        </div>
      </div>
    ),
    { ...size },
  )
}
