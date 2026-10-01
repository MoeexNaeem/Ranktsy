import { NextRequest } from 'next/server'
import { adsRoute, parseBody } from '@/lib/google-ads-route'
import { listConversionActions, createConversionAction, createConversionSchema } from '@/lib/google-ads-assets'
import { withUsage } from '@/lib/track'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: conversion actions in the selected account (with their tag snippets).
async function handleGET() {
  return adsRoute(({ token, account }) => listConversionActions(token, account))
}

// POST: create a website or call conversion action (turns on conversion tracking).
async function handlePOST(req: NextRequest) {
  return adsRoute(async ({ token, account }) => createConversionAction(token, account, await parseBody(req, createConversionSchema)), { mutates: true })
}

// Attribute this route's Etsy/Google calls to the signed-in user in the admin
// usage table (without it they all landed under "anonymous").
export const GET = withUsage(handleGET)
export const POST = withUsage(handlePOST)
