import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import {
  createTellerAccessRequest,
  listAccessRequestsForShop,
  listActiveGrantsForShop,
} from '@/lib/db/access-requests'
import { createAccessRequestSchema } from '@/lib/validation/schemas'
import { parseBody } from '@/lib/utils/api'

function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse
}

/**
 * GET /api/access-requests?status=pending|granted
 *   Owner-only. Returns requests in the owner's shop joined with teller names.
 *   Defaults to pending. status=granted returns only currently-active grants
 *   (expired-but-uncleared rows are filtered out).
 */
export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')

  try {
    const requests =
      statusParam === 'granted'
        ? await listActiveGrantsForShop(auth.supabase, auth.shopId)
        : await listAccessRequestsForShop(auth.supabase, auth.shopId, {
            status: statusParam === null ? 'pending' : (statusParam as 'pending' | 'granted'),
          })
    return NextResponse.json({ requests })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/access-requests
 *   Teller-only. Body: { feature?: 'inventory' }. Creates a pending request.
 *   Refuses if the teller already has a pending row or an active grant for the
 *   same feature (returns 409).
 */
export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'teller') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = await parseBody(request, createAccessRequestSchema)
  if (isResponse(parsed)) return parsed

  try {
    const result = await createTellerAccessRequest(parsed.feature)
    if (!result.ok) {
      const status = result.reason === 'no_teller' ? 404 : 409
      return NextResponse.json({ error: result.reason }, { status })
    }
    return NextResponse.json({ request: result.request }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
