import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { createAdminClient } from '@/lib/supabase/admin'
import { complianceOnboardingSchema } from '@/lib/validation/schemas'
import { upsertOwnerProfile } from '@/lib/db/owner-profiles'
import { findMunicipalityByArea } from '@/lib/db/municipalities'
import {
  buildJourneySteps,
  toggleStateToDocumentStatus,
} from '@/lib/compliance/onboarding'
import type {
  DocumentToggleState,
  OnboardingDocumentType,
  ComplianceOnboardingPayload,
} from '@/types'

/**
 * POST /api/compliance-onboarding
 *
 * Auth-first per BUG-004/005 prevention rule. Validates the payload,
 * forces fund_interest=false for foreign nationals (defence in depth),
 * then writes owner_profiles, shops, and business_documents in sequence
 * via the service-role admin client. Returns the personalised journey
 * steps so the client can render Screen 8 immediately.
 */
export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(
    request,
    complianceOnboardingSchema,
  )
  if (parsed instanceof NextResponse) return parsed
  const payload = parsed as ComplianceOnboardingPayload

  // Server-side defence in depth — only SA citizens have fund_interest.
  const fundInterest =
    payload.nationality_type === 'sa_citizen' ? payload.fund_interest : false

  // Resolve area-text into a municipality_id when possible.
  let municipalityId: string | null = payload.municipality_id ?? null
  let municipalityAreaText: string | null = null
  if (!municipalityId && payload.municipality_area_text) {
    const matched = await findMunicipalityByArea(payload.municipality_area_text)
    if (matched) {
      municipalityId = matched.id
    } else {
      municipalityAreaText = payload.municipality_area_text
    }
  }

  const admin = createAdminClient()

  // Verify the authenticated user owns this shop. (Tellers + admins without a
  // linked shop are blocked from this flow at the route level via /dashboard's
  // role gate, but defence in depth.)
  const { data: shopUser } = await admin
    .from('shop_users')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('shop_id', auth.shopId)
    .single()
  if (shopUser?.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the shop owner can complete this' },
      { status: 403 },
    )
  }

  // 1. owner_profiles upsert
  await upsertOwnerProfile(auth.user.id, {
    nationality_type: payload.nationality_type,
    food_safety_training_completed: payload.food_safety_training_completed,
    food_safety_training_date: payload.food_safety_training_date,
    food_safety_training_provider: payload.food_safety_training_provider,
  })

  // 2. shops update — store municipality choice + employee/fund flags + completion.
  const { error: shopError } = await admin
    .from('shops')
    .update({
      municipality_id: municipalityId,
      municipality_area_text: municipalityAreaText,
      has_employees: payload.has_employees,
      fund_interest: fundInterest,
      onboarding_compliance_completed: true,
    })
    .eq('id', auth.shopId)
  if (shopError) {
    console.error('Failed to update shop compliance fields:', shopError)
    return NextResponse.json(
      { error: 'Could not save your answers' },
      { status: 500 },
    )
  }

  // 3. business_documents upserts — one per answered toggle, plus the
  //    food-safety-training row when the food-safety screen was answered.
  const docRows: Array<{
    shop_id: string
    document_type: string
    status: string
  }> = []

  for (const [type, state] of Object.entries(payload.document_states) as Array<
    [OnboardingDocumentType, DocumentToggleState]
  >) {
    if (type === 'uif' && !payload.has_employees) continue
    docRows.push({
      shop_id: auth.shopId,
      document_type: type,
      status: toggleStateToDocumentStatus(state),
    })
  }

  // Always record the food-safety answer so the dashboard documents view
  // shows it consistently.
  docRows.push({
    shop_id: auth.shopId,
    document_type: 'food_safety_training',
    status: payload.food_safety_training_completed ? 'on_file' : 'not_registered',
  })

  if (docRows.length > 0) {
    const { error: docError } = await admin
      .from('business_documents')
      .upsert(docRows, { onConflict: 'shop_id,document_type' })
    if (docError) {
      console.error('Failed to upsert business documents:', docError)
      return NextResponse.json(
        { error: 'Could not save your document answers' },
        { status: 500 },
      )
    }
  }

  const journey = buildJourneySteps({
    has_employees: payload.has_employees,
    document_states: payload.document_states,
    food_safety_training_completed: payload.food_safety_training_completed,
  })

  return NextResponse.json({ ok: true, journey })
}
