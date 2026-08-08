import mongoose, { Schema, model, models, type Document } from 'mongoose'
import { SNAPSHOT_RETENTION_DAYS } from '@/utils'
import { PLAN_SLUGS, type PlanSlug } from '@/lib/plans'
import type {
  IKeywordCache, IKeywordHistory, IOTP,
  IShopSnapshot, IListingSnapshot, ITrackedShop,
  ICollectiveKeywordData, IApiUsage, IBlog,
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
  etsyShopId?: string
  etsyAccessToken?: string
  etsyRefreshToken?: string
  etsyTokenExpiry?: Date
  savedKeywords: string[]
  searchCount: number
  lastSearchReset: Date
  listingImageCount?: number   // Etsy Listing Pro images used this month
  listingImageReset?: Date
}

const UserSchema = new Schema<IUserDoc>({
  name:             { type: String, required: true, trim: true, maxlength: 60 },
  email:            { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password:         { type: String, required: false, select: false }, // optional — OAuth users have none; never returned by default
  authProvider:     { type: String, enum: ['google','microsoft'] },
  role:             { type: String, enum: ['user','admin'], default: 'user' },
  plan:             { type: String, enum: PLAN_SLUGS, default: 'free' },
  isVerified:       { type: Boolean, default: false },
  lsSubscriptionId:  { type: String },
  lsCustomerId:      { type: String },
  lsVariantId:       { type: String },
  subscriptionStatus:{ type: String },
  planRenewsAt:      { type: Date },
  etsyShopId:       { type: String },
  etsyAccessToken:  { type: String, select: false },
  etsyRefreshToken: { type: String, select: false },
  etsyTokenExpiry:  { type: Date },
  savedKeywords:    { type: [String], default: [] },
  searchCount:      { type: Number, default: 0 },
  lastSearchReset:  { type: Date, default: Date.now },
  listingImageCount:{ type: Number, default: 0 },
  listingImageReset:{ type: Date, default: Date.now },
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
  // Country filter — Google volume/CPC/competition are geo-specific, so each
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
// collection `userapiusages` — NOT the `apiusages` that Ranktsy's simple daily
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
  // Gemini image generation — count, total tokens burnt, and USD spent.
  imageCalls:   { type: Number, default: 0 },
  imageTokens:  { type: Number, default: 0 },
  imageCostUsd: { type: Number, default: 0 },
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
 * 24h other) governs re-displaying their content AS CURRENT — which we never do:
 * every current figure is fetched live, and a snapshot is only ever rendered as a
 * dated historical measurement. This bound keeps that distinction honest.
 */
const SNAPSHOT_TTL_SECONDS = SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60

// ─── Shop Snapshot ─────────────────────────────────────────────────────────────
// One row per shop per UTC day. This is the ONLY source of sales history — Etsy
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

// Unique per shop per day — makes capture idempotent, so recording opportunistically
// on every shop read can't produce duplicate rows.
ShopSnapshotSchema.index({ shopId: 1, day: 1 }, { unique: true })
ShopSnapshotSchema.index({ shopId: 1, capturedAt: -1 })
// Enforces the retention bound in the database rather than in a comment.
ShopSnapshotSchema.index({ capturedAt: 1 }, { expireAfterSeconds: SNAPSHOT_TTL_SECONDS })

// ─── Listing Snapshot ──────────────────────────────────────────────────────────
// Powers "Changes" — what a competitor edited (title/tags/price), which Etsy's
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

export const User          = models.User          ?? model<IUserDoc>('User', UserSchema)
export const Blog          = (models.Blog as mongoose.Model<IBlog>) ?? model<IBlog>('Blog', BlogSchema)
export const ShopSnapshot    = models.ShopSnapshot    ?? model<IShopSnapshot>('ShopSnapshot', ShopSnapshotSchema)
export const ListingSnapshot = models.ListingSnapshot ?? model<IListingSnapshot>('ListingSnapshot', ListingSnapshotSchema)
export const TrackedShop     = models.TrackedShop     ?? model<ITrackedShop>('TrackedShop', TrackedShopSchema)
export const OTP           = models.OTP           ?? model<IOTP>('OTP', OTPSchema)
export const KeywordCache  = models.KeywordCache  ?? model<IKeywordCache>('KeywordCache', KeywordCacheSchema)
export const CollectiveKeywordData = models.CollectiveKeywordData ?? model<ICollectiveKeywordData>('CollectiveKeywordData', CollectiveKeywordDataSchema)
export const ApiUsage      = models.UserApiUsage  ?? model<IApiUsage>('UserApiUsage', ApiUsageSchema)
export const KeywordHistory= models.KeywordHistory?? model<IKeywordHistory>('KeywordHistory', KeywordHistorySchema)
