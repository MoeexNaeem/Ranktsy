/**
 * Google Ads reports for a user's connected account (Phase 2).
 *
 * Covers every reporting item in the Google Ads API Required Minimum Functionality
 * for Search campaigns:
 *   - Account (customer):  clicks, cost, impressions, conversions, all conversions (+ daily series)
 *   - Campaign:            clicks, cost, impressions, conversions, all conversions, status
 *   - Ad (ad group ad):    clicks, cost, impressions, conversions, status
 *   - Keyword:             clicks, cost, impressions, conversions, first page CPC, first position CPC, status
 *   - Search terms:        search term, match type, clicks, cost, impressions
 *   - Bidding strategy:    type, clicks, cost, cost/conversion, impressions, avg CPC, conversions, status
 *
 * Metric queries filtered by date only return rows WITH activity, so each entity
 * report also lists the entities themselves and merges, which keeps zero-activity
 * campaigns/ads/keywords visible (they're the ones people want to fix).
 */
import { gaqlSearch } from '@/lib/google-ads-user'
import type { IGoogleAdsAccountRef } from '@/lib/models'

export const REPORT_RANGES = ['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_14_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH'] as const
export type ReportRange = typeof REPORT_RANGES[number]
export const REPORT_TYPES = ['overview', 'campaigns', 'ads', 'keywords', 'search_terms', 'bidding'] as const
export type ReportType = typeof REPORT_TYPES[number]

export interface Metrics { clicks: number; impressions: number; cost: number; conversions: number; allConversions: number }

const micros = (v?: string | number | null) => (v == null ? 0 : Number(v) / 1_000_000)
const microsOrNull = (v?: string | number | null) => (v == null ? null : Number(v) / 1_000_000)
const num = (v?: string | number | null) => (v == null ? 0 : Number(v))
const zero = (): Metrics => ({ clicks: 0, impressions: 0, cost: 0, conversions: 0, allConversions: 0 })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const metricsOf = (m: any): Metrics => ({
  clicks: num(m?.clicks), impressions: num(m?.impressions), cost: micros(m?.costMicros),
  conversions: num(m?.conversions), allConversions: num(m?.allConversions),
})
const add = (a: Metrics, b: Metrics): Metrics => ({
  clicks: a.clicks + b.clicks, impressions: a.impressions + b.impressions, cost: a.cost + b.cost,
  conversions: a.conversions + b.conversions, allConversions: a.allConversions + b.allConversions,
})
const campaignFilter = (campaignId?: string | null) => (campaignId && /^\d+$/.test(campaignId) ? ` AND campaign.id = ${campaignId}` : '')

type Acc = Pick<IGoogleAdsAccountRef, 'customerId' | 'loginCustomerId'>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = (token: string, a: Acc, query: string, max = 2000) => gaqlSearch<any>(token, a.customerId, a.loginCustomerId, query, max)

// ─── Account overview ─────────────────────────────────────────────────────────
export async function accountOverview(token: string, a: Acc, range: ReportRange) {
  const daily = await q(token, a, `
    SELECT segments.date, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.all_conversions
    FROM customer WHERE segments.date DURING ${range} ORDER BY segments.date`)
  let totals = zero()
  const series = daily.map(r => {
    const m = metricsOf(r.metrics)
    totals = add(totals, m)
    return { date: String(r.segments.date), ...m }
  })
  return {
    totals: { ...totals, avgCpc: totals.clicks ? totals.cost / totals.clicks : null, costPerConversion: totals.conversions ? totals.cost / totals.conversions : null },
    series,
  }
}

// ─── Campaigns ────────────────────────────────────────────────────────────────
export async function campaignReport(token: string, a: Acc, range: ReportRange) {
  const [list, stats] = await Promise.all([
    q(token, a, `
      SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
             campaign.bidding_strategy_type, campaign.bidding_strategy, campaign_budget.amount_micros
      FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.name`),
    q(token, a, `
      SELECT campaign.id, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.all_conversions
      FROM campaign WHERE campaign.status != 'REMOVED' AND segments.date DURING ${range}`),
  ])
  const m = new Map<string, Metrics>()
  for (const r of stats) m.set(String(r.campaign.id), add(m.get(String(r.campaign.id)) ?? zero(), metricsOf(r.metrics)))
  return list.map(r => ({
    id: String(r.campaign.id), name: String(r.campaign.name), status: String(r.campaign.status),
    channel: String(r.campaign.advertisingChannelType), bidding: String(r.campaign.biddingStrategyType),
    portfolioStrategy: r.campaign.biddingStrategy ? String(r.campaign.biddingStrategy) : null,
    dailyBudget: micros(r.campaignBudget?.amountMicros),
    ...(m.get(String(r.campaign.id)) ?? zero()),
  }))
}

// ─── Ads ──────────────────────────────────────────────────────────────────────
export async function adReport(token: string, a: Acc, range: ReportRange, campaignId?: string | null) {
  const cf = campaignFilter(campaignId)
  const base = `ad_group_ad.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'${cf}`
  const [list, stats] = await Promise.all([
    q(token, a, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.type,
             ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
             ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.status, ad_group_ad.policy_summary.approval_status
      FROM ad_group_ad WHERE ${base} LIMIT 1000`),
    q(token, a, `
      SELECT ad_group.id, ad_group_ad.ad.id, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.all_conversions
      FROM ad_group_ad WHERE ${base} AND segments.date DURING ${range}`),
  ])
  const m = new Map<string, Metrics>()
  for (const r of stats) {
    const k = `${r.adGroup.id}~${r.adGroupAd.ad.id}`
    m.set(k, add(m.get(k) ?? zero(), metricsOf(r.metrics)))
  }
  return list.map(r => {
    const ad = r.adGroupAd.ad
    const headlines: string[] = (ad.responsiveSearchAd?.headlines ?? []).map((h: { text?: string }) => h.text).filter(Boolean)
    const descriptions: string[] = (ad.responsiveSearchAd?.descriptions ?? []).map((d: { text?: string }) => d.text).filter(Boolean)
    return {
      id: String(ad.id), adGroupId: String(r.adGroup.id), adGroupName: String(r.adGroup.name),
      campaignId: String(r.campaign.id), campaignName: String(r.campaign.name),
      type: String(ad.type), status: String(r.adGroupAd.status),
      approval: r.adGroupAd.policySummary?.approvalStatus ? String(r.adGroupAd.policySummary.approvalStatus) : null,
      headlines, descriptions, finalUrl: (ad.finalUrls ?? [])[0] ?? null,
      ...(m.get(`${r.adGroup.id}~${ad.id}`) ?? zero()),
    }
  })
}

// ─── Keywords ─────────────────────────────────────────────────────────────────
export async function keywordReport(token: string, a: Acc, range: ReportRange, campaignId?: string | null) {
  const cf = campaignFilter(campaignId)
  const base = `ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'${cf}`
  const [list, stats] = await Promise.all([
    q(token, a, `
      SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id,
             ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status,
             ad_group_criterion.position_estimates.first_page_cpc_micros,
             ad_group_criterion.position_estimates.first_position_cpc_micros,
             ad_group_criterion.quality_info.quality_score
      FROM ad_group_criterion WHERE ${base} LIMIT 2000`),
    q(token, a, `
      SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.all_conversions
      FROM keyword_view WHERE ${base} AND segments.date DURING ${range}`),
  ])
  const m = new Map<string, Metrics>()
  for (const r of stats) {
    const k = `${r.adGroup.id}~${r.adGroupCriterion.criterionId}`
    m.set(k, add(m.get(k) ?? zero(), metricsOf(r.metrics)))
  }
  return list.map(r => {
    const c = r.adGroupCriterion
    return {
      id: String(c.criterionId), adGroupId: String(r.adGroup.id), adGroupName: String(r.adGroup.name),
      campaignId: String(r.campaign.id), campaignName: String(r.campaign.name),
      text: String(c.keyword?.text ?? ''), matchType: String(c.keyword?.matchType ?? ''), status: String(c.status),
      firstPageCpc: microsOrNull(c.positionEstimates?.firstPageCpcMicros),
      firstPositionCpc: microsOrNull(c.positionEstimates?.firstPositionCpcMicros),
      qualityScore: c.qualityInfo?.qualityScore != null ? Number(c.qualityInfo.qualityScore) : null,
      ...(m.get(`${r.adGroup.id}~${c.criterionId}`) ?? zero()),
    }
  })
}

// ─── Search terms ─────────────────────────────────────────────────────────────
export async function searchTermReport(token: string, a: Acc, range: ReportRange, campaignId?: string | null) {
  const rows = await q(token, a, `
    SELECT search_term_view.search_term, search_term_view.status, segments.search_term_match_type,
           campaign.id, campaign.name, ad_group.id, ad_group.name,
           metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.all_conversions
    FROM search_term_view WHERE segments.date DURING ${range}${campaignFilter(campaignId)}
    ORDER BY metrics.impressions DESC LIMIT 1000`)
  return rows.map(r => ({
    term: String(r.searchTermView.searchTerm), status: String(r.searchTermView.status ?? ''),
    matchType: String(r.segments?.searchTermMatchType ?? ''),
    campaignId: String(r.campaign.id), campaignName: String(r.campaign.name), adGroupName: String(r.adGroup.name),
    ...metricsOf(r.metrics),
  }))
}

// ─── Bidding strategies ───────────────────────────────────────────────────────
// Portfolio strategies are real resources with their own metrics; standard
// (campaign-level) strategies are reported per strategy type across the campaigns using them.
export async function biddingReport(token: string, a: Acc, range: ReportRange) {
  const [portfolioList, portfolioStats, campaigns] = await Promise.all([
    q(token, a, `SELECT bidding_strategy.id, bidding_strategy.name, bidding_strategy.type, bidding_strategy.status, bidding_strategy.campaign_count FROM bidding_strategy WHERE bidding_strategy.status != 'REMOVED'`),
    q(token, a, `SELECT bidding_strategy.id, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.all_conversions FROM bidding_strategy WHERE bidding_strategy.status != 'REMOVED' AND segments.date DURING ${range}`),
    campaignReport(token, a, range),
  ])
  const pm = new Map<string, Metrics>()
  for (const r of portfolioStats) pm.set(String(r.biddingStrategy.id), add(pm.get(String(r.biddingStrategy.id)) ?? zero(), metricsOf(r.metrics)))
  const withRatios = (m: Metrics) => ({ ...m, avgCpc: m.clicks ? m.cost / m.clicks : null, costPerConversion: m.conversions ? m.cost / m.conversions : null })

  const portfolio = portfolioList.map(r => ({
    kind: 'portfolio' as const,
    id: String(r.biddingStrategy.id), name: String(r.biddingStrategy.name), type: String(r.biddingStrategy.type),
    status: String(r.biddingStrategy.status), campaignCount: num(r.biddingStrategy.campaignCount),
    ...withRatios(pm.get(String(r.biddingStrategy.id)) ?? zero()),
  }))

  const standardMap = new Map<string, { campaignCount: number; metrics: Metrics }>()
  for (const c of campaigns) {
    if (c.portfolioStrategy) continue
    const cur = standardMap.get(c.bidding) ?? { campaignCount: 0, metrics: zero() }
    cur.campaignCount++
    cur.metrics = add(cur.metrics, c)
    standardMap.set(c.bidding, cur)
  }
  const standard = [...standardMap.entries()].map(([type, v]) => ({
    kind: 'standard' as const, id: `standard-${type}`, name: 'Campaign-level (standard)', type, status: 'ENABLED',
    campaignCount: v.campaignCount, ...withRatios(v.metrics),
  }))
  return [...portfolio, ...standard]
}
