'use client'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, SearchBar, SectionTitle, ErrorBox, Loading, EmptyState, MONO } from '../kit'
import { ExportBtn, toCsv, downloadCsv, slugify } from '../controls'
import { C, D, formatNumber } from '@/utils'
import type { ApiResponse, KeywordGap, GapTag } from '@/types'

function AdoptionBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 6, background: C.bone, borderRadius: 999, overflow: 'hidden', minWidth: 44 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 999 }} />
    </div>
  )
}

function TagRow({ t }: { t: GapTag }) {
  // Missing-but-popular tags are the whole point — flag them in orange.
  const missing = t.yoursMissing
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 0.7fr', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.hair}` }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.ink, minWidth: 0 }}>
        {missing && <span title="You're missing this tag" style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, color: C.orange, background: C.orangeFaint, padding: '2px 7px', borderRadius: 100, flexShrink: 0 }}>ADD</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.tag}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
        <AdoptionBar pct={t.usedPct} color={missing ? C.orange : '#2E6DB4'} />
        <span style={{ fontSize: 12.5, fontFamily: MONO, color: C.graphite, width: 34, textAlign: 'right' }}>{t.usedPct}%</span>
      </span>
      <span style={{ fontSize: 13, fontFamily: MONO, color: C.graphite, textAlign: 'right' }}>{formatNumber(t.avgViews)}</span>
    </div>
  )
}

export function KeywordGapTab() {
  const [kwInput, setKwInput] = useState('ceramic mug')
  const [listingInput, setListingInput] = useState('')
  const [q, setQ] = useState('ceramic mug')
  const [listing, setListing] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['keyword-gap', q, listing],
    queryFn: async ({ signal }) => {
      const url = `/api/keywords/gap?q=${encodeURIComponent(q)}${listing ? `&listing=${encodeURIComponent(listing)}` : ''}`
      const { data } = await axios.get<ApiResponse<KeywordGap>>(url, { signal })
      if (!data.success || !data.data) throw new Error(data.error ?? 'Failed')
      return data.data
    },
    enabled: q.trim().length >= 2,
    staleTime: 1000 * 60 * 30,
    placeholderData: prev => prev,
    retry: false,
  })

  const run = useCallback(() => {
    const kw = kwInput.trim()
    if (kw.length >= 2) { setQ(kw); setListing(listingInput.trim()) }
  }, [kwInput, listingInput])

  const exportCsv = useCallback(() => {
    if (!data) return
    downloadCsv(`keyword-gap-${slugify(data.query)}.csv`, toCsv(
      ['Tag', 'Adoption %', 'Used by (of sample)', 'Avg views', data.hasTarget ? 'You are missing' : ''],
      data.tags.map(t => [t.tag, t.usedPct, t.used, t.avgViews, data.hasTarget ? (t.yoursMissing ? 'yes' : 'no') : '']),
    ))
  }, [data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card pad="18px">
        <SectionTitle>Keyword Gap &amp; Hidden Keywords</SectionTitle>
        <p style={{ fontSize: 13.5, color: C.graphite, lineHeight: 1.55, marginTop: -8, marginBottom: 16 }}>
          See the exact tags and title words the listings ranking for a keyword actually use — measured live, as real
          adoption counts. Paste your own listing URL to reveal the <strong style={{ color: C.orange }}>high-value tags
          you&apos;re missing</strong>.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SearchBar value={kwInput} onChange={setKwInput} onSubmit={run} placeholder="Keyword — e.g. ceramic mug" button="Analyze →" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.paper, border: `1px solid ${C.ash}`, borderRadius: 100, padding: '10px 16px', maxWidth: 560 }}>
            <span style={{ fontSize: 11, fontFamily: MONO, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Optional</span>
            <input value={listingInput} onChange={e => setListingInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
              placeholder="Your Etsy listing URL or ID — to find your gaps"
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 14.5, fontFamily: 'inherit', flex: 1, color: C.ink, minWidth: 0 }} />
          </div>
        </div>
      </Card>

      {isLoading && <Loading label="Reading the top listings from Etsy…" />}
      {isError && <ErrorBox>Couldn&apos;t analyse that keyword. Please try again.</ErrorBox>}

      {data && !isLoading && (
        <>
          {/* The actionable shortlist — only when a listing was given */}
          {data.hasTarget && (
            <Card style={{ borderColor: data.topMissingTags.length ? C.orange : C.ash }}>
              <SectionTitle right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.stone }}>your listing · {data.targetTagCount}/13 tags</span>}>
                {data.topMissingTags.length ? `${data.topMissingTags.length} hidden keywords to add` : 'No obvious gaps'}
              </SectionTitle>
              <p style={{ fontSize: 12.5, color: C.graphite, marginTop: -8, marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Comparing against: <strong style={{ color: C.ink }}>{data.targetTitle}</strong>
              </p>
              {data.topMissingTags.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {data.topMissingTags.map(t => (
                    <button key={t.tag} onClick={() => navigator.clipboard?.writeText(t.tag)} title="Click to copy"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: MONO, color: C.orange, background: C.orangeFaint, border: `1px solid ${C.orange}`, padding: '6px 13px', borderRadius: 100, cursor: 'pointer' }}>
                      {t.tag}
                      <span style={{ fontSize: 11, color: C.graphite }}>{t.usedPct}%</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13.5, color: D.good }}>Your listing already uses the tags top rivals rely on. Focus on title and photos next.</p>
              )}
              {(data.targetTagCount ?? 13) < 13 && (
                <p style={{ fontSize: 12, color: D.mid, marginTop: 12 }}>
                  You&apos;re using {data.targetTagCount} of 13 tags — {13 - (data.targetTagCount ?? 0)} slots are empty. Every slot is free reach.
                </p>
              )}
            </Card>
          )}

          {/* Full tag table */}
          <div>
            <div className="rsectitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
              <SectionTitle>Tags the winners use</SectionTitle>
              <ExportBtn onClick={exportCsv} />
            </div>
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 0.7fr', gap: 12, paddingBottom: 8, borderBottom: `1px solid ${C.ash}` }}>
                {['Tag', 'Adoption', 'Avg views'].map((h, i) => (
                  <span key={h} style={{ fontSize: 11, fontFamily: MONO, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.graphite, textAlign: i === 2 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>
              {data.tags.map(t => <TagRow key={t.tag} t={t} />)}
              <p style={{ fontSize: 11, color: C.stone, marginTop: 12, fontFamily: MONO, lineHeight: 1.6 }}>
                Adoption = share of the top {data.sampled} live listings using each tag. Avg views = the real mean views
                of those listings. {data.hasTarget ? 'Orange “ADD” marks tags your listing is missing.' : 'Paste your listing above to see which you’re missing.'}
              </p>
            </Card>
          </div>

          {/* Title words */}
          <div>
            <SectionTitle>Words in the winning titles</SectionTitle>
            <Card>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.titleWords.map(w => (
                  <span key={w.word} title={`${w.inTitlesPct}% of top titles contain “${w.word}”`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontFamily: MONO,
                      color: w.yoursMissing ? C.orange : C.ink,
                      background: w.yoursMissing ? C.orangeFaint : C.bone,
                      border: `1px solid ${w.yoursMissing ? C.orange : C.hair}`,
                      padding: '5px 12px', borderRadius: 100,
                    }}>
                    {w.word}
                    <span style={{ fontSize: 11, color: C.graphite }}>{w.inTitlesPct}%</span>
                  </span>
                ))}
              </div>
              {data.hasTarget && (
                <p style={{ fontSize: 11.5, color: C.stone, marginTop: 12 }}>Orange words appear in many winning titles but not in yours.</p>
              )}
            </Card>
          </div>
        </>
      )}

      {!data && !isLoading && !isError && (
        <EmptyState icon="🧩" title="Find your keyword gaps" sub="Enter a keyword — add your listing URL to see exactly what you're missing." />
      )}
    </div>
  )
}
