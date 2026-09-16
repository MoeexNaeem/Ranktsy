/**
 * Manage existing Search campaigns in a user's connected Google Ads account (Phase 4).
 *
 * Covers the Required Minimum Functionality "Management" items:
 *   - Edit campaign settings (name, daily budget, search partners, countries, languages)
 *   - Edit bidding (Maximize conversions, Target CPA / Target ROAS standard or portfolio, Manual CPC)
 *   - Edit a portfolio strategy's target
 *   - Pause / enable / remove campaigns, ads and keywords
 *
 * Every edit is one atomic GoogleAdsService.Mutate request, and every request can be
 * sent as validateOnly so Google checks it without changing anything.
 */
import { z } from 'zod'
import { adsApiCall } from '@/lib/google-ads'
import { gaqlSearch } from '@/lib/google-ads-user'
import { biddingSchema, biddingProblems, buildBidding } from '@/lib/google-ads-create'
import { AD_COUNTRY_IDS, AD_LANGUAGE_IDS, toMicros } from '@/lib/google-ads-constants'
import type { IGoogleAdsAccountRef } from '@/lib/models'

type Acc = Pick<IGoogleAdsAccountRef, 'customerId' | 'loginCustomerId'>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Op = Record<string, any>

const digits = (s: string) => s.replace(/\D/g, '')
const micros = (v?: string | number | null) => (v == null ? null : Number(v) / 1_000_000)
const idRx = /^\d+$/

async function mutate(token: string, a: Acc, operations: Op[], validateOnly: boolean) {
  return adsApiCall<{ mutateOperationResponses?: Op[] }>({
    token,
    path: `customers/${digits(a.customerId)}/googleAds:mutate`,
    body: { mutateOperations: operations, partialFailure: false, validateOnly },
    loginCustomerId: a.loginCustomerId,
  })
}

// ─── Status: pause / enable / remove ──────────────────────────────────────────
export const statusSchema = z.object({
  validateOnly: z.boolean().optional().default(false),
  kind: z.enum(['campaign', 'ad', 'keyword']),
  status: z.enum(['ENABLED', 'PAUSED', 'REMOVED']),
  items: z.array(z.object({
    campaignId: z.string().regex(idRx).optional(),
    adGroupId: z.string().regex(idRx).optional(),
    adId: z.string().regex(idRx).optional(),
    criterionId: z.string().regex(idRx).optional(),
  })).min(1).max(200),
}).superRefine((v, ctx) => {
  for (const it of v.items) {
    if (v.kind === 'campaign' && !it.campaignId) ctx.addIssue({ code: 'custom', message: 'Missing campaign id.' })
    if (v.kind === 'ad' && !(it.adGroupId && it.adId)) ctx.addIssue({ code: 'custom', message: 'Missing ad id.' })
    if (v.kind === 'keyword' && !(it.adGroupId && it.criterionId)) ctx.addIssue({ code: 'custom', message: 'Missing keyword id.' })
  }
})
export type StatusInput = z.infer<typeof statusSchema>

export async function setStatus(token: string, a: Acc, input: StatusInput) {
  const cid = digits(a.customerId)
  const ops: Op[] = input.items.map(it => {
    const [opName, rn] =
      input.kind === 'campaign' ? ['campaignOperation', `customers/${cid}/campaigns/${it.campaignId}`]
      : input.kind === 'ad' ? ['adGroupAdOperation', `customers/${cid}/adGroupAds/${it.adGroupId}~${it.adId}`]
      : ['adGroupCriterionOperation', `customers/${cid}/adGroupCriteria/${it.adGroupId}~${it.criterionId}`]
    // "Removed" is a remove operation (permanent); pause/enable is a status update.
    return input.status === 'REMOVED'
      ? { [opName]: { remove: rn } }
      : { [opName]: { update: { resourceName: rn, status: input.status }, updateMask: 'status' } }
  })
  await mutate(token, a, ops, input.validateOnly)
  return { updated: ops.length, validateOnly: input.validateOnly }
}

// ─── Campaign settings (read) ─────────────────────────────────────────────────
export interface CampaignSettings {
  id: string
  name: string
  status: string
  dailyBudget: number | null
  budgetResourceName: string | null
  budgetShared: boolean
  searchPartners: boolean
  biddingType: string
  portfolioStrategyId: string | null
  portfolioStrategyName: string | null
  targetCpa: number | null
  targetRoasPercent: number | null
  maxCpc: number | null
  countryIds: string[]
  languageIds: string[]
  adGroupIds: string[]
}

export async function getCampaignSettings(token: string, a: Acc, campaignId: string): Promise<CampaignSettings | null> {
  if (!idRx.test(campaignId)) return null
  const [rows, criteria, adGroups] = await Promise.all([
    gaqlSearch(token, a.customerId, a.loginCustomerId, `
      SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type, campaign.bidding_strategy,
             campaign.network_settings.target_search_network,
             campaign.maximize_conversions.target_cpa_micros, campaign.maximize_conversion_value.target_roas,
             campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared,
             bidding_strategy.name, bidding_strategy.type, bidding_strategy.target_cpa.target_cpa_micros, bidding_strategy.target_roas.target_roas
      FROM campaign WHERE campaign.id = ${campaignId} AND campaign.status != 'REMOVED' LIMIT 1`),
    gaqlSearch(token, a.customerId, a.loginCustomerId, `
      SELECT campaign_criterion.criterion_id, campaign_criterion.type, campaign_criterion.negative,
             campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant
      FROM campaign_criterion WHERE campaign.id = ${campaignId} AND campaign_criterion.type IN ('LOCATION', 'LANGUAGE')`),
    gaqlSearch(token, a.customerId, a.loginCustomerId, `
      SELECT ad_group.id, ad_group.cpc_bid_micros FROM ad_group WHERE campaign.id = ${campaignId} AND ad_group.status != 'REMOVED'`),
  ])
  const r = rows[0]
  if (!r) return null
  const portfolio = r.campaign.biddingStrategy ? String(r.campaign.biddingStrategy) : null
  const type = portfolio ? String(r.biddingStrategy?.type ?? r.campaign.biddingStrategyType) : String(r.campaign.biddingStrategyType)
  const targetCpa = portfolio ? micros(r.biddingStrategy?.targetCpa?.targetCpaMicros) : micros(r.campaign.maximizeConversions?.targetCpaMicros)
  const roas = portfolio ? r.biddingStrategy?.targetRoas?.targetRoas : r.campaign.maximizeConversionValue?.targetRoas
  return {
    id: String(r.campaign.id),
    name: String(r.campaign.name),
    status: String(r.campaign.status),
    dailyBudget: micros(r.campaignBudget?.amountMicros),
    budgetResourceName: r.campaignBudget?.resourceName ?? null,
    budgetShared: !!r.campaignBudget?.explicitlyShared,
    searchPartners: !!r.campaign.networkSettings?.targetSearchNetwork,
    biddingType: type,
    portfolioStrategyId: portfolio ? portfolio.split('/').pop() ?? null : null,
    portfolioStrategyName: portfolio ? String(r.biddingStrategy?.name ?? '') : null,
    targetCpa,
    targetRoasPercent: roas != null ? Math.round(Number(roas) * 100) : null,
    maxCpc: micros(adGroups.find(g => g.adGroup?.cpcBidMicros)?.adGroup?.cpcBidMicros),
    countryIds: criteria.filter(c => c.campaignCriterion.type === 'LOCATION' && !c.campaignCriterion.negative).map(c => String(c.campaignCriterion.criterionId)),
    languageIds: criteria.filter(c => c.campaignCriterion.type === 'LANGUAGE').map(c => String(c.campaignCriterion.criterionId)),
    adGroupIds: adGroups.map(g => String(g.adGroup.id)),
  }
}

// ─── Campaign settings (edit) ─────────────────────────────────────────────────
export const updateCampaignSchema = z.object({
  validateOnly: z.boolean().optional().default(false),
  name: z.string().trim().min(1, 'Campaign name is required.').max(255).optional(),
  dailyBudget: z.number().positive('Daily budget must be more than 0.').max(1_000_000).optional(),
  searchPartners: z.boolean().optional(),
  countryIds: z.array(z.string()).min(1, 'Choose at least one country.').max(50).refine(ids => ids.every(id => AD_COUNTRY_IDS.has(id)), 'Unknown country.').optional(),
  languageIds: z.array(z.string()).max(20).refine(ids => ids.every(id => AD_LANGUAGE_IDS.has(id)), 'Unknown language.').optional(),
  bidding: biddingSchema.optional(),
}).superRefine((v, ctx) => {
  if (v.bidding) for (const p of biddingProblems(v.bidding)) ctx.addIssue({ code: 'custom', ...p })
})
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>

export async function updateCampaign(token: string, a: Acc, campaignId: string, input: UpdateCampaignInput) {
  const current = await getCampaignSettings(token, a, campaignId)
  if (!current) throw new Error('Campaign not found.')
  const cid = digits(a.customerId)
  const campaignRn = `customers/${cid}/campaigns/${campaignId}`
  const ops: Op[] = []
  const changed: string[] = []

  // Bidding may add a portfolio strategy first (temporary id), so it goes before the campaign update.
  const campaignFields: Op = {}
  const masks: string[] = []
  if (input.name && input.name !== current.name) { campaignFields.name = input.name; masks.push('name'); changed.push('name') }
  if (input.searchPartners != null && input.searchPartners !== current.searchPartners) {
    campaignFields.networkSettings = { targetSearchNetwork: input.searchPartners }
    masks.push('networkSettings.targetSearchNetwork'); changed.push('networks')
  }
  if (input.bidding) {
    const bid = buildBidding(cid, input.bidding, input.name ?? current.name, `customers/${cid}/biddingStrategies/-1`)
    ops.push(...bid.preOps)
    Object.assign(campaignFields, bid.fields)
    masks.push(bid.mask)
    changed.push('bidding')
    // Manual CPC bids live on the ad groups.
    if (input.bidding.type === 'MANUAL_CPC' && input.bidding.maxCpc) {
      for (const agId of current.adGroupIds) {
        ops.push({ adGroupOperation: { update: { resourceName: `customers/${cid}/adGroups/${agId}`, cpcBidMicros: String(toMicros(input.bidding.maxCpc)) }, updateMask: 'cpcBidMicros' } })
      }
    }
  }
  if (masks.length) ops.push({ campaignOperation: { update: { resourceName: campaignRn, ...campaignFields }, updateMask: masks.join(',') } })

  if (input.dailyBudget != null && current.budgetResourceName && toMicros(input.dailyBudget) !== toMicros(current.dailyBudget ?? 0)) {
    ops.push({ campaignBudgetOperation: { update: { resourceName: current.budgetResourceName, amountMicros: String(toMicros(input.dailyBudget)) }, updateMask: 'amountMicros' } })
    changed.push(current.budgetShared ? 'shared budget' : 'budget')
  }

  // Targeting: remove what's no longer wanted, add what's new.
  const diff = (want: string[] | undefined, have: string[], kind: 'location' | 'language') => {
    if (!want) return
    for (const id of have) if (!want.includes(id)) ops.push({ campaignCriterionOperation: { remove: `customers/${cid}/campaignCriteria/${campaignId}~${id}` } })
    for (const id of want) if (!have.includes(id)) {
      ops.push({ campaignCriterionOperation: { create: kind === 'location'
        ? { campaign: campaignRn, location: { geoTargetConstant: `geoTargetConstants/${id}` } }
        : { campaign: campaignRn, language: { languageConstant: `languageConstants/${id}` } } } })
    }
    if (want.some(id => !have.includes(id)) || have.some(id => !want.includes(id))) changed.push(kind === 'location' ? 'countries' : 'languages')
  }
  diff(input.countryIds, current.countryIds, 'location')
  diff(input.languageIds, current.languageIds, 'language')

  if (!ops.length) return { changed: [], validateOnly: input.validateOnly }
  await mutate(token, a, ops, input.validateOnly)
  return { changed, validateOnly: input.validateOnly }
}

// ─── Portfolio strategy target (edit) ─────────────────────────────────────────
export const portfolioSchema = z.object({
  validateOnly: z.boolean().optional().default(false),
  type: z.enum(['TARGET_CPA', 'TARGET_ROAS']),
  name: z.string().trim().min(1).max(255).optional(),
  targetCpa: z.number().positive().max(1_000_000).optional(),
  targetRoasPercent: z.number().positive().max(100_000).optional(),
}).superRefine((v, ctx) => {
  if (v.type === 'TARGET_CPA' && !v.targetCpa) ctx.addIssue({ code: 'custom', message: 'Enter a target CPA.' })
  if (v.type === 'TARGET_ROAS' && !v.targetRoasPercent) ctx.addIssue({ code: 'custom', message: 'Enter a target ROAS.' })
})
export type PortfolioInput = z.infer<typeof portfolioSchema>

export async function updatePortfolioStrategy(token: string, a: Acc, strategyId: string, input: PortfolioInput) {
  if (!idRx.test(strategyId)) throw new Error('Unknown strategy.')
  const cid = digits(a.customerId)
  const fields: Op = input.type === 'TARGET_CPA'
    ? { targetCpa: { targetCpaMicros: String(toMicros(input.targetCpa!)) } }
    : { targetRoas: { targetRoas: input.targetRoasPercent! / 100 } }
  const masks = [input.type === 'TARGET_CPA' ? 'targetCpa.targetCpaMicros' : 'targetRoas.targetRoas']
  if (input.name) { fields.name = input.name; masks.push('name') }
  await mutate(token, a, [{ biddingStrategyOperation: { update: { resourceName: `customers/${cid}/biddingStrategies/${strategyId}`, ...fields }, updateMask: masks.join(',') } }], input.validateOnly)
  return { validateOnly: input.validateOnly }
}

// ─── Ad groups, keywords and negative keywords on existing campaigns ──────────
const kwSchema = z.object({
  text: z.string().trim().min(1).max(80).refine(t => t.split(/\s+/).length <= 10, 'A keyword can have at most 10 words.'),
  matchType: z.enum(['BROAD', 'PHRASE', 'EXACT']),
})

export async function listAdGroups(token: string, a: Acc) {
  const rows = await gaqlSearch(token, a.customerId, a.loginCustomerId, `
    SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group.status
    FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED' ORDER BY campaign.name, ad_group.name`)
  return rows.map(r => ({ campaignId: String(r.campaign.id), campaignName: String(r.campaign.name), id: String(r.adGroup.id), name: String(r.adGroup.name), status: String(r.adGroup.status) }))
}

export const addKeywordsSchema = z.object({
  validateOnly: z.boolean().optional().default(false),
  adGroupId: z.string().regex(idRx),
  keywords: z.array(kwSchema).min(1, 'Add at least one keyword.').max(200),
})

export async function addKeywords(token: string, a: Acc, input: z.infer<typeof addKeywordsSchema>) {
  const cid = digits(a.customerId)
  const ops = input.keywords.map(k => ({ adGroupCriterionOperation: { create: { adGroup: `customers/${cid}/adGroups/${input.adGroupId}`, status: 'ENABLED', keyword: { text: k.text, matchType: k.matchType } } } }))
  await mutate(token, a, ops, input.validateOnly)
  return { added: ops.length, validateOnly: input.validateOnly }
}

export async function listNegativeKeywords(token: string, a: Acc, campaignId: string) {
  if (!idRx.test(campaignId)) return []
  const rows = await gaqlSearch(token, a.customerId, a.loginCustomerId, `
    SELECT campaign_criterion.criterion_id, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
    FROM campaign_criterion WHERE campaign.id = ${campaignId} AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE`)
  return rows.map(r => ({ criterionId: String(r.campaignCriterion.criterionId), text: String(r.campaignCriterion.keyword?.text ?? ''), matchType: String(r.campaignCriterion.keyword?.matchType ?? '') }))
}

export const negativesSchema = z.object({
  validateOnly: z.boolean().optional().default(false),
  add: z.array(kwSchema).max(500).optional().default([]),
  removeCriterionIds: z.array(z.string().regex(idRx)).max(500).optional().default([]),
}).refine(v => v.add.length + v.removeCriterionIds.length > 0, 'Nothing to change.')

export async function updateNegativeKeywords(token: string, a: Acc, campaignId: string, input: z.infer<typeof negativesSchema>) {
  if (!idRx.test(campaignId)) throw new Error('Unknown campaign.')
  const cid = digits(a.customerId)
  const ops: Op[] = [
    ...input.removeCriterionIds.map(id => ({ campaignCriterionOperation: { remove: `customers/${cid}/campaignCriteria/${campaignId}~${id}` } })),
    ...input.add.map(k => ({ campaignCriterionOperation: { create: { campaign: `customers/${cid}/campaigns/${campaignId}`, negative: true, keyword: { text: k.text, matchType: k.matchType } } } })),
  ]
  await mutate(token, a, ops, input.validateOnly)
  return { added: input.add.length, removed: input.removeCriterionIds.length, validateOnly: input.validateOnly }
}
