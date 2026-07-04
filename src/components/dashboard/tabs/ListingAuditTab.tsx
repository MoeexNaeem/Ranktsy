'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C } from '@/utils'
import { SearchBar, Card, SectionTitle, ErrorBox, Loading, EmptyState, TagPill, MONO } from '../kit'
import type { EtsyListing } from '@/types'

type Status = 'pass' | 'warn' | 'fail'
const TONE: Record<Status, { color: string; bg: string; icon: string }> = {
  pass: { color: C.success, bg: C.successBg, icon: '✓' },
  warn: { color: C.warn,    bg: C.warnBg,    icon: '!' },
  fail: { color: C.danger,  bg: C.dangerBg,  icon: '✕' },
}

function extractId(input: string): number | null {
  const m = input.match(/listing\/(\d+)/) || input.match(/(\d{6,})/)
  return m ? parseInt(m[1], 10) : null
}

interface Check { label: string; status: Status; detail: string }

function auditListing(l: EtsyListing): { checks: Check[]; score: number } {
  const titleLen = l.title.length
  const titleWords = l.title.trim().split(/\s+/).filter(Boolean).length
  const tags = l.tags ?? []
  const longTail = tags.filter(t => t.trim().split(/\s+/).length >= 2).length
  const descLen = (l.description ?? '').length
  const imgs = l.images?.length ?? 0

  const checks: Check[] = [
    {
      label: 'Title length',
      status: titleLen >= 70 && titleLen <= 140 ? 'pass' : titleLen >= 40 ? 'warn' : 'fail',
      detail: `${titleLen} / 140 chars — aim for 70–140 to use Etsy's full title space.`,
    },
    {
      label: 'Title keyword depth',
      status: titleWords >= 8 ? 'pass' : titleWords >= 5 ? 'warn' : 'fail',
      detail: `${titleWords} words — front-load descriptive, searchable phrases.`,
    },
    {
      label: 'Tags used',
      status: tags.length >= 13 ? 'pass' : tags.length >= 8 ? 'warn' : 'fail',
      detail: `${tags.length} / 13 tags — use all 13 for maximum reach.`,
    },
    {
      label: 'Long-tail tags',
      status: longTail >= 8 ? 'pass' : longTail >= 4 ? 'warn' : 'fail',
      detail: `${longTail} multi-word tags — long-tail phrases rank easier than single words.`,
    },
    {
      label: 'Description depth',
      status: descLen >= 250 ? 'pass' : descLen >= 100 ? 'warn' : 'fail',
      detail: `${descLen} chars — a richer description helps context & conversions.`,
    },
    {
      label: 'Photos',
      status: imgs >= 7 ? 'pass' : imgs >= 4 ? 'warn' : 'fail',
      detail: `${imgs} / 10 photos — more angles lift click-through & trust.`,
    },
  ]
  const score = Math.round((checks.reduce((s, c) => s + (c.status === 'pass' ? 2 : c.status === 'warn' ? 1 : 0), 0) / (checks.length * 2)) * 100)
  return { checks, score }
}

function priceStr(l: EtsyListing) {
  if (!l.price?.amount) return '—'
  return `${l.price.currency_code} ${(l.price.amount / (l.price.divisor || 100)).toFixed(2)}`
}

export function ListingAuditTab() {
  const [input, setInput] = useState('')
  const [id, setId] = useState<number | null>(null)
  const [badInput, setBadInput] = useState(false)

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing-audit', id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/etsy/listing?id=${id}`)
      return data.data as EtsyListing
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
    retry: false,
  })

  const go = useCallback(() => {
    const parsed = extractId(input.trim())
    if (!parsed) { setBadInput(true); setId(null); return }
    setBadInput(false); setId(parsed)
  }, [input])

  const audit = useMemo(() => (listing ? auditListing(listing) : null), [listing])
  const scoreTone = audit ? (audit.score >= 80 ? C.success : audit.score >= 55 ? C.warn : C.danger) : C.ink
  const scoreLabel = audit ? (audit.score >= 80 ? 'Excellent' : audit.score >= 55 ? 'Good — room to improve' : 'Needs work') : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SearchBar value={input} onChange={setInput} onSubmit={go} placeholder="Paste an Etsy listing URL or ID…" button="Audit →" maxWidth={560} />
      {badInput && <ErrorBox>Couldn&apos;t find a listing ID. Paste a full Etsy listing URL or the numeric ID.</ErrorBox>}

      {isLoading && <Loading label="Auditing listing…" />}
      {isError && <ErrorBox>Listing not found or inactive. Check the URL/ID and try again.</ErrorBox>}

      {audit && listing && !isLoading && (
        <>
          {/* Score + preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
            <Card pad="22px">
              <p style={{ fontSize: 10.5, fontFamily: MONO, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>SEO Score</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 52, fontWeight: 300, color: scoreTone, letterSpacing: '-2px', lineHeight: 1 }}>{audit.score}</span>
                <span style={{ fontSize: 18, color: '#a3a29a', fontFamily: MONO }}>/100</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: scoreTone, marginTop: 8 }}>{scoreLabel}</p>
              <div style={{ height: 6, background: C.bone, borderRadius: 999, marginTop: 14, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${audit.score}%`, background: scoreTone, borderRadius: 999, transition: 'width 0.6s ease' }} />
              </div>
            </Card>
            <Card pad="18px">
              <div style={{ display: 'flex', gap: 14 }}>
                {listing.images?.[0]?.url_570xN && (
                  <img src={listing.images[0].url_570xN} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${C.hair}` }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 500, color: C.ink, textDecoration: 'none', display: 'block', marginBottom: 6, lineHeight: 1.35 }}>{listing.title}</a>
                  <p style={{ fontSize: 12, fontFamily: MONO, color: C.orange, marginBottom: 8 }}>{priceStr(listing)} · 👁 {listing.views ?? 0} · ♥ {listing.num_favorers ?? 0}</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(listing.tags ?? []).slice(0, 6).map(t => <TagPill key={t}>{t}</TagPill>)}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Checklist */}
          <div>
            <SectionTitle>Audit checklist</SectionTitle>
            <Card pad={0}>
              {audit.checks.map((c, i) => {
                const t = TONE[c.status]
                return (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderBottom: i < audit.checks.length - 1 ? `1px solid ${C.hair}` : 'none' }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: t.bg, color: t.color, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 500, color: C.ink }}>{c.label}</p>
                      <p style={{ fontSize: 12.5, color: '#3a4444', marginTop: 2, lineHeight: 1.45 }}>{c.detail}</p>
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>
        </>
      )}

      {!id && !isLoading && !badInput && (
        <EmptyState icon="🔍" title="Audit any Etsy listing" sub="Paste a listing URL or ID to score its title, tags, description & photos" />
      )}
    </div>
  )
}
