import { createClient } from '@/lib/supabase/server'
import type { CreatePestControlLogInput, PestControlLog } from '@/types'

export { isPestOverdue, PEST_REMIND_DAYS, daysSince } from '@/lib/compliance/waste-pest-status'

/** List pest control visits for the current user's shop, most recent first. */
export async function listPestControlLogs(): Promise<PestControlLog[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pest_control_logs')
    .select('*')
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false })
  return (data as PestControlLog[]) ?? []
}

/** Get the most recent visit date (YYYY-MM-DD) for the current user's shop, or null. */
export async function getLastPestVisitDate(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pest_control_logs')
    .select('visit_date')
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { visit_date: string } | null)?.visit_date ?? null
}

/** Create a pest control log. shop_id + created_by derived from the JWT. */
export async function createPestControlLog(
  input: CreatePestControlLogInput,
): Promise<PestControlLog> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const { data, error } = await supabase
    .from('pest_control_logs')
    .insert({
      shop_id: shopId,
      visit_date: input.visit_date,
      provider_name: input.provider_name,
      treatment_type: input.treatment_type,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return data as PestControlLog
}

/** Delete a pest control log by UUID. RLS enforces shop ownership. */
export async function deletePestControlLog(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('pest_control_logs').delete().eq('id', id)
  if (error) throw error
}
