import mongoose, { Schema, model, models, type Document } from 'mongoose'
import { SNAPSHOT_RETENTION_DAYS } from '@/utils'
import type {
  IKeywordCache, IKeywordHistory, IOTP,
  IShopSnapshot, IListingSnapshot, ITrackedShop,
} from '@/types'

// ─── User ─────────────────────────────────────────────────────────────────────
export interface IUserDoc extends Document {
  name: string
  email: string
  password: string
  role: 'user' | 'admin'
  plan: 'free' | 'grow' | 'scale'
  isVerified: boolean
  etsyShopId?: string
  etsyAccessToken?: string
  etsyRefreshToken?: string
  etsyTokenExpiry?: Date
  savedKeywords: string[]
  searchCount: number
  lastSearchReset: Date
}

const UserSchema = new Schema<IUserDoc>({
  name:             { type: String, required: true, trim: true, maxlength: 60 },
  email:            { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password:         { type: String, required: true, select: false }, // never returned by default
  role:             { type: String, enum: ['user','admin'], default: 'user' },
  plan:             { type: String, enum: ['free','grow','scale'], default: 'free' },
  isVerified:       { type: Boolean, default: false },
  etsyShopId:       { type: String },
  etsyAccessToken:  { type: String, select: false },
  etsyRefreshToken: { type: String, select: false },
  etsyTokenExpiry:  { type: Date },
  savedKeywords:    { type: [String], default: [] },
  searchCount:      { type: Number, default: 0 },
  lastSearchReset:  { type: Date, default: Date.now },
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
  data:      { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true })

KeywordCacheSchema.index({ keyword: 1, createdAt: -1 })

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

export const User          = models.User          ?? model<IUserDoc>('User', UserSchema)
export const ShopSnapshot    = models.ShopSnapshot    ?? model<IShopSnapshot>('ShopSnapshot', ShopSnapshotSchema)
export const ListingSnapshot = models.ListingSnapshot ?? model<IListingSnapshot>('ListingSnapshot', ListingSnapshotSchema)
export const TrackedShop     = models.TrackedShop     ?? model<ITrackedShop>('TrackedShop', TrackedShopSchema)
export const OTP           = models.OTP           ?? model<IOTP>('OTP', OTPSchema)
export const KeywordCache  = models.KeywordCache  ?? model<IKeywordCache>('KeywordCache', KeywordCacheSchema)
export const KeywordHistory= models.KeywordHistory?? model<IKeywordHistory>('KeywordHistory', KeywordHistorySchema)
