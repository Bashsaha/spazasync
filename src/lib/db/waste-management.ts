import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import type { UpsertWasteManagementInput, WasteManagement } from '@/types'

export {
  isWasteConfirmationStale,
  WASTE_STALE_DAYS,
  daysSince,
} from '@/lib/compliance/waste-pest-status'

/** Today's date in SAST as YYYY-MM-DD. */
export function todaySAST(): string {
  return formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')
}

/** Get the waste management singleton for the current user's shop, or null. */
export async function getWasteManagement(): Promise<WasteManagement | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('waste_management')
    .select('*')
    .maybeSingle()
  return (data as WasteManagement) ?? null
}

/**
 * Upsert the waste arrangement for the current user's shop.
 * Preserves the existing last_confirmed_date (it has its own endpoint).
 */
export async function upsertWasteManagement(
  input: UpsertWasteManagementInput,
): Promise<WasteManagement> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const { data, error } = await supabase
    .from('waste_management')
    .upsert(
      {
        shop_id: shopId,
        removal_type: input.removal_type,
        frequency: input.frequency,
        provider_name: input.provider_name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as WasteManagement
}

/**
 * Stamp last_confirmed_date = today (SAST). Only works once the singleton exists.
 * Returns the updated row.
 */
export async function confirmWasteStillActive(): Promise<WasteManagement> {
  const supabase = await createClient()
  const today = todaySAST()
  const { data, error } = await supabase
    .from('waste_management')
    .update({
      last_confirmed_date: today,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data as WasteManagement
}
