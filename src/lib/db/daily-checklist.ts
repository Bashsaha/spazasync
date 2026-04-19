import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import type { DailyChecklist, DailyChecklistInput } from '@/types'

export { fridgeInRange, freezerInRange, computeChecklistStats } from '@/lib/checklist/stats'

/** SAST-local date for "today" (YYYY-MM-DD). */
export function todaySAST(): string {
  return formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')
}

/** SAST-local date for a given Date (YYYY-MM-DD). */
export function dateStrSAST(d: Date): string {
  return formatInTimeZone(d, SAST_TZ, 'yyyy-MM-dd')
}

/** Get today's checklist row for a shop (or null if none saved yet). */
export async function getTodayChecklist(shopId: string, date: string): Promise<DailyChecklist | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('daily_checklists')
    .select('*')
    .eq('shop_id', shopId)
    .eq('date', date)
    .maybeSingle()
  return (data as DailyChecklist | null) ?? null
}

/** Upsert today's checklist. One row per shop per day. */
export async function upsertChecklist(
  shopId: string,
  userId: string,
  date: string,
  input: DailyChecklistInput,
): Promise<DailyChecklist> {
  const supabase = await createClient()
  const payload = {
    shop_id: shopId,
    date,
    fridge_ok: input.fridge_ok ?? null,
    fridge_temp: input.fridge_temp ?? null,
    freezer_ok: input.freezer_ok ?? null,
    freezer_temp: input.freezer_temp ?? null,
    surfaces_cleaned: input.surfaces_cleaned ?? null,
    floor_cleaned: input.floor_cleaned ?? null,
    storage_clean: input.storage_clean ?? null,
    expired_items_action: input.expired_items_action ?? null,
    completed_by: userId,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('daily_checklists')
    .upsert(payload, { onConflict: 'shop_id,date' })
    .select()
    .single()

  if (error) throw error
  return data as DailyChecklist
}

/**
 * List the last N days of checklists (ordered date desc).
 * Returns only real rows; callers that need gap-filled days should merge against a date range.
 */
export async function listChecklistHistory(shopId: string, days = 30): Promise<DailyChecklist[]> {
  const supabase = await createClient()

  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  const fromDate = dateStrSAST(from)
  const toDate = todaySAST()

  const { data, error } = await supabase
    .from('daily_checklists')
    .select('*')
    .eq('shop_id', shopId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: false })

  if (error) throw error
  return (data as DailyChecklist[]) ?? []
}

