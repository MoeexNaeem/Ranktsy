import mongoose, { Schema, model, models, type Document } from 'mongoose'
import type { IKeywordCache, IKeywordHistory, IOTP } from '@/types'

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

export const User          = models.User          ?? model<IUserDoc>('User', UserSchema)
export const OTP           = models.OTP           ?? model<IOTP>('OTP', OTPSchema)
export const KeywordCache  = models.KeywordCache  ?? model<IKeywordCache>('KeywordCache', KeywordCacheSchema)
export const KeywordHistory= models.KeywordHistory?? model<IKeywordHistory>('KeywordHistory', KeywordHistorySchema)
