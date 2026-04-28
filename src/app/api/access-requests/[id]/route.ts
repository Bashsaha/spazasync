import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import {
  denyAccessRequest,
  grantAccessRequest,
  revokeAccessRequest,
} from '@/lib/db/access-requests'
import { resolveAccessRequestSchema } from '@/lib/validation/schemas'
import { parseBody } from '@/lib/utils/api'

function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse
}

/**
 * PATCH /api/access-requests/[id]
 *   Owner-only. Body: { action: 'grant' | 'deny' | 'revoke' }.
 *   - grant: sets status='granted' + expires_at=NOW()+4h
 *   - deny: sets status='denied'
 *   - revoke: sets status='revoked' (use after a previous grant)
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params

  const parsed = await parseBody(request, resolveAccessRequestSchema)
  if (isResponse(parsed)) return parsed

  try {
    const action = parsed.action
    const updated =
      action === 'grant'
        ? await grantAccessRequest(auth.supabase, id, auth.user.id)
        : action === 'deny'
        ? await denyAccessRequest(auth.supabase, id, auth.user.id)
        : await revokeAccessRequest(auth.supabase, id, auth.user.id)
    return NextResponse.json({ request: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
