import { connectDB } from '@/lib/db'
import { ConnectedShop, User } from '@/lib/models'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import { refreshEtsyToken, type EtsyTokenResponse } from '@/lib/etsy-oauth'
import { singleFlight } from '@/lib/concurrency'

/**
 * A user's connected Etsy shop(s) - always read fresh from the ConnectedShop
 * collection, never cached on the session/JWT. That's what makes a connection
 * survive logout and last until the user explicitly disconnects it, and what
 * lets a user connect more than one shop (each a separate row, upserted by
 * (userId, shopId) so connecting shop #2 never disturbs shop #1).
 */

/** One-time migration off the old single-shop User fields, the first time this user's shops are read. Safe to call repeatedly - a no-op once migrated. */
async function migrateLegacyShop(userId: string): Promise<void> {
  const u = await User.findById(userId).select('+etsyAccessToken +etsyRefreshToken etsyTokenExpiry etsyShopId').lean()
  if (!u?.etsyShopId || !u.etsyAccessToken || !u.etsyRefreshToken) return
  await ConnectedShop.findOneAndUpdate(
    { userId, shopId: String(u.etsyShopId) },
    {
      $setOnInsert: {
        userId, shopId: String(u.etsyShopId), shopName: String(u.etsyShopId),
        accessToken: u.etsyAccessToken, refreshToken: u.etsyRefreshToken,
        tokenExpiry: u.etsyTokenExpiry ?? new Date(),
      },
    },
    { upsert: true },
  )
  await User.findByIdAndUpdate(userId, { $unset: { etsyShopId: '', etsyAccessToken: '', etsyRefreshToken: '', etsyTokenExpiry: '' } })
}

/** Persist a fresh token set (encrypted) for one connected shop. Upserts by (userId, shopId) - connecting an additional shop never touches the others. */
export async function saveEtsyTokens(userId: string, tokens: EtsyTokenResponse, shopId: number | string, shopName: string) {
  await connectDB()
  await ConnectedShop.findOneAndUpdate(
    { userId, shopId: String(shopId) },
    {
      $set: {
        shopName,
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: encryptSecret(tokens.refresh_token),
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
    },
    { upsert: true },
  )
}

export interface ConnectedShopInfo { shopId: string; shopName: string; connectedAt: Date }

/** Every shop this user has connected, oldest first. */
export async function listConnectedShops(userId: string): Promise<ConnectedShopInfo[]> {
  await connectDB()
  await migrateLegacyShop(userId)
  const rows = await ConnectedShop.find({ userId }).sort({ createdAt: 1 }).lean()
  return rows.map(r => ({ shopId: r.shopId, shopName: r.shopName, connectedAt: r.createdAt ?? new Date() }))
}

/** Disconnect ONE shop - the others (if any) are untouched. */
export async function clearEtsyTokens(userId: string, shopId: string | number): Promise<void> {
  await connectDB()
  await ConnectedShop.deleteOne({ userId, shopId: String(shopId) })
}

export interface EtsyAuth { accessToken: string; shopId: number }

/**
 * A valid (auto-refreshed) access token + numeric shop id for one of the
 * user's connected shops. Pass `shopId` to target a specific one; omit it to
 * fall back to the first-connected shop (the common single-shop case).
 * Refreshes ~1 minute before expiry and persists the rotated tokens.
 */
export async function getValidEtsyAuth(userId: string, shopId?: string | number): Promise<EtsyAuth | null> {
  await connectDB()
  await migrateLegacyShop(userId)

  const doc = shopId != null
    ? await ConnectedShop.findOne({ userId, shopId: String(shopId) }).select('+accessToken +refreshToken')
    : await ConnectedShop.findOne({ userId }).sort({ createdAt: 1 }).select('+accessToken +refreshToken')
  if (!doc) return null

  const numericShopId = Number(doc.shopId)
  const expiry = doc.tokenExpiry ? new Date(doc.tokenExpiry).getTime() : 0
  const fresh = expiry - Date.now() > 60_000 // >60s of life left

  if (fresh) {
    const access = decryptSecret(doc.accessToken)
    if (access) return { accessToken: access, shopId: numericShopId }
  }

  // Refresh. Etsy ROTATES refresh tokens (each one is single-use - refreshing
  // invalidates it and returns a new one), so two concurrent requests for the
  // same shop must NOT both refresh with the same stored token: the first would
  // succeed and the second would 400 on an already-spent token, intermittently
  // breaking shop features (a dashboard loading several Etsy widgets at once is
  // enough to trigger it). singleFlight collapses concurrent refreshes for the
  // same shop into ONE call whose result every caller shares.
  const refresh = decryptSecret(doc.refreshToken)
  if (!refresh) return null
  try {
    return await singleFlight(`etsy-token:${userId}:${doc.shopId}`, async () => {
      const tokens = await refreshEtsyToken(refresh)
      await saveEtsyTokens(userId, tokens, numericShopId, doc.shopName)
      return { accessToken: tokens.access_token, shopId: numericShopId }
    })
  } catch (e) {
    console.error('[Etsy] token refresh failed:', e)
    return null
  }
}
