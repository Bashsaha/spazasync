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

/**
 * Has this shop EVER completed any daily checklist? Drives the one-time intro
 * explainer on the checklist FAB (Phase 44c) — it must fire only before the
 * genuine first checklist, never again afterwards. Keying this off a server
 * fact (not localStorage, which Android PWAs evict — the "fires at random" bug)
 * means established shops never see the intro again even if their device cache
 * is wiped.
 */
export async function hasAnyChecklist(shopId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('daily_checklists')
    .select('shop_id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
  return (count ?? 0) > 0
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

/**
 * Most recent fridge/freezer reading from past checklists (excluding `excludeDate`).
 * Used to pre-fill today's form so owners with stable temperatures don't retype.
 */
export async function getPreviousTemps(
  shopId: string,
  excludeDate: string,
): Promise<{ fridge_temp: number | null; freezer_temp: number | null }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('daily_checklists')
    .select('fridge_temp, freezer_temp')
    .eq('shop_id', shopId)
    .neq('date', excludeDate)
    .or('fridge_temp.not.is.null,freezer_temp.not.is.null')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return {
    fridge_temp: (data?.fridge_temp as number | null) ?? null,
    freezer_temp: (data?.freezer_temp as number | null) ?? null,
  }
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
    waste_bins_ok: input.waste_bins_ok ?? null,
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
 * Phase 37g — streak status used by the reminders engine.
 * `daysSinceLastCompleted` = full days since the most recent checklist row
 * (0 = today). Returns `Infinity` when no rows exist yet.
 */
export async function getChecklistStreakStatus(
  shopId: string,
): Promise<{ daysSinceLastCompleted: number; completedToday: boolean }> {
  const supabase = await createClient()
  const today = todaySAST()
  const { data } = await supabase
    .from('daily_checklists')
    .select('date')
    .eq('shop_id', shopId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  const lastDate = (data as { date: string } | null)?.date ?? null
  if (!lastDate) {
    return { daysSinceLastCompleted: Number.POSITIVE_INFINITY, completedToday: false }
  }
  const todayMs = new Date(`${today}T00:00:00Z`).getTime()
  const lastMs = new Date(`${lastDate}T00:00:00Z`).getTime()
  const days = Math.max(0, Math.round((todayMs - lastMs) / 86400000))
  return { daysSinceLastCompleted: days, completedToday: lastDate === today }
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

