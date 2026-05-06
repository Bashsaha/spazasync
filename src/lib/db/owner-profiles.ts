/**
 * Owner profile — person-level compliance data (Phase 37b).
 *
 * Person-level (one row per auth user) so a single owner with multiple shops
 * doesn't re-enter nationality / food-safety training. RLS restricts each row
 * to its own user; service-role admin client used for atomic multi-table
 * writes from /api/compliance-onboarding.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OwnerProfile, NationalityType, VisaType } from '@/types'

export interface UpsertOwnerProfileInput {
  nationality_type: NationalityType
  food_safety_training_completed: boolean
  food_safety_training_date?: string | null
  food_safety_training_provider?: string | null
  // Phase 37f — only set for foreign nationals; caller is responsible for
  // passing null when nationality_type === 'sa_citizen'.
  visa_type?: VisaType | null
  visa_expiry_date?: string | null
}

/** Get the owner profile for the current auth user, or null if it doesn't exist. */
export async function getOwnerProfile(userId: string): Promise<OwnerProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('owner_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as OwnerProfile | null) ?? null
}

/** Upsert via the admin client — keeps rollback semantics consistent with the
 *  multi-table compliance-onboarding write. RLS would also allow it via the
 *  user's own session, but service-role makes the orchestration uniform. */
export async function upsertOwnerProfile(
  userId: string,
  input: UpsertOwnerProfileInput,
): Promise<OwnerProfile> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('owner_profiles')
    .upsert(
      {
        user_id: userId,
        nationality_type: input.nationality_type,
        food_safety_training_completed: input.food_safety_training_completed,
        food_safety_training_date: input.food_safety_training_date ?? null,
        food_safety_training_provider: input.food_safety_training_provider ?? null,
        visa_type: input.visa_type ?? null,
        visa_expiry_date: input.visa_expiry_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as OwnerProfile
}
