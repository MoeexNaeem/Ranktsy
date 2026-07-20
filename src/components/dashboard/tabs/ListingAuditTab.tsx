'use client'
import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { C } from '@/utils'
import { SearchBar, Card, SectionTitle, ErrorBox, Loading, EmptyState, TagPill, MONO } from '../kit'
import { AiOptimizePanel } from '../listing/AiOptimizePanel'
import type { EtsyListing, ListingBenchmark } from '@/types'

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

/**
 * Checks that only exist because we know the niche.
 *
 * Generic advice ("use all 13 tags") is true of every listing on Etsy and so
 * tells you nothing about whether you can win THIS search. These compare against
 * the real medians of the listings you're actually up against.
 */
function benchmarkChecks(l: EtsyListing, b?: ListingBenchmark): Check[] {
  if (!b?.enoughData) return []
  const out: Check[] = []
  const imgs = l.images?.length ?? 0
  const tags = (l.tags ?? []).length

  if (b.medianImages != null) {
    out.push({
      label: 'Photos vs rivals',
      status: imgs >= b.medianImages ? 'pass' : imgs >= b.medianImages - 2 ? 'warn' : 'fail',
      detail: `You have ${imgs}; the median listing for “${b.niche}” has ${b.medianImages}.`,
    })
  }
  if (b.medianTags != null) {
    out.push({
      label: 'Tags vs rivals',
      status: tags >= b.medianTags ? 'pass' : 'warn',
      detail: `You use ${tags}; rivals for “${b.niche}” median ${b.medianTags}.`,
    })
  }
  if (b.medianPrice != null && b.priceComparable && l.price?.amount) {
    const yours = l.price.amount / (l.price.divisor || 100)
    const pct = b.yourPricePercentile ?? 50
    const ratio = yours / b.medianPrice
    out.push({
      label: 'Price position',
      // Neither extreme is inherently wrong — but being 2× the median without
      // knowing it is.
      status: ratio > 2 || ratio < 0.5 ? 'warn' : 'pass',
      detail: `${b.currency} ${yours.toFixed(2)} vs a niche median of ${b.currency} ${b.medianPrice.toFixed(2)} — pricier than ${pct}% of ${b.priceSample} rivals.`,
    })
  }
  if (b.yourFavoritesPercentile != null) {
    const pct = b.yourFavoritesPercentile
    out.push({
      label: 'Buyer pull vs rivals',
      status: pct >= 60 ? 'pass' : pct >= 30 ? 'warn' : 'fail',
      detail: `More favorited than ${pct}% of the top ${b.sample} listings for “${b.niche}”.`,
    })
  }
  return out
}

/**
 * Tag-hygiene checks — real, computed from the listing's own 13 tags. These
 * catch the mistakes that quietly waste tag slots: duplicates, near-duplicates,
 * and tags over Etsy's 20-character limit (which Etsy truncates).
 */
function tagHygieneChecks(l: EtsyListing): Check[] {
  const tags = (l.tags ?? []).map(t => t.trim()).filter(Boolean)
  if (!tags.length) return []
  const out: Check[] = []

  // Exact duplicates (case-insensitive) — each one is a wasted slot.
  const seen = new Map<string, number>()
  for (const t of tags) seen.set(t.toLowerCase(), (seen.get(t.toLowerCase()) ?? 0) + 1)
  const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([t]) => t)
  out.push({
    label: 'Duplicate tags',
    status: dupes.length ? 'fail' : 'pass',
    detail: dupes.length
      ? `${dupes.length} duplicate tag${dupes.length === 1 ? '' : 's'} (${dupes.slice(0, 3).join(', ')}) — each repeat wastes one of your 13 slots.`
      : 'No duplicate tags — every slot is a distinct phrase.',
  })

  // Over-length tags — Etsy caps tags at 20 chars and truncates the rest.
  const tooLong = tags.filter(t => t.length > 20)
  if (tooLong.length) {
    out.push({
      label: 'Tag length',
      status: 'warn',
      detail: `${tooLong.length} tag${tooLong.length === 1 ? '' : 's'} over 20 characters — Etsy truncates these (e.g. “${tooLong[0]}”).`,
    })
  }

  // NOTE: long-tail / multi-word coverage is already scored by the base audit
  // ("Long-tail tags"), so it's deliberately not repeated here.
  return out
}

function auditListing(l: EtsyListing, hasVariations = false, b?: ListingBenchmark): { checks: Check[]; score: number } {
  const titleLen = l.title.length
  const titleWords = l.title.trim().split(/\s+/).filter(Boolean).length
  const tags = l.tags ?? []
  const longTail = tags.filter(t => t.trim().split(/\s+/).length >= 2).length
  const descLen = (l.description ?? '').length
  const imgs = l.images?.length ?? 0

  const checks: Check[] = [
    {
      label: 'Product options',
      status: hasVariations ? 'pass' : 'warn',
      detail: hasVariations ? 'Offers variations (size/colour/etc.) — buyers get choice in one listing.' : 'No variations found — options like size or colour can lift conversions.',
    },
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
  const all = [...checks, ...tagHygieneChecks(l), ...benchmarkChecks(l, b)]
  const score = Math.round((all.reduce((s, c) => s + (c.status === 'pass' ? 2 : c.status === 'warn' ? 1 : 0), 0) / (all.length * 2)) * 100)
  return { checks: all, score }
}

function priceStr(l: EtsyListing) {
  if (!l.price?.amount) return '—'
  return `${l.price.currency_code} ${(l.price.amount / (l.price.divisor || 100)).toFixed(2)}`
}

export function ListingAuditTab() {
  const [input, setInput] = useState('')
  const [id, setId] = useState<number | null>(null)
  const [badInput, setBadInput] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listing-audit', id],
    queryFn: async () => {
      const [lRes, vRes, bRes] = await Promise.all([
        axios.get(`/api/etsy/listing?id=${id}`),
        axios.get(`/api/etsy/variations?id=${id}`).catch(() => ({ data: { data: { hasVariations: false, variations: [] } } })),
        // Benchmarking is a bonus signal — a failure here must not sink the audit.
        axios.get(`/api/etsy/benchmark?id=${id}`).catch(() => ({ data: { data: undefined } })),
      ])
      return {
        listing: lRes.data.data as EtsyListing,
        variations: (vRes.data.data ?? { hasVariations: false, variations: [] }) as { hasVariations: boolean; variations: { property: string; values: string[] }[] },
        benchmark: bRes.data.data as ListingBenchmark | undefined,
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
    retry: false,
  })
  const listing = data?.listing
  const variations = data?.variations
  const benchmark = data?.benchmark

  const go = useCallback(() => {
    const parsed = extractId(input.trim())
    if (!parsed) { setBadInput(true); setId(null); return }
    setBadInput(false); setId(parsed)
  }, [input])

  const audit = useMemo(
    () => (listing ? auditListing(listing, variations?.hasVariations, benchmark) : null),
    [listing, variations, benchmark])
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
          <div className="rsplit" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
            <Card pad="22px">
              <p style={{ fontSize: 12, fontFamily: MONO, fontWeight: 500, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>SEO Score</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 58, fontWeight: 500, color: scoreTone, letterSpacing: '-0.03em', lineHeight: 1 }}>{audit.score}</span>
                <span style={{ fontSize: 20, color: C.stone, fontFamily: MONO }}>/100</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: scoreTone, marginTop: 10 }}>{scoreLabel}</p>
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
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: t.bg, color: t.color, fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 500, color: C.ink }}>{c.label}</p>
                      <p style={{ fontSize: 13.5, color: C.graphite, marginTop: 3, lineHeight: 1.45 }}>{c.detail}</p>
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>

          {/* AI Improvement Suggestions + One-Click Optimization — the audit
              finds the gaps, Gemini writes the fixes. */}
          <AiOptimizePanel listing={listing} findings={audit.checks} />

          {/* Product variations */}
          {variations && variations.variations.length > 0 && (
            <div>
              <SectionTitle right={<span style={{ fontSize: 12, fontFamily: MONO, color: C.graphite }}>{variations.variations.length} option{variations.variations.length === 1 ? '' : 's'}</span>}>Product variations</SectionTitle>
              <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {variations.variations.map(v => (
                    <div key={v.property}>
                      <p style={{ fontSize: 12.5, fontFamily: MONO, fontWeight: 600, color: C.graphite, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9 }}>{v.property} · {v.values.length}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {v.values.slice(0, 40).map(val => (
                          <span key={val} style={{ fontSize: 13.5, background: C.bone, color: C.ink, padding: '5px 13px', borderRadius: 100 }}>{val}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {!id && !isLoading && !badInput && (
        <EmptyState icon="🔍" title="Audit any Etsy listing" sub="Paste a listing URL or ID to score its title, tags, description & photos" />
      )}
    </div>
  )
}
