import { NextRequest, NextResponse } from 'next/server'
import { requireAutomationUser } from '@/lib/automation/guard'
import { getTaxonomyProperties } from '@/lib/etsy'
import { upstreamFailure } from '@/lib/upstream-errors'
import { withUsage } from '@/lib/track'

// A category's Etsy attributes (Craft type, Occasion, Celebration, ...) with their
// allowed values, for the builder's Attributes node.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handleGET(req: NextRequest) {
  const { error } = await requireAutomationUser()
  if (error) return error

  const taxonomyId = Number(req.nextUrl.searchParams.get('taxonomyId'))
  if (!Number.isInteger(taxonomyId) || taxonomyId <= 0) return NextResponse.json({ success: false, error: 'Missing category.' }, { status: 400 })
  try {
    return NextResponse.json({ success: true, data: await getTaxonomyProperties(taxonomyId) })
  } catch (err) {
    const fail = upstreamFailure(err)
    return NextResponse.json({ success: false, error: fail.message }, { status: fail.status })
  }
}

export const GET = withUsage(handleGET)
