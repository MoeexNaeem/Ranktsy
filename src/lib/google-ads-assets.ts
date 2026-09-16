/**
 * Account-level setup for a connected Google Ads account (Phase 5):
 *   - Conversion tracking: create website (WEBPAGE) and call (AD_CALL / WEBSITE_CALL)
 *     conversion actions, read their tag snippets, list and remove them.
 *     Creating one turns on conversion tracking, which is what unlocks Maximize
 *     conversions, Target CPA and Target ROAS bidding.
 *   - Callout extensions (account level): create, list and remove callout assets.
 */
import { z } from 'zod'
import { adsApiCall } from '@/lib/google-ads'
import { gaqlSearch } from '@/lib/google-ads-user'
import type { IGoogleAdsAccountRef } from '@/lib/models'

type Acc = Pick<IGoogleAdsAccountRef, 'customerId' | 'loginCustomerId' | 'currency'>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Op = Record<string, any>
const digits = (s: string) => s.replace(/\D/g, '')

async function mutate(token: string, a: Acc, operations: Op[], validateOnly = false) {
  return adsApiCall<{ mutateOperationResponses?: Op[] }>({
    token, path: `customers/${digits(a.customerId)}/googleAds:mutate`,
    body: { mutateOperations: operations, partialFailure: false, validateOnly }, loginCustomerId: a.loginCustomerId,
  })
}

// ─── Conversion actions ───────────────────────────────────────────────────────
export const CONVERSION_TYPES = ['WEBPAGE', 'AD_CALL', 'WEBSITE_CALL'] as const
export const CONVERSION_CATEGORIES = ['PURCHASE', 'ADD_TO_CART', 'BEGIN_CHECKOUT', 'SIGNUP', 'SUBMIT_LEAD_FORM', 'CONTACT', 'PAGE_VIEW', 'PHONE_CALL_LEAD', 'DEFAULT'] as const

export const createConversionSchema = z.object({
  validateOnly: z.boolean().optional().default(false),
  name: z.string().trim().min(1, 'Name is required.').max(100),
  type: z.enum(CONVERSION_TYPES),
  category: z.enum(CONVERSION_CATEGORIES),
  countingType: z.enum(['ONE_PER_CLICK', 'MANY_PER_CLICK']).default('MANY_PER_CLICK'),
  defaultValue: z.number().min(0).max(1_000_000).optional(),
  alwaysUseDefaultValue: z.boolean().optional().default(false),
  clickThroughDays: z.number().int().min(1).max(90).optional().default(30),
  /** Calls only: minimum call length (seconds) that counts. */
  callDurationSeconds: z.number().int().min(0).max(10_000).optional().default(60),
})
export type CreateConversionInput = z.infer<typeof createConversionSchema>

export interface ConversionActionRow {
  id: string; name: string; status: string; type: string; category: string; countingType: string
  defaultValue: number | null; primaryForGoal: boolean
  snippets: { type: string; pageFormat: string; globalSiteTag: string | null; eventSnippet: string | null }[]
}

export async function listConversionActions(token: string, a: Acc): Promise<ConversionActionRow[]> {
  const rows = await gaqlSearch(token, a.customerId, a.loginCustomerId, `
    SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type,
           conversion_action.category, conversion_action.counting_type, conversion_action.value_settings.default_value,
           conversion_action.primary_for_goal, conversion_action.tag_snippets
    FROM conversion_action WHERE conversion_action.status != 'REMOVED' ORDER BY conversion_action.name`)
  return rows.map(r => {
    const c = r.conversionAction
    return {
      id: String(c.id), name: String(c.name), status: String(c.status), type: String(c.type), category: String(c.category),
      countingType: String(c.countingType ?? ''), defaultValue: c.valueSettings?.defaultValue != null ? Number(c.valueSettings.defaultValue) : null,
      primaryForGoal: !!c.primaryForGoal,
      snippets: (c.tagSnippets ?? []).map((t: Op) => ({ type: String(t.type), pageFormat: String(t.pageFormat), globalSiteTag: t.globalSiteTag ?? null, eventSnippet: t.eventSnippet ?? null })),
    }
  })
}

export async function createConversionAction(token: string, a: Acc, input: CreateConversionInput) {
  const isCall = input.type !== 'WEBPAGE'
  const action: Op = {
    name: input.name,
    type: input.type,
    category: isCall ? 'PHONE_CALL_LEAD' : input.category,
    status: 'ENABLED',
    countingType: input.countingType,
    clickThroughLookbackWindowDays: String(input.clickThroughDays),
    valueSettings: {
      defaultValue: input.defaultValue ?? 1,
      // Calls have no per-conversion value, so Google requires the default value.
      alwaysUseDefaultValue: isCall ? true : input.alwaysUseDefaultValue,
      ...(a.currency ? { defaultCurrencyCode: a.currency } : {}),
    },
    ...(isCall ? { phoneCallDurationSeconds: String(input.callDurationSeconds) } : {}),
  }
  const j = await mutate(token, a, [{ conversionActionOperation: { create: action } }], input.validateOnly)
  const rn: string | null = j.mutateOperationResponses?.[0]?.conversionActionResult?.resourceName ?? null
  return { validateOnly: input.validateOnly, id: rn ? rn.split('/').pop() ?? null : null }
}

export async function removeConversionAction(token: string, a: Acc, id: string, validateOnly = false) {
  if (!/^\d+$/.test(id)) throw new Error('Unknown conversion action.')
  await mutate(token, a, [{ conversionActionOperation: { remove: `customers/${digits(a.customerId)}/conversionActions/${id}` } }], validateOnly)
  return { validateOnly }
}

// ─── Callouts (account level) ─────────────────────────────────────────────────
export const CALLOUT_MAX = 25

export const createCalloutsSchema = z.object({
  validateOnly: z.boolean().optional().default(false),
  texts: z.array(z.string().trim().min(1).max(CALLOUT_MAX, `Callouts can be at most ${CALLOUT_MAX} characters.`)).min(1, 'Add at least one callout.').max(20),
})

export interface CalloutRow { assetId: string; text: string; status: string }

export async function listCallouts(token: string, a: Acc): Promise<CalloutRow[]> {
  const rows = await gaqlSearch(token, a.customerId, a.loginCustomerId, `
    SELECT customer_asset.status, asset.id, asset.callout_asset.callout_text
    FROM customer_asset WHERE customer_asset.field_type = 'CALLOUT' AND customer_asset.status != 'REMOVED'`)
  return rows.map(r => ({ assetId: String(r.asset.id), text: String(r.asset.calloutAsset?.calloutText ?? ''), status: String(r.customerAsset.status) }))
}

export async function createCallouts(token: string, a: Acc, input: z.infer<typeof createCalloutsSchema>) {
  const cid = digits(a.customerId)
  const unique = [...new Map(input.texts.map(t => [t.toLowerCase(), t])).values()]
  const ops: Op[] = []
  unique.forEach((text, i) => {
    const assetRn = `customers/${cid}/assets/-${i + 1}`
    ops.push({ assetOperation: { create: { resourceName: assetRn, calloutAsset: { calloutText: text } } } })
    ops.push({ customerAssetOperation: { create: { asset: assetRn, fieldType: 'CALLOUT' } } })
  })
  await mutate(token, a, ops, input.validateOnly)
  return { created: unique.length, validateOnly: input.validateOnly }
}

export async function removeCallout(token: string, a: Acc, assetId: string, validateOnly = false) {
  if (!/^\d+$/.test(assetId)) throw new Error('Unknown callout.')
  await mutate(token, a, [{ customerAssetOperation: { remove: `customers/${digits(a.customerId)}/customerAssets/${assetId}~CALLOUT` } }], validateOnly)
  return { validateOnly }
}
