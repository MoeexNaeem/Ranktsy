import { connectDB } from '@/lib/db'
import { User } from '@/lib/models'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { refreshEtsyToken, type EtsyTokenResponse } from '@/lib/etsy-oauth'

/** Persist a fresh token set (encrypted) + shop id on the user. */
export async function saveEtsyTokens(userId: string, tokens: EtsyTokenResponse, shopId: number | string) {
  await connectDB()
  await User.findByIdAndUpdate(userId, {
    etsyShopId:       String(shopId),
    etsyAccessToken:  encryptSecret(tokens.access_token),
    etsyRefreshToken: encryptSecret(tokens.refresh_token),
    etsyTokenExpiry:  new Date(Date.now() + tokens.expires_in * 1000),
  })
}

export async function clearEtsyTokens(userId: string) {
  await connectDB()
  await User.findByIdAndUpdate(userId, {
    $unset: { etsyShopId: '', etsyAccessToken: '', etsyRefreshToken: '', etsyTokenExpiry: '' },
  })
}

export interface EtsyAuth { accessToken: string; shopId: number }

/**
 * Returns a valid (auto-refreshed) access token + numeric shop id for the user,
 * or null if the shop isn't connected. Refreshes ~1 minute before expiry and
 * persists the rotated tokens.
 */
export async function getValidEtsyAuth(userId: string): Promise<EtsyAuth | null> {
  await connectDB()
  const u = await User.findById(userId)
    .select('+etsyAccessToken +etsyRefreshToken etsyTokenExpiry etsyShopId')
    .lean()
  if (!u?.etsyAccessToken || !u.etsyShopId) return null

  const shopId = Number(u.etsyShopId)
  const expiry = u.etsyTokenExpiry ? new Date(u.etsyTokenExpiry).getTime() : 0
  const fresh = expiry - Date.now() > 60_000 // >60s of life left

  if (fresh) {
    const access = decryptSecret(u.etsyAccessToken)
    if (access) return { accessToken: access, shopId }
  }

  // Refresh
  const refresh = decryptSecret(u.etsyRefreshToken)
  if (!refresh) return null
  try {
    const tokens = await refreshEtsyToken(refresh)
    await saveEtsyTokens(userId, tokens, shopId)
    return { accessToken: tokens.access_token, shopId }
  } catch (e) {
    console.error('[Etsy] token refresh failed:', e)
    return null
  }
}
