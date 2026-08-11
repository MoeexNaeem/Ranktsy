import { connectDB } from '@/lib/db'
import { User, AppSetting } from '@/lib/models'

/** "Free → Pro" promo: a simple admin toggle that turns every free user into Pro. */
export const PROMO_KEY = 'free_to_pro'

/** Whether the toggle is currently on. */
export async function isFreeToProPromoOn(): Promise<boolean> {
  await connectDB()
  const s = await AppSetting.findOne({ key: PROMO_KEY }).lean<{ bool?: boolean }>().catch(() => null)
  return !!s?.bool
}

/** Convert every free user to Pro. Returns how many were changed. */
export async function convertFreeToPro(): Promise<number> {
  await connectDB()
  const r = await User.updateMany({ plan: 'free' }, { $set: { plan: 'pro' } })
  return r.modifiedCount ?? 0
}

/** Set the toggle. Turning it on converts all free users to Pro; off just records the state. */
export async function setFreeToProPromo(enabled: boolean): Promise<{ enabled: boolean; affected: number }> {
  await connectDB()
  const affected = enabled ? await convertFreeToPro() : 0
  await AppSetting.updateOne({ key: PROMO_KEY }, { $set: { bool: enabled } }, { upsert: true })
  return { enabled, affected }
}
