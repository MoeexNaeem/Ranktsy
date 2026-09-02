import mongoose, { Schema, model, models, type Document } from 'mongoose'
import { SNAPSHOT_RETENTION_DAYS } from '@/utils'
import { PLAN_SLUGS, type PlanSlug } from '@/lib/plans'
import type {
  IKeywordCache, IKeywordHistory, IOTP,
  IShopSnapshot, IListingSnapshot, ITrackedShop, ITrackedListing, IConnectedShop,
  ICollectiveKeywordData, IApiUsage, IBlog, IDeal, IPopupAd,
} from '@/types'

// ─── User ─────────────────────────────────────────────────────────────────────
export interface IUserDoc extends Document {
  name: string
  email: string
  password?: string                       // optional: OAuth (Google/Microsoft) users have none
  authProvider?: 'google' | 'microsoft'   // set when the account was created/linked via OAuth
  role: 'user' | 'admin'
  plan: PlanSlug
  isVerified: boolean
  // Lemon Squeezy subscription (set by the webhook)
  lsSubscriptionId?: string
  lsCustomerId?: string
  lsVariantId?: string
  subscriptionStatus?: string   // active | on_trial | past_due | cancelled | paused | expired
  planRenewsAt?: Date
  // Expiry for an ADMIN-GRANTED (comp) plan - a plan set by an admin (the
  // Free→Pro promo or the admin plan dropdown) WITHOUT a real Lemon Squeezy
  // purchase. On/after this date the user auto-reverts to 'free'. Null for
  // real paid subscriptions (those expire via the webhook + planRenewsAt).
  compExpiresAt?: Date | null
  // Admin-set: blocks dashboard access with an explanatory screen. Checked
  // fresh from the DB on dashboard load (never baked into the JWT) so it
  // takes effect immediately, not after the access token expires.
  restricted?: boolean
  // DEPRECATED - superseded by the ConnectedShop collection (a user can now
  // connect more than one shop). Kept only so lib/etsy-tokens.ts can migrate
  // any pre-existing single-shop connection the first time it's read.
  etsyShopId?: string
  etsyAccessToken?: string
  etsyRefreshToken?: string
  etsyTokenExpiry?: Date
  savedKeywords: string[]
  searchCount: number
  lastSearchReset: Date
  listingImageCount?: number   // Etsy Listing Pro images used this month
  listingImageReset?: Date
  // Credit system - powers the "other tools" (no hard limit) at 10 credits/use.
  // Daily allowance comes from the plan (see lib/credits.ts); balance = limit −
  // creditsUsedToday. Resets on a UTC day rollover. creditsUsedTotal is lifetime
  // spend, kept for the admin analytics.
  creditsUsedToday?: number
  creditsResetAt?: Date
  creditsUsedTotal?: number
  // Affiliate attribution - set once at signup if the visitor arrived through an
  // affiliate's ?ref link. `referredBy` is the affiliate code; the id is kept too
  // for integrity. Never changes after signup (first-touch at registration).
  referredBy?: string | null
  referredByAffiliateId?: string | null
}

const UserSchema = new Schema<IUserDoc>({
  name:             { type: String, required: true, trim: true, maxlength: 60 },
  email:            { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password:         { type: String, required: false, select: false }, // optional - OAuth users have none; never returned by default
  authProvider:     { type: String, enum: ['google','microsoft'] },
  role:             { type: String, enum: ['user','admin'], default: 'user' },
  plan:             { type: String, enum: PLAN_SLUGS, default: 'free' },
  isVerified:       { type: Boolean, default: false },
  lsSubscriptionId:  { type: String },
  lsCustomerId:      { type: String },
  lsVariantId:       { type: String },
  subscriptionStatus:{ type: String },
  planRenewsAt:      { type: Date },
  compExpiresAt:     { type: Date, default: null },
  restricted:        { type: Boolean, default: false },
  etsyShopId:       { type: String },
  etsyAccessToken:  { type: String, select: false },
  etsyRefreshToken: { type: String, select: false },
  etsyTokenExpiry:  { type: Date },
  savedKeywords:    { type: [String], default: [] },
  searchCount:      { type: Number, default: 0 },
  lastSearchReset:  { type: Date, default: Date.now },
  listingImageCount:{ type: Number, default: 0 },
  listingImageReset:{ type: Date, default: Date.now },
  creditsUsedToday: { type: Number, default: 0 },
  creditsResetAt:   { type: Date, default: Date.now },
  creditsUsedTotal: { type: Number, default: 0 },
  referredBy:            { type: String, default: null, index: true },
  referredByAffiliateId: { type: String, default: null },
}, { timestamps: true })

// ─── OTP ──────────────────────────────────────────────────────────────────────
const OTPSchema = new Schema<IOTP>({
  email:     { type: String, required: true, lowercase: true, index: true },
  code:      { type: String, required: true },
  type:      { type: String, enum: ['reset','verify'], required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }, // MongoDB TTL auto-delete
}, { timestamps: true })

OTPSchema.index({ email: 1, type: 1 })

// ─── Keyword Cache ─────────────────────────────────────────────────────────────
const KeywordCacheSchema = new Schema<IKeywordCache>({
  keyword:   { type: String, required: true, index: true, lowercase: true, trim: true },
  // Country filter - Google volume/CPC/competition are geo-specific, so each
  // country caches its own document for the same keyword. Defaults to US.
  geo:       { type: String, default: 'US', uppercase: true, trim: true },
  data:      { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true })

KeywordCacheSchema.index({ keyword: 1, geo: 1, createdAt: -1 })

// ─── Collective Keyword Data (shared, READ-ONLY here) ──────────────────────────
// Written by Ranktsy's Bulk Keyword Search (permanent, no TTL). Rankkw only reads
// it. Schema mirrors Ranktsy's so the shared collection's indexes never conflict;
// NO TTL is declared (the collection is permanent).
const CollectiveKeywordDataSchema = new Schema<ICollectiveKeywordData>({
  keyword:         { type: String, required: true, lowercase: true, trim: true },
  geo:             { type: String, default: 'US', uppercase: true, trim: true },
  data:            { type: Schema.Types.Mixed, required: true },
  searchedAt:      { type: Date, default: Date.now },
  lastRefreshedAt: { type: Date, default: Date.now },
}, { timestamps: true })
CollectiveKeywordDataSchema.index({ keyword: 1, geo: 1 }, { unique: true })

// ─── API Usage (per user, per UTC day) ─────────────────────────────────────────
// One row per {day, userId}. Powers the admin usage analytics. `day` is the daily
// bucket (resets at 00:00 UTC); rows are kept ~60 days so every user has ≥7 days
// of history. Incremented via lib/usage.ts ($inc, coalesced). Uses its OWN
// collection `userapiusages` - NOT the `apiusages` that Ranktsy's simple daily
// tracker writes (their {day}-unique schema is incompatible with this per-user one).
const ApiUsageSchema = new Schema<IApiUsage>({
  day:        { type: String, required: true },      // YYYY-MM-DD (UTC)
  userId:     { type: String, required: true },      // user id or 'anonymous'
  userEmail:  { type: String },
  etsyCalls:  { type: Number, default: 0 },
  googleCalls:{ type: Number, default: 0 },
  searches:   { type: Number, default: 0 },
  cacheHits:  { type: Number, default: 0 },
  apiHits:    { type: Number, default: 0 },
  // Gemini image generation - count, total tokens burnt, and USD spent.
  imageCalls:   { type: Number, default: 0 },
  imageTokens:  { type: Number, default: 0 },
  imageCostUsd: { type: Number, default: 0 },
  // Credits spent today by this user on credit-metered tools (10 per use).
  creditsSpent: { type: Number, default: 0 },
}, { timestamps: true })
ApiUsageSchema.index({ day: 1, userId: 1 }, { unique: true })
ApiUsageSchema.index({ userId: 1, day: -1 })
// Keep ~60 days so the admin's 7-day history is always available, without unbounded growth.
ApiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 })

// ─── Search History ────────────────────────────────────────────────────────────
const KeywordHistorySchema = new Schema<IKeywordHistory>({
  keyword:    { type: String, required: true, lowercase: true, trim: true },
  searchedAt: { type: Date, default: Date.now },
  userId:     { type: String, index: true },
}, { timestamps: false })

KeywordHistorySchema.index({ userId: 1, searchedAt: -1 })

/**
 * Retention for snapshot history: ~13 months.
 *
 * Long enough to show a full year of seasonality plus a like-for-like comparison
 * against the same month last year; short enough to be a real, enforced limit
 * rather than "we keep Etsy data forever". Etsy's caching rule (6h listings /
 * 24h other) governs re-displaying their content AS CURRENT - which we never do:
 * every current figure is fetched live, and a snapshot is only ever rendered as a
 * dated historical measurement. This bound keeps that distinction honest.
 */
const SNAPSHOT_TTL_SECONDS = SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60

// ─── Shop Snapshot ─────────────────────────────────────────────────────────────
// One row per shop per UTC day. This is the ONLY source of sales history - Etsy
// gives a lifetime total with no series and no backfill, so a day not captured
// is a day lost forever. Not TTL'd on a short window (that would defeat the
// point) but genuinely capped at SNAPSHOT_RETENTION_DAYS via the index below.
const ShopSnapshotSchema = new Schema<IShopSnapshot>({
  shopId:         { type: Number, required: true, index: true },
  shopName:       { type: String, required: true, trim: true },
  day:            { type: String, required: true },   // YYYY-MM-DD (UTC)
  sales:          { type: Number, default: null },
  favorers:       { type: Number, default: null },
  reviewCount:    { type: Number, default: null },
  reviewAverage:  { type: Number, default: null },
  activeListings: { type: Number, default: null },
  isVacation:     { type: Boolean, default: false },
  capturedAt:     { type: Date, default: Date.now },
}, { timestamps: false })

// Unique per shop per day - makes capture idempotent, so recording opportunistically
// on every shop read can't produce duplicate rows.
ShopSnapshotSchema.index({ shopId: 1, day: 1 }, { unique: true })
ShopSnapshotSchema.index({ shopId: 1, capturedAt: -1 })
// Enforces the retention bound in the database rather than in a comment.
ShopSnapshotSchema.index({ capturedAt: 1 }, { expireAfterSeconds: SNAPSHOT_TTL_SECONDS })

// ─── Listing Snapshot ──────────────────────────────────────────────────────────
// Powers "Changes" - what a competitor edited (title/tags/price), which Etsy's
// last_modified_timestamp flags but never describes.
const ListingSnapshotSchema = new Schema<IListingSnapshot>({
  listingId:  { type: Number, required: true, index: true },
  shopId:     { type: Number, required: true, index: true },
  day:        { type: String, required: true },
  title:      { type: String, default: '' },
  tags:       { type: [String], default: [] },
  price:      { type: Number, default: 0 },
  currency:   { type: String, default: 'USD' },
  views:      { type: Number, default: 0 },
  favorers:   { type: Number, default: 0 },
  reviewCount:{ type: Number, default: null },
  capturedAt: { type: Date, default: Date.now },
}, { timestamps: false })

ListingSnapshotSchema.index({ listingId: 1, day: 1 }, { unique: true })
// Same enforced retention bound as ShopSnapshot. This one holds actual Etsy
// listing CONTENT (title/tags/price), so capping it matters more, not less.
ListingSnapshotSchema.index({ capturedAt: 1 }, { expireAfterSeconds: SNAPSHOT_TTL_SECONDS })
ListingSnapshotSchema.index({ listingId: 1, capturedAt: -1 })

// ─── Tracked Shop ──────────────────────────────────────────────────────────────
// Shops a user has starred for guaranteed daily capture by the cron route.
const TrackedShopSchema = new Schema<ITrackedShop>({
  userId:   { type: String, required: true, index: true },
  shopId:   { type: Number, required: true },
  shopName: { type: String, required: true, trim: true },
}, { timestamps: true })

TrackedShopSchema.index({ userId: 1, shopId: 1 }, { unique: true })

// Listings the crowd has observed (via the extension) - one global row per
// listing, upserted on every observation. The daily cron refreshes the hottest
// of these so their per-listing history stays unbroken. `lastSeenAt` has a TTL so
// listings no one has looked at in a long time fall out of the watchlist.
const TrackedListingSchema = new Schema<ITrackedListing>({
  listingId:    { type: Number, required: true, unique: true },
  shopId:       { type: Number, required: true },
  title:        { type: String, default: '' },
  observeCount: { type: Number, default: 0 },
  lastSeenAt:   { type: Date, default: Date.now },
}, { timestamps: true })

TrackedListingSchema.index({ lastSeenAt: -1 })

// ─── Connected Shop ────────────────────────────────────────────────────────────
// A user's OWN Etsy shop(s), connected via OAuth. One row per (userId, shopId) -
// a user can connect several shops; connecting a new one never disturbs another.
// Always read fresh from here, never cached on the session/JWT, so a connection
// persists across logout and only ever goes away when the user removes it.
const ConnectedShopSchema = new Schema<IConnectedShop>({
  userId:       { type: String, required: true, index: true },
  shopId:       { type: String, required: true },
  shopName:     { type: String, required: true, trim: true },
  accessToken:  { type: String, required: true, select: false },
  refreshToken: { type: String, required: true, select: false },
  tokenExpiry:  { type: Date, required: true },
}, { timestamps: true })

ConnectedShopSchema.index({ userId: 1, shopId: 1 }, { unique: true })

// ─── App Setting ─────────────────────────────────────────────────────────────
// Tiny key/value store for global admin switches (e.g. the Free→Pro promo).
interface IAppSetting { key: string; bool?: boolean }
const AppSettingSchema = new Schema<IAppSetting>({
  key:  { type: String, required: true, unique: true, index: true },
  bool: { type: Boolean, default: false },
}, { timestamps: true })

// ─── Blog ──────────────────────────────────────────────────────────────────────
const BlogSchema = new Schema<IBlog>({
  title:          { type: String, required: true, trim: true, maxlength: 200 },
  slug:           { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  excerpt:        { type: String, trim: true, maxlength: 400 },
  coverImage:     { type: String, trim: true },
  category:       { type: String, trim: true, default: 'General' },
  tags:           { type: [String], default: [] },
  content:        { type: String, default: '' },          // Markdown
  status:         { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  author:         { type: String, trim: true, default: 'Rankkw' },
  seoTitle:       { type: String, trim: true },
  seoDescription: { type: String, trim: true },
  readingMinutes: { type: Number, default: 1 },
  publishedAt:    { type: Date, default: null },
}, { timestamps: true })
BlogSchema.index({ status: 1, publishedAt: -1 })

// ─── Deal ──────────────────────────────────────────────────────────────────────
const DealSchema = new Schema<IDeal>({
  title:    { type: String, required: true, trim: true, maxlength: 200 },
  slug:     { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  summary:  { type: String, trim: true, maxlength: 400 },
  content:  { type: String, default: '' },          // Markdown
  badge:    { type: String, trim: true, maxlength: 40 },
  ctaLabel: { type: String, trim: true, default: 'Get this deal' },
  ctaPlan:  { type: String, trim: true },           // plan slug for LS checkout
  ctaUrl:   { type: String, trim: true },           // direct URL fallback
  status:   { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  seedKey:  { type: String, trim: true, index: true },
}, { timestamps: true })
DealSchema.index({ status: 1, createdAt: -1 })

// ─── Popup Ad ──────────────────────────────────────────────────────────────────
const PopupAdSchema = new Schema<IPopupAd>({
  enabled:     { type: Boolean, default: false, index: true },
  mode:        { type: String, enum: ['card', 'image'], default: 'card' },
  badge:       { type: String, trim: true, maxlength: 40 },
  title:       { type: String, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 400 },
  price:       { type: String, trim: true, maxlength: 24 },
  priceNote:   { type: String, trim: true, maxlength: 60 },
  ctaLabel:    { type: String, trim: true, default: 'Learn more' },
  ctaUrl:      { type: String, trim: true },
  imageUrl:    { type: String, trim: true },
  imageLink:   { type: String, trim: true },
  seedKey:     { type: String, trim: true, index: true },
}, { timestamps: true })
PopupAdSchema.index({ enabled: 1, updatedAt: -1 })

// ─── Automation: "Automate Etsy Shop" (HIDDEN, admin-only for now) ───────────────
// A batch that generates N SEO listings from real market data and (optionally)
// pushes each to the owner's shop as a DRAFT, one by one. Resumable: each item
// is advanced independently by the /step endpoint, so a run survives restarts and
// can later be driven by a proper queue/worker instead of the client loop.
export interface IAutomationItem {
  idx: number
  keyword: string
  status: 'pending' | 'running' | 'done' | 'error'
  title?: string
  tags?: string[]
  description?: string
  price?: number
  listingId?: number
  listingUrl?: string
  error?: string
}
export interface IAutomationRun extends Document {
  userId: string
  status: 'pending' | 'running' | 'done' | 'error' | 'canceled'
  mode: 'keywords' | 'niche'
  niche?: string
  geo: string
  publishToEtsy: boolean
  shopId?: string
  taxonomyId?: number
  listingType: 'physical' | 'download'
  whoMade: 'i_did' | 'someone_else' | 'collective'
  quantity: number
  options?: Record<string, unknown>
  items: IAutomationItem[]
  error?: string
  createdAt?: Date
  updatedAt?: Date
}
const AutomationItemSchema = new Schema<IAutomationItem>({
  idx:         { type: Number, required: true },
  keyword:     { type: String, required: true },
  status:      { type: String, enum: ['pending', 'running', 'done', 'error'], default: 'pending' },
  title:       String,
  tags:        [String],
  description: String,
  price:       Number,
  listingId:   Number,
  listingUrl:  String,
  error:       String,
}, { _id: false })
const AutomationRunSchema = new Schema<IAutomationRun>({
  userId:        { type: String, required: true, index: true },
  status:        { type: String, enum: ['pending', 'running', 'done', 'error', 'canceled'], default: 'pending', index: true },
  mode:          { type: String, enum: ['keywords', 'niche'], default: 'keywords' },
  niche:         String,
  geo:           { type: String, default: 'US' },
  publishToEtsy: { type: Boolean, default: false },
  shopId:        String,
  taxonomyId:    Number,
  listingType:   { type: String, enum: ['physical', 'download'], default: 'physical' },
  whoMade:       { type: String, enum: ['i_did', 'someone_else', 'collective'], default: 'i_did' },
  quantity:      { type: Number, default: 1 },
  options:       { type: Schema.Types.Mixed },
  items:         { type: [AutomationItemSchema], default: [] },
  error:         String,
}, { timestamps: true })
AutomationRunSchema.index({ userId: 1, createdAt: -1 })

// ─── Extension usage ────────────────────────────────────────────────────────────
// One row per user who has used the "Rankkw for Etsy" browser extension, so the
// admin can see who is on it, how active they are, and which version they run.
export interface IExtensionUsageDoc extends Document {
  userId: string
  firstSeenAt: Date
  lastSeenAt: Date
  hits: number
  version?: string | null
  extensionId?: string | null
  lastEndpoint?: string | null
}
const ExtensionUsageSchema = new Schema<IExtensionUsageDoc>({
  userId:       { type: String, required: true, unique: true, index: true },
  firstSeenAt:  { type: Date, default: Date.now },
  lastSeenAt:   { type: Date, default: Date.now, index: true },
  hits:         { type: Number, default: 0 },
  version:      { type: String, default: null },
  extensionId:  { type: String, default: null },
  lastEndpoint: { type: String, default: null },
})

// ─── Notifications ──────────────────────────────────────────────────────────────
// A notification is either a broadcast (audience 'all', shown to every user) or
// targeted at one user. `readBy` holds the userIds who have dismissed/read it, so a
// per-user unread count is a single query. Admins get their own broadcasts too.
export interface INotificationDoc extends Document {
  audience: 'all' | 'user' | 'admin'
  userId?: string | null
  type: string
  title: string
  body?: string
  link?: string
  readBy: string[]
  createdAt?: Date
}
const NotificationSchema = new Schema<INotificationDoc>({
  audience: { type: String, enum: ['all', 'user', 'admin'], default: 'user', index: true },
  userId:   { type: String, default: null, index: true },
  type:     { type: String, default: 'info' },
  title:    { type: String, required: true },
  body:     String,
  link:     String,
  readBy:   { type: [String], default: [] },
}, { timestamps: true })
NotificationSchema.index({ createdAt: -1 })

// ─── Support chat ───────────────────────────────────────────────────────────────
// One thread per user (keyed by userId); the user talks to the admin. `sender` says
// who wrote it; the read flags drive unread badges on each side.
export interface IChatMessageDoc extends Document {
  userId: string
  sender: 'user' | 'admin'
  body: string
  readByUser: boolean
  readByAdmin: boolean
  createdAt?: Date
}
const ChatMessageSchema = new Schema<IChatMessageDoc>({
  userId:      { type: String, required: true, index: true },
  sender:      { type: String, enum: ['user', 'admin'], required: true },
  body:        { type: String, required: true, maxlength: 4000 },
  readByUser:  { type: Boolean, default: false },
  readByAdmin: { type: Boolean, default: false },
}, { timestamps: true })
ChatMessageSchema.index({ userId: 1, createdAt: 1 })

// ─── Keyword alerts ─────────────────────────────────────────────────────────────
// A keyword a user is watching. We store the last-seen metrics as a baseline; a cron
// re-checks periodically and raises a notification when they move enough.
export interface ITrackedKeywordDoc extends Document {
  userId: string
  keyword: string
  country: string
  baseVolume?: number | null
  baseCompetition?: number | null
  baseDifficulty?: number | null
  lastCheckedAt: Date
  lastNotifiedAt?: Date | null
  createdAt?: Date
}
const TrackedKeywordSchema = new Schema<ITrackedKeywordDoc>({
  userId:          { type: String, required: true, index: true },
  keyword:         { type: String, required: true, trim: true },
  country:         { type: String, default: 'GLO' },
  baseVolume:      { type: Number, default: null },
  baseCompetition: { type: Number, default: null },
  baseDifficulty:  { type: Number, default: null },
  lastCheckedAt:   { type: Date, default: Date.now, index: true },
  lastNotifiedAt:  { type: Date, default: null },
}, { timestamps: true })
TrackedKeywordSchema.index({ userId: 1, keyword: 1, country: 1 }, { unique: true })

// Auto-expire old chats and notifications via MongoDB TTL indexes: a document is removed
// ~30 days after it was created, so these collections never grow unbounded and a user with
// no recent activity simply starts a fresh conversation. No cron needed (Mongo's TTL monitor
// sweeps every ~60s). Retention is env-tunable; db.ts leaves autoIndex on, so the index is
// created automatically on the next connection.
const RETENTION_SECONDS = (Number(process.env.CHAT_RETENTION_DAYS) > 0 ? Number(process.env.CHAT_RETENTION_DAYS) : 30) * 86400
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS })
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS })

// ─── Affiliate program ────────────────────────────────────────────────────────
// One Affiliate row per enrolled user (their referral code + payout details +
// running counters). Each paid purchase by a referred user creates one
// ReferralConversion holding the commission and its payout status. Money never
// flows automatically: the business receives the full sale and settles the
// commission out of it, so a conversion just tracks what is owed and whether the
// admin has paid it.
export interface IAffiliateDoc extends Document {
  userId: string
  code: string
  commissionRate: number                 // 0.20 = 20%
  status: 'active' | 'suspended'
  payoutMethod?: 'bank' | 'jazzcash' | 'easypaisa' | null
  payoutName?: string | null             // account holder name
  payoutNumber?: string | null           // IBAN / account no. / wallet number
  payoutBank?: string | null             // bank name (bank method only)
  clicks: number
  signups: number
  conversions: number
  earnedTotal: number                    // USD lifetime commission recorded
  paidTotal: number                      // USD marked paid by an admin
  createdAt?: Date
}
const AffiliateSchema = new Schema<IAffiliateDoc>({
  userId:         { type: String, required: true, unique: true, index: true },
  code:           { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  commissionRate: { type: Number, default: 0.30 },
  status:         { type: String, enum: ['active', 'suspended'], default: 'active' },
  payoutMethod:   { type: String, enum: ['bank', 'jazzcash', 'easypaisa', null], default: null },
  payoutName:     { type: String, default: null },
  payoutNumber:   { type: String, default: null },
  payoutBank:     { type: String, default: null },
  clicks:         { type: Number, default: 0 },
  signups:        { type: Number, default: 0 },
  conversions:    { type: Number, default: 0 },
  earnedTotal:    { type: Number, default: 0 },
  paidTotal:      { type: Number, default: 0 },
}, { timestamps: true })

// Recurring: a commission is recorded per successful PAYMENT (invoice), up to 12
// per subscription (see RECURRING_MONTHS in lib/affiliate.ts). `invoiceId` is the
// LS invoice id and is the dedupe key (unique) so a retried webhook can't double
// pay. `subscriptionId` groups a customer's payments (for the 12-payment cap).
export interface IReferralConversionDoc extends Document {
  affiliateId: string
  code: string
  referredUserId: string
  referredEmail: string
  referredName?: string | null
  subscriptionId?: string | null
  invoiceId?: string | null              // LS invoice id - unique dedupe key
  rateApplied?: number | null            // 0.30 or 0.50 at the time it was earned
  plan: string
  grossUsd: number
  commissionUsd: number
  status: 'pending' | 'approved' | 'paid' | 'refunded'
  approvedAt?: Date | null
  paidAt?: Date | null
  createdAt?: Date
}
const ReferralConversionSchema = new Schema<IReferralConversionDoc>({
  affiliateId:    { type: String, required: true, index: true },
  code:           { type: String, required: true, index: true },
  referredUserId: { type: String, required: true, index: true },
  referredEmail:  { type: String, required: true },
  referredName:   { type: String, default: null },
  subscriptionId: { type: String, default: null, index: true },
  invoiceId:      { type: String, default: null },
  rateApplied:    { type: Number, default: null },
  plan:           { type: String, required: true },
  grossUsd:       { type: Number, required: true },
  commissionUsd:  { type: Number, required: true },
  status:         { type: String, enum: ['pending', 'approved', 'paid', 'refunded'], default: 'pending', index: true },
  approvedAt:     { type: Date, default: null },
  paidAt:         { type: Date, default: null },
}, { timestamps: true })
// One conversion per invoice (guards duplicate webhook deliveries). Partial so the
// many null invoiceIds don't collide. lib/affiliate.ts syncs indexes on first use
// so the older subscriptionId-unique index (if present) is dropped automatically.
ReferralConversionSchema.index({ invoiceId: 1 }, { unique: true, partialFilterExpression: { invoiceId: { $type: 'string' } } })

export const ExtensionUsage = (models.ExtensionUsage as mongoose.Model<IExtensionUsageDoc>) ?? model<IExtensionUsageDoc>('ExtensionUsage', ExtensionUsageSchema)
export const Notification   = (models.Notification as mongoose.Model<INotificationDoc>)   ?? model<INotificationDoc>('Notification', NotificationSchema)
export const ChatMessage    = (models.ChatMessage as mongoose.Model<IChatMessageDoc>)     ?? model<IChatMessageDoc>('ChatMessage', ChatMessageSchema)
export const TrackedKeyword = (models.TrackedKeyword as mongoose.Model<ITrackedKeywordDoc>) ?? model<ITrackedKeywordDoc>('TrackedKeyword', TrackedKeywordSchema)
export const Affiliate      = (models.Affiliate as mongoose.Model<IAffiliateDoc>)          ?? model<IAffiliateDoc>('Affiliate', AffiliateSchema)
export const ReferralConversion = (models.ReferralConversion as mongoose.Model<IReferralConversionDoc>) ?? model<IReferralConversionDoc>('ReferralConversion', ReferralConversionSchema)

export const User          = models.User          ?? model<IUserDoc>('User', UserSchema)
export const AutomationRun = (models.AutomationRun as mongoose.Model<IAutomationRun>) ?? model<IAutomationRun>('AutomationRun', AutomationRunSchema)
export const Blog          = (models.Blog as mongoose.Model<IBlog>) ?? model<IBlog>('Blog', BlogSchema)
export const Deal          = (models.Deal as mongoose.Model<IDeal>) ?? model<IDeal>('Deal', DealSchema)
export const PopupAd       = (models.PopupAd as mongoose.Model<IPopupAd>) ?? model<IPopupAd>('PopupAd', PopupAdSchema)
export const AppSetting     = (models.AppSetting as mongoose.Model<IAppSetting>) ?? model<IAppSetting>('AppSetting', AppSettingSchema)
export const ShopSnapshot    = models.ShopSnapshot    ?? model<IShopSnapshot>('ShopSnapshot', ShopSnapshotSchema)
export const ListingSnapshot = models.ListingSnapshot ?? model<IListingSnapshot>('ListingSnapshot', ListingSnapshotSchema)
export const TrackedShop     = models.TrackedShop     ?? model<ITrackedShop>('TrackedShop', TrackedShopSchema)
export const TrackedListing  = models.TrackedListing  ?? model<ITrackedListing>('TrackedListing', TrackedListingSchema)
export const ConnectedShop   = models.ConnectedShop   ?? model<IConnectedShop>('ConnectedShop', ConnectedShopSchema)
export const OTP           = models.OTP           ?? model<IOTP>('OTP', OTPSchema)
export const KeywordCache  = models.KeywordCache  ?? model<IKeywordCache>('KeywordCache', KeywordCacheSchema)
export const CollectiveKeywordData = models.CollectiveKeywordData ?? model<ICollectiveKeywordData>('CollectiveKeywordData', CollectiveKeywordDataSchema)
export const ApiUsage      = models.UserApiUsage  ?? model<IApiUsage>('UserApiUsage', ApiUsageSchema)
export const KeywordHistory= models.KeywordHistory?? model<IKeywordHistory>('KeywordHistory', KeywordHistorySchema)
