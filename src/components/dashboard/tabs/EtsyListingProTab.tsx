'use client'
import { useCallback, useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Card, SectionTitle, EmptyState, ErrorBox, MONO, primaryBtn } from '../kit'
import { MiniMarkdown } from '../MiniMarkdown'
import { C, D } from '@/utils'
import { triggerUpgrade } from '@/lib/upgrade'
import type { ApiResponse } from '@/types'
import type { ListingPro } from '@/app/api/ai/listing-pro/route'

// Survives a page refresh — the tab otherwise loses the whole generated
// listing + images because they only ever lived in React state.
const LS_KEY = 'rk-listingpro-v1'

const CUR: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: '₨', INR: '₹' }
const sym = (c?: string) => CUR[c ?? 'USD'] ?? (c ? `${c} ` : '$')

type ImageType = 'main' | 'mockup' | 'feature' | 'combo'
// One image per listing (a clean hero product shot). The other styles remain in
// the union so the image-state map stays valid, but only 'main' is offered.
const IMAGE_TYPES: { type: ImageType; name: string; desc: string }[] = [
  { type: 'main',    name: 'Listing image', desc: 'Clean hero product shot' },
]

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200) }}
      style={{ fontSize: 12, fontFamily: MONO, color: done ? D.good : C.orange, background: 'transparent', border: `1px solid ${done ? D.good : C.orange}`, padding: '4px 12px', borderRadius: 100, cursor: 'pointer', flexShrink: 0 }}>
      {done ? '✓ Copied' : label}
    </button>
  )
}

interface ImgState { loading: boolean; dataUrl?: string; error?: string; costUsd?: number }
const BLANK_IMAGES: Record<ImageType, ImgState> = {
  main: { loading: false }, mockup: { loading: false }, feature: { loading: false }, combo: { loading: false },
}
interface Persisted { product: string; details: string; listing: ListingPro | null; images: Record<ImageType, ImgState> }

// Read once, synchronously, as each piece of state's lazy initial value —
// avoids the empty-then-hydrated flash (and the extra render) a restore
// effect would cause.
function readPersisted(): Partial<Persisted> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) as Partial<Persisted> : {}
  } catch { return {} } // corrupt/unavailable storage — start fresh
}

export function EtsyListingProTab() {
  const [product, setProduct] = useState(() => readPersisted().product ?? '')
  const [details, setDetails] = useState(() => readPersisted().details ?? '')
  const [ref, setRef] = useState<{ dataUrl: string; mimeType: string } | null>(null)
  const [images, setImages] = useState<Record<ImageType, ImgState>>(() => ({ ...BLANK_IMAGES, ...readPersisted().images }))
  const [listing, setListing] = useState<ListingPro | null>(() => readPersisted().listing ?? null)

  // Keep localStorage in sync with the latest generated listing + images.
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ product, details, listing, images } satisfies Persisted))
    } catch { /* quota exceeded (e.g. a large image) — not fatal, just skip persisting this update */ }
  }, [product, details, listing, images])

  const gen = useMutation({
    mutationFn: async () => {
      try {
        const { data } = await axios.post<ApiResponse<ListingPro>>('/api/ai/listing-pro', { product, details })
        if (!data.success || !data.data) throw new Error(data.error ?? 'Generation failed')
        return data.data
      } catch (e) {
        // Surface the server's honest message (e.g. "AI temporarily unavailable")
        // instead of axios's generic "Request failed with status code 502".
        if (axios.isAxiosError(e)) throw new Error(e.response?.data?.error ?? e.message)
        throw e
      }
    },
    onSuccess: (data) => { setListing(data); setImages(BLANK_IMAGES) },
  })

  const onFile = useCallback((f: File | undefined) => {
    if (!f) return setRef(null)
    const r = new FileReader()
    r.onload = () => setRef({ dataUrl: String(r.result), mimeType: f.type || 'image/png' })
    r.readAsDataURL(f)
  }, [])

  const genImage = useCallback(async (type: ImageType) => {
    if (!listing) return
    setImages(p => ({ ...p, [type]: { loading: true } }))
    try {
      const { data } = await axios.post<ApiResponse<{ dataUrl: string; costUsd?: number }>>('/api/ai/listing-image', {
        type, product, visual: listing.visual, features: listing.features,
        refImage: ref ? { data: ref.dataUrl, mimeType: ref.mimeType } : undefined,
      })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Image failed')
      setImages(p => ({ ...p, [type]: { loading: false, dataUrl: data.data!.dataUrl } }))
    } catch (e) {
      const resp = axios.isAxiosError(e) ? e.response : undefined
      if (resp?.status === 402 && resp.data?.code === 'plan_limit') {
        triggerUpgrade({ title: 'Image limit reached', message: resp.data.error, plan: resp.data.plan })
      }
      const msg = axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : (e instanceof Error ? e.message : 'Image failed')
      setImages(p => ({ ...p, [type]: { loading: false, error: msg } }))
    }
  }, [listing, product, ref])

  // Sequential, not parallel: firing all four image calls at once rate-limits
  // them against each other (that's what made one fail). One at a time is reliable.
  const genAll = useCallback(async () => {
    for (const t of IMAGE_TYPES) await genImage(t.type)
  }, [genImage])

  const download = (dataUrl: string, name: string) => {
    const a = document.createElement('a')
    a.href = dataUrl; a.download = name; a.click()
  }

  const canGen = product.trim().length >= 2 && !gen.isPending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── Input ─────────────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle right={<span style={{ fontSize: 10.5, fontFamily: MONO, color: C.stone }}>AI · Gemini + OpenAI</span>}>Etsy Listing Pro</SectionTitle>
        <p style={{ fontSize: 13, color: C.graphite, lineHeight: 1.6, marginTop: -6, marginBottom: 14 }}>
          Describe your product and get a <strong style={{ color: C.ink }}>complete listing</strong> — one optimized title,
          13 tags, a description, a price (anchored to the real market median), and a clean Etsy-style image.
        </p>
        <textarea value={product} onChange={e => setProduct(e.target.value)} rows={2}
          placeholder="What are you selling? e.g. personalized birth flower sweatshirt, minimalist gold necklace…"
          style={{ width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 10, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', color: C.ink, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
        <input value={details} onChange={e => setDetails(e.target.value)}
          placeholder="Optional: materials, size, colour, occasion…"
          style={{ width: '100%', background: C.canvas, border: `1px solid ${C.hair}`, borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontFamily: 'inherit', color: C.ink, outline: 'none', boxSizing: 'border-box', marginTop: 10 }} />

        <div className="rwrap-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={() => gen.mutate()} disabled={!canGen} style={{ ...primaryBtn, opacity: canGen ? 1 : 0.55 }}>
            {gen.isPending ? 'Writing your listing…' : 'Generate Listing →'}
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.graphite, cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={e => onFile(e.target.files?.[0])} style={{ display: 'none' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 100, border: `1px solid ${ref ? C.orange : C.ash}`, background: C.paper, color: ref ? C.orange : C.graphite }}>
              {ref ? '✓ Product photo added' : '＋ Add product photo (optional)'}
            </span>
          </label>
          {ref && <button onClick={() => setRef(null)} style={{ fontSize: 12.5, color: C.stone, background: 'none', border: 'none', cursor: 'pointer' }}>remove</button>}
        </div>
        <p style={{ fontSize: 11, color: C.stone, marginTop: 10, lineHeight: 1.55 }}>
          Add a real photo of your product to make the mockups from <em>your</em> item. Copy is grounded in the real tags &amp; median price of live Etsy listings; the price is an AI suggestion, not a guarantee.
        </p>
      </Card>

      {gen.isError && <ErrorBox>{gen.error instanceof Error ? gen.error.message : 'Generation failed.'}</ErrorBox>}

      {!listing && !gen.isPending && (
        <EmptyState icon="✨" title="Your full listing appears here" sub="Title, 13 tags, description, price and a clean Etsy-style image — all in one." />
      )}

      {listing && (
        <>
          {/* ─── Text package ─────────────────────────────────────────────── */}
          <Card>
            <SectionTitle right={<CopyBtn text={`${listing.title}\n\nTags: ${listing.tags.join(', ')}\n\n${listing.description}`} label="Copy all" />}>Listing content</SectionTitle>

            <Field label="Title" hint={`${listing.title.length}/140`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <p style={{ flex: 1, fontSize: 17, fontWeight: 500, color: C.ink, lineHeight: 1.5 }}>{listing.title}</p>
                <CopyBtn text={listing.title} />
              </div>
            </Field>

            <Field label={`Tags (${listing.tags.length}/13)`} hint={<CopyBtn text={listing.tags.join(', ')} label="Copy all 13" />}>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {listing.tags.map(t => (
                  <button key={t} onClick={() => navigator.clipboard?.writeText(t)} title="Click to copy"
                    style={{ fontSize: 14, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid rgba(251,94,9,0.22)`, padding: '7px 14px', borderRadius: 100, cursor: 'pointer' }}>{t}</button>
                ))}
              </div>
            </Field>

            <Field label="Price" hint={listing.marketMedian != null ? `real market median ${sym(listing.currency)}${listing.marketMedian}` : undefined}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 30, fontWeight: 600, color: D.good, letterSpacing: '-0.02em' }}>
                  {listing.priceSuggested != null ? `${sym(listing.currency)}${listing.priceSuggested}` : '—'}
                </span>
                <span style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI suggested</span>
              </div>
              {listing.priceReason && <p style={{ fontSize: 13.5, color: C.graphite, marginTop: 6, lineHeight: 1.55 }}>{listing.priceReason}</p>}
            </Field>

            <Field label="Description" hint={<CopyBtn text={listing.description} />}>
              {/* Rendered as real headings/bullets — same look as Description Gen. */}
              <div style={{ background: C.canvas, borderRadius: 12, padding: '18px 20px', border: `1px solid ${C.hair}` }}>
                <MiniMarkdown text={listing.description} />
              </div>
            </Field>

            {listing.materials.length > 0 && (
              <Field label="Materials">
                <p style={{ fontSize: 14.5, color: C.graphite }}>{listing.materials.join(' · ')}</p>
              </Field>
            )}
          </Card>

          {/* ─── Images ───────────────────────────────────────────────────── */}
          <Card>
            <SectionTitle right={
              <button onClick={genAll}
                style={{ fontSize: 12.5, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid ${C.orange}`, borderRadius: 100, padding: '6px 13px', cursor: 'pointer' }}>
                Generate image
              </button>
            }>Etsy-style image</SectionTitle>
            <p style={{ fontSize: 12.5, color: C.graphite, lineHeight: 1.6, marginTop: -6, marginBottom: 14 }}>
              A clean hero product image shot in a real Etsy style. Alt text: <span style={{ fontStyle: 'italic' }}>{listing.altText}</span>
            </p>
            {/* Wide hero preview — the generated image is 4:3, so let it fill the
                card (capped) instead of sitting small with empty space beside it. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, maxWidth: 760, margin: '0 auto' }}>
              {IMAGE_TYPES.map(({ type, name, desc }) => {
                const st = images[type]
                return (
                  <div key={type} style={{ border: `1px solid ${C.hair}`, borderRadius: 12, overflow: 'hidden', background: C.paper }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.hair}` }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{name}</p>
                        <p style={{ fontSize: 11.5, color: C.stone }}>{desc}</p>
                      </div>
                      {st.dataUrl && (
                        <>
                          <button onClick={() => download(st.dataUrl!, `${type}-${product.slice(0, 20).replace(/\s+/g, '-')}.png`)} style={miniBtn}>Download</button>
                          <button onClick={() => genImage(type)} style={miniBtn}>Redo</button>
                        </>
                      )}
                    </div>
                    <div style={{ background: C.canvas, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: st.dataUrl ? undefined : 300 }}>
                      {st.loading ? (
                        <>
                          <div className="shimmer" style={{ position: 'absolute', inset: 0, background: '#e8e7e2' }} />
                          <p style={{ position: 'relative', fontSize: 12.5, color: C.graphite }}>Generating…</p>
                        </>
                      ) : st.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={st.dataUrl} alt={name} style={{ width: '100%', height: 'auto', display: 'block' }} />
                      ) : st.error ? (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                          <p style={{ fontSize: 12.5, color: D.hard, lineHeight: 1.5, marginBottom: 10 }}>{st.error}</p>
                          <button onClick={() => genImage(type)} style={miniBtn}>Try again</button>
                        </div>
                      ) : (
                        <button onClick={() => genImage(type)} style={{ ...primaryBtn, height: 40 }}>Generate image</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

const miniBtn: React.CSSProperties = { fontSize: 11.5, fontFamily: MONO, color: C.graphite, background: C.canvas, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '5px 11px', cursor: 'pointer', flexShrink: 0 }

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 0', borderTop: `1px solid ${C.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
        <span style={{ fontSize: 12.5, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        {typeof hint === 'string' ? <span style={{ fontSize: 11.5, fontFamily: MONO, color: C.stone }}>{hint}</span> : hint}
      </div>
      {children}
    </div>
  )
}
