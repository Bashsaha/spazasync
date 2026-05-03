import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { journeyStepActionSchema } from '@/lib/validation/schemas'
import { resolveStepStatusForAction } from '@/lib/compliance/journey'
import { upsertBusinessDocument } from '@/lib/db/business-documents'
import type { UpsertBusinessDocumentInput } from '@/types'

/**
 * POST /api/compliance/journey/step
 *
 * Single endpoint for the journey card actions: "Mark as done", "I've applied",
 * "I've received", and "Reset" (revert a step that was tapped by mistake).
 *
 * Wraps `upsertBusinessDocument` so we don't duplicate the shop_id derivation
 * or trigger handling. The status is resolved from the action verb via
 * `resolveStepStatusForAction` to keep the action → DocumentStatus mapping
 * in one place.
 *
 * Auth-first per BUG-004 — never parse the body before checking the user.
 */
export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owners only' }, { status: 403 })
  }

  const parsed = await parseBody(request, journeyStepActionSchema)
  if (parsed instanceof NextResponse) return parsed

  const { status, setAppliedAt, clearAppliedAt } = resolveStepStatusForAction(parsed.action)

  const input: UpsertBusinessDocumentInput = {
    status,
    reference_number: parsed.reference_number ?? null,
    date_issued: parsed.date_issued ?? null,
    expiry_date: parsed.expiry_date ?? null,
  }
  if (setAppliedAt) input.applied_at = new Date().toISOString()
  if (clearAppliedAt) input.applied_at = null

  try {
    const doc = await upsertBusinessDocument(parsed.document_type, input)
    return NextResponse.json(doc)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
