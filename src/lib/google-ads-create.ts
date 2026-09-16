/**
 * Create a complete Search campaign in the user's Google Ads account in ONE atomic
 * GoogleAdsService.Mutate request (Phase 3). Temporary negative resource ids link the
 * pieces, so either everything is created or nothing is:
 *
 *   budget → (optional portfolio bidding strategy) → campaign (PAUSED) → location +
 *   language criteria → campaign negative keywords → ad group → keywords → responsive search ad
 *
 * The campaign is always created PAUSED so nothing spends until the user enables it.
 * `validateOnly` asks Google to check the whole request without creating anything.
 */
import { z } from 'zod'
import { adsApiCall } from '@/lib/google-ads'
import {
  AD_COUNTRY_IDS, AD_LANGUAGE_IDS, RSA, KEYWORD, toMicros,
} from '@/lib/google-ads-constants'

const keywordSchema = z.object({
  text: z.string().trim().min(1).max(KEYWORD.maxChars).refine(t => t.split(/\s+/).length <= KEYWORD.maxWords, `A keyword can have at most ${KEYWORD.maxWords} words.`),
  matchType: z.enum(['BROAD', 'PHRASE', 'EXACT']),
})

export const biddingSchema = z.object({
  type: z.enum(['MAXIMIZE_CONVERSIONS', 'TARGET_CPA', 'TARGET_ROAS', 'MANUAL_CPC']),
  /** Target CPA (account currency) for TARGET_CPA, optional for MAXIMIZE_CONVERSIONS. */
  targetCpa: z.number().positive().max(1_000_000).optional(),
  /** Target ROAS as a percent, e.g. 400 = 400%. */
  targetRoasPercent: z.number().positive().max(100_000).optional(),
  /** Portfolio (shared) strategy for TARGET_CPA / TARGET_ROAS. */
  portfolio: z.enum(['none', 'new', 'existing']).optional().default('none'),
  portfolioName: z.string().trim().max(255).optional(),
  existingStrategyId: z.string().regex(/^\d+$/).optional(),
  /** Default max CPC for MANUAL_CPC. */
  maxCpc: z.number().positive().max(100_000).optional(),
})
export type BiddingInput = z.infer<typeof biddingSchema>

/** Same checks for create and edit: the fields each bidding choice needs. */
export function biddingProblems(b: BiddingInput): { message: string; path: string[] }[] {
  const out: { message: string; path: string[] }[] = []
  if (b.type === 'TARGET_CPA' && b.portfolio !== 'existing' && !b.targetCpa) out.push({ message: 'Enter a target CPA.', path: ['bidding', 'targetCpa'] })
  if (b.type === 'TARGET_ROAS' && b.portfolio !== 'existing' && !b.targetRoasPercent) out.push({ message: 'Enter a target ROAS.', path: ['bidding', 'targetRoasPercent'] })
  if (b.type === 'MANUAL_CPC' && !b.maxCpc) out.push({ message: 'Enter a default max CPC.', path: ['bidding', 'maxCpc'] })
  if ((b.type === 'TARGET_CPA' || b.type === 'TARGET_ROAS') && b.portfolio === 'existing' && !b.existingStrategyId) out.push({ message: 'Choose a portfolio strategy.', path: ['bidding', 'existingStrategyId'] })
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOp = Record<string, any>

/**
 * Bidding for a campaign, shared by create and edit. Portfolio strategies are their
 * own resource (created first with a temporary id); standard ones live on the campaign.
 * Returns the extra operations to run first, the campaign fields, and the update mask
 * that sets them (the bidding fields are a oneof, so setting one replaces the old one).
 */
export function buildBidding(cid: string, b: BiddingInput, campaignName: string, strategyTempRn: string): { preOps: AnyOp[]; fields: AnyOp; mask: string } {
  const portfolio = (b.type === 'TARGET_CPA' || b.type === 'TARGET_ROAS') ? b.portfolio : 'none'
  if (portfolio === 'new') {
    return {
      preOps: [{ biddingStrategyOperation: { create: {
        resourceName: strategyTempRn,
        name: b.portfolioName?.trim() || `${campaignName} ${b.type === 'TARGET_CPA' ? 'Target CPA' : 'Target ROAS'}`,
        ...(b.type === 'TARGET_CPA'
          ? { targetCpa: { targetCpaMicros: String(toMicros(b.targetCpa!)) } }
          : { targetRoas: { targetRoas: b.targetRoasPercent! / 100 } }),
      } } }],
      fields: { biddingStrategy: strategyTempRn },
      mask: 'biddingStrategy',
    }
  }
  if (portfolio === 'existing') return { preOps: [], fields: { biddingStrategy: `customers/${cid}/biddingStrategies/${b.existingStrategyId}` }, mask: 'biddingStrategy' }
  // Standard Target CPA for Search = Maximize conversions with a target CPA.
  if (b.type === 'TARGET_CPA') return { preOps: [], fields: { maximizeConversions: { targetCpaMicros: String(toMicros(b.targetCpa!)) } }, mask: 'maximizeConversions.targetCpaMicros' }
  // Standard Target ROAS for Search = Maximize conversion value with a target ROAS.
  if (b.type === 'TARGET_ROAS') return { preOps: [], fields: { maximizeConversionValue: { targetRoas: b.targetRoasPercent! / 100 } }, mask: 'maximizeConversionValue.targetRoas' }
  if (b.type === 'MANUAL_CPC') return { preOps: [], fields: { manualCpc: { enhancedCpcEnabled: false } }, mask: 'manualCpc.enhancedCpcEnabled' }
  return b.targetCpa
    ? { preOps: [], fields: { maximizeConversions: { targetCpaMicros: String(toMicros(b.targetCpa)) } }, mask: 'maximizeConversions.targetCpaMicros' }
    // No target: set the oneof through its leaf field (0 = no target); Google rejects a mask on the whole message.
    : { preOps: [], fields: { maximizeConversions: { targetCpaMicros: '0' } }, mask: 'maximizeConversions.targetCpaMicros' }
}

export const createCampaignSchema = z.object({
  validateOnly: z.boolean().optional().default(false),
  campaignName: z.string().trim().min(1, 'Campaign name is required.').max(255),
  dailyBudget: z.number().positive('Daily budget must be more than 0.').max(1_000_000),
  bidding: biddingSchema,
  searchPartners: z.boolean().optional().default(false),
  countryIds: z.array(z.string()).min(1, 'Choose at least one country.').max(50).refine(ids => ids.every(id => AD_COUNTRY_IDS.has(id)), 'Unknown country.'),
  /** Empty = all languages. */
  languageIds: z.array(z.string()).max(20).refine(ids => ids.every(id => AD_LANGUAGE_IDS.has(id)), 'Unknown language.'),
  adGroupName: z.string().trim().min(1, 'Ad group name is required.').max(255),
  keywords: z.array(keywordSchema).min(1, 'Add at least one keyword.').max(KEYWORD.maxPerAdGroup),
  negativeKeywords: z.array(keywordSchema).max(500).optional().default([]),
  ad: z.object({
    finalUrl: z.string().trim().url('Enter a full URL, e.g. https://www.etsy.com/shop/YourShop').refine(u => /^https?:\/\//i.test(u), 'The URL must start with http:// or https://'),
    headlines: z.array(z.string().trim().min(1).max(RSA.headlineMax, `Headlines can be at most ${RSA.headlineMax} characters.`))
      .min(RSA.headlinesMin, `Add at least ${RSA.headlinesMin} headlines.`).max(RSA.headlinesMax),
    descriptions: z.array(z.string().trim().min(1).max(RSA.descriptionMax, `Descriptions can be at most ${RSA.descriptionMax} characters.`))
      .min(RSA.descriptionsMin, `Add at least ${RSA.descriptionsMin} descriptions.`).max(RSA.descriptionsMax),
    path1: z.string().trim().max(RSA.pathMax).optional().default(''),
    path2: z.string().trim().max(RSA.pathMax).optional().default(''),
  }),
}).superRefine((v, ctx) => {
  for (const p of biddingProblems(v.bidding)) ctx.addIssue({ code: 'custom', ...p })
  if (new Set(v.ad.headlines.map(h => h.toLowerCase())).size !== v.ad.headlines.length) ctx.addIssue({ code: 'custom', message: 'Headlines must all be different.', path: ['ad', 'headlines'] })
  if (v.ad.path2 && !v.ad.path1) ctx.addIssue({ code: 'custom', message: 'Fill Path 1 before Path 2.', path: ['ad', 'path2'] })
})

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>

export interface CreateCampaignResult {
  validateOnly: boolean
  campaignId: string | null
  campaignResourceName: string | null
}

type Op = AnyOp

export function buildCreateCampaignOperations(customerId: string, input: CreateCampaignInput): Op[] {
  const cid = customerId.replace(/\D/g, '')
  const budgetRn = `customers/${cid}/campaignBudgets/-1`
  const strategyRn = `customers/${cid}/biddingStrategies/-2`
  const campaignRn = `customers/${cid}/campaigns/-3`
  const adGroupRn = `customers/${cid}/adGroups/-4`
  const b = input.bidding
  const ops: Op[] = []

  ops.push({ campaignBudgetOperation: { create: {
    resourceName: budgetRn,
    name: `${input.campaignName} budget ${Date.now()}`,
    amountMicros: String(toMicros(input.dailyBudget)),
    deliveryMethod: 'STANDARD',
    explicitlyShared: false,
  } } })

  const bid = buildBidding(cid, b, input.campaignName, strategyRn)
  ops.push(...bid.preOps)

  ops.push({ campaignOperation: { create: {
    resourceName: campaignRn,
    name: input.campaignName,
    status: 'PAUSED',
    advertisingChannelType: 'SEARCH',
    campaignBudget: budgetRn,
    networkSettings: {
      targetGoogleSearch: true,
      targetSearchNetwork: input.searchPartners,
      targetContentNetwork: false,
      targetPartnerSearchNetwork: false,
    },
    geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE_OR_INTEREST', negativeGeoTargetType: 'PRESENCE' },
    // Required by Google Ads for every new campaign.
    containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    ...bid.fields,
  } } })

  for (const geoId of input.countryIds) {
    ops.push({ campaignCriterionOperation: { create: { campaign: campaignRn, location: { geoTargetConstant: `geoTargetConstants/${geoId}` } } } })
  }
  for (const langId of input.languageIds) {
    ops.push({ campaignCriterionOperation: { create: { campaign: campaignRn, language: { languageConstant: `languageConstants/${langId}` } } } })
  }
  for (const k of input.negativeKeywords) {
    ops.push({ campaignCriterionOperation: { create: { campaign: campaignRn, negative: true, keyword: { text: k.text, matchType: k.matchType } } } })
  }

  ops.push({ adGroupOperation: { create: {
    resourceName: adGroupRn,
    name: input.adGroupName,
    campaign: campaignRn,
    status: 'ENABLED',
    type: 'SEARCH_STANDARD',
    ...(b.type === 'MANUAL_CPC' && b.maxCpc ? { cpcBidMicros: String(toMicros(b.maxCpc)) } : {}),
  } } })

  for (const k of input.keywords) {
    ops.push({ adGroupCriterionOperation: { create: { adGroup: adGroupRn, status: 'ENABLED', keyword: { text: k.text, matchType: k.matchType } } } })
  }

  ops.push({ adGroupAdOperation: { create: {
    adGroup: adGroupRn,
    status: 'ENABLED',
    ad: {
      finalUrls: [input.ad.finalUrl],
      responsiveSearchAd: {
        headlines: input.ad.headlines.map(text => ({ text })),
        descriptions: input.ad.descriptions.map(text => ({ text })),
        ...(input.ad.path1 ? { path1: input.ad.path1 } : {}),
        ...(input.ad.path2 ? { path2: input.ad.path2 } : {}),
      },
    },
  } } })

  return ops
}

export async function createSearchCampaign(
  token: string, customerId: string, loginCustomerId: string | null, input: CreateCampaignInput,
): Promise<CreateCampaignResult> {
  const cid = customerId.replace(/\D/g, '')
  const j = await adsApiCall<{ mutateOperationResponses?: Record<string, { resourceName?: string }>[] }>({
    token,
    path: `customers/${cid}/googleAds:mutate`,
    body: { mutateOperations: buildCreateCampaignOperations(cid, input), partialFailure: false, validateOnly: input.validateOnly },
    loginCustomerId,
  })
  if (input.validateOnly) return { validateOnly: true, campaignId: null, campaignResourceName: null }
  const rn = (j.mutateOperationResponses ?? []).map(r => r.campaignResult?.resourceName).find(Boolean) ?? null
  return { validateOnly: false, campaignResourceName: rn, campaignId: rn ? rn.split('/').pop() ?? null : null }
}
