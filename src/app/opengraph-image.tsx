import { ImageResponse } from 'next/og'

export const alt = 'Rankkw — Etsy Keyword Research & Analytics'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Site-wide default social share card. Pages without their own OG image (all the
// tool pages, and any blog post without a cover) fall back to this.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '84px', background: '#F5F5EB', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 800, color: '#3D3E3B', letterSpacing: '-2px' }}>R<span style={{ color: '#FB5E09' }}>:</span></div>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: '#3D3E3B' }}>Rankkw</div>
        </div>
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 800, color: '#3D3E3B', lineHeight: 1.05, letterSpacing: '-2px', maxWidth: 960 }}>
          Etsy keyword research, measured — not guessed.
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#6E6E64', marginTop: 30, maxWidth: 900, lineHeight: 1.35 }}>
          Real search volume, competition & trends from the official Etsy & Google APIs.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 44 }}>
          <div style={{ width: 14, height: 14, borderRadius: 99, background: '#FB5E09' }} />
          <div style={{ fontSize: 26, color: '#3D3E3B', fontWeight: 600 }}>rankkw.com</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
