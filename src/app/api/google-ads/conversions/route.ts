import { NextRequest } from 'next/server'
import { adsRoute, parseBody } from '@/lib/google-ads-route'
import { listConversionActions, createConversionAction, createConversionSchema } from '@/lib/google-ads-assets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: conversion actions in the selected account (with their tag snippets).
export async function GET() {
  return adsRoute(({ token, account }) => listConversionActions(token, account))
}

// POST: create a website or call conversion action (turns on conversion tracking).
export async function POST(req: NextRequest) {
  return adsRoute(async ({ token, account }) => createConversionAction(token, account, await parseBody(req, createConversionSchema)), { mutates: true })
}
