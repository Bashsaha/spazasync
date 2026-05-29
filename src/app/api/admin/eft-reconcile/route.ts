import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { eftReconcileSchema } from '@/lib/validation/schemas'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { parseDeposits } from '@/lib/eft/adapters'
import { reconcileDeposits } from '@/lib/db/eft-reconcile'

/**
 * POST /api/admin/eft-reconcile
 *
 * Admin uploads a bank export (OFX or CSV). The server re-parses authoritatively
 * (never trusting client-normalized rows), matches each deposit to a shop by
 * amount + shop-code reference, auto-applies confident matches (renewal-aware),
 * and returns a report of applied / needs-review / unmatched / duplicate rows.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(request, { limit: 10, windowSecs: 3600 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = eftReconcileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const now = new Date()
    const { deposits, errors } = parseDeposits(parsed.data.fileText, parsed.data.format, {
      mapping: parsed.data.mapping,
      now,
    })
    const report = await reconcileDeposits(deposits, errors, admin.id, now)
    return NextResponse.json(report)
  } catch (err) {
    console.error('EFT reconcile error:', err)
    return NextResponse.json({ error: 'Failed to reconcile deposits' }, { status: 500 })
  }
}
