import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Affiliate, AffiliateLink } from '@/lib/models'
import { getCurrentUser } from '@/lib/auth/session'
import {
  MAX_CUSTOM_LINKS, normalizeCode, codeProblem, codeProblemMessage,
  isCodeAvailable, serializeLink,
} from '@/lib/affiliate'
import type { ApiResponse, IAffiliateLink } from '@/types'

export const runtime = 'nodejs'

type LinkDto = ReturnType<typeof serializeLink>

/**
 * An affiliate's own custom referral links - create, rename and delete.
 *
 * Their default code never changes and is not listed here; these are the extra
 * readable codes they make per channel (?ref=spring-video). A code is unique
 * across the whole programme, so POST and PATCH answer 409 when one is already
 * claimed - that is the "already taken" the dashboard shows. Attribution and
 * commission always belong to the affiliate, so deleting a link never affects
 * referrals it already brought in.
 */

const LABEL_MAX = 60

/** The caller's affiliate record, or null when they have not enrolled. */
async function ownAffiliate(userId: string) {
  await connectDB()
  return Affiliate.findOne({ userId }).select('_id status').lean()
}

async function listLinks(affiliateId: string): Promise<LinkDto[]> {
  const rows = await AffiliateLink.find({ affiliateId }).sort({ createdAt: -1 }).limit(MAX_CUSTOM_LINKS * 2).lean()
  return (rows as unknown as IAffiliateLink[]).map(serializeLink)
}

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
}
function notEnrolled() {
  return NextResponse.json({ success: false, error: 'Join the affiliate program first.' }, { status: 400 })
}

// GET - this affiliate's custom links.
export async function GET(): Promise<NextResponse<ApiResponse<{ links: LinkDto[]; max: number }>>> {
  const auth = await getCurrentUser()
  if (!auth) return unauthorized()
  const affiliate = await ownAffiliate(auth.id)
  if (!affiliate) return NextResponse.json({ success: true, data: { links: [], max: MAX_CUSTOM_LINKS } })
  return NextResponse.json({ success: true, data: { links: await listLinks(String(affiliate._id)), max: MAX_CUSTOM_LINKS } })
}

// POST { code, label? } - claim a new custom link.
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ link: LinkDto; links: LinkDto[] }>>> {
  const auth = await getCurrentUser()
  if (!auth) return unauthorized()
  const affiliate = await ownAffiliate(auth.id)
  if (!affiliate) return notEnrolled()
  if (affiliate.status !== 'active') {
    return NextResponse.json({ success: false, error: 'Your affiliate account is not active.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const code = normalizeCode(body?.code)
  const problem = codeProblem(code)
  if (problem) return NextResponse.json({ success: false, error: codeProblemMessage(problem) }, { status: 400 })

  const affiliateId = String(affiliate._id)
  const count = await AffiliateLink.countDocuments({ affiliateId })
  if (count >= MAX_CUSTOM_LINKS) {
    return NextResponse.json(
      { success: false, error: `You can have up to ${MAX_CUSTOM_LINKS} custom links. Delete one to add another.` },
      { status: 400 },
    )
  }

  if (!(await isCodeAvailable(code))) {
    return NextResponse.json({ success: false, error: 'That link is already taken. Try another name.' }, { status: 409 })
  }

  const label = String(body?.label ?? '').trim().slice(0, LABEL_MAX) || null
  try {
    const created = await AffiliateLink.create({ affiliateId, userId: auth.id, code, label })
    return NextResponse.json({
      success: true,
      data: { link: serializeLink(created as unknown as IAffiliateLink), links: await listLinks(affiliateId) },
    })
  } catch (err) {
    // Two people claiming the same code at the same moment: the unique index is
    // the real arbiter, and the loser gets the same message as a pre-flight clash.
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ success: false, error: 'That link is already taken. Try another name.' }, { status: 409 })
    }
    throw err
  }
}

// PATCH { id, code?, label? } - rename a link or relabel it.
export async function PATCH(req: NextRequest): Promise<NextResponse<ApiResponse<{ link: LinkDto; links: LinkDto[] }>>> {
  const auth = await getCurrentUser()
  if (!auth) return unauthorized()
  const affiliate = await ownAffiliate(auth.id)
  if (!affiliate) return notEnrolled()

  const body = await req.json().catch(() => ({}))
  const id = String(body?.id ?? '').trim()
  if (!id) return NextResponse.json({ success: false, error: 'Missing link id.' }, { status: 400 })

  const affiliateId = String(affiliate._id)
  // Scope the lookup to the owner, so an id from someone else's account is a 404.
  const existing = await AffiliateLink.findOne({ _id: id, affiliateId })
  if (!existing) return NextResponse.json({ success: false, error: 'Link not found.' }, { status: 404 })

  if (body?.code != null) {
    const code = normalizeCode(body.code)
    const problem = codeProblem(code)
    if (problem) return NextResponse.json({ success: false, error: codeProblemMessage(problem) }, { status: 400 })
    if (code !== existing.code) {
      if (!(await isCodeAvailable(code, id))) {
        return NextResponse.json({ success: false, error: 'That link is already taken. Try another name.' }, { status: 409 })
      }
      existing.code = code
    }
  }
  if (body?.label != null) {
    existing.label = String(body.label).trim().slice(0, LABEL_MAX) || null
  }

  try {
    await existing.save()
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ success: false, error: 'That link is already taken. Try another name.' }, { status: 409 })
    }
    throw err
  }
  return NextResponse.json({
    success: true,
    data: { link: serializeLink(existing as unknown as IAffiliateLink), links: await listLinks(affiliateId) },
  })
}

// DELETE ?id= - drop a custom link. Referrals it already produced are unaffected.
export async function DELETE(req: NextRequest): Promise<NextResponse<ApiResponse<{ links: LinkDto[] }>>> {
  const auth = await getCurrentUser()
  if (!auth) return unauthorized()
  const affiliate = await ownAffiliate(auth.id)
  if (!affiliate) return notEnrolled()

  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ success: false, error: 'Missing link id.' }, { status: 400 })

  const affiliateId = String(affiliate._id)
  const res = await AffiliateLink.deleteOne({ _id: id, affiliateId })
  if (!res.deletedCount) return NextResponse.json({ success: false, error: 'Link not found.' }, { status: 404 })
  return NextResponse.json({ success: true, data: { links: await listLinks(affiliateId) } })
}
