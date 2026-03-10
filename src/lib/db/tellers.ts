import { createClient } from '@/lib/supabase/server'
import type { Teller } from '@/types'

/** List all active tellers for the current user's shop. */
export async function listTellers(): Promise<Teller[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tellers')
    .select('*')
    .eq('active', true)
    .order('name')
  return (data as Teller[]) ?? []
}

/** Get the teller record linked to the currently logged-in teller account. */
export async function getMyTellerRecord(): Promise<Teller | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('tellers')
    .select('*')
    .eq('user_id', user.id)
    .single()
  return (data as Teller) ?? null
}

/** Set a teller as inactive (soft delete). */
export async function deactivateTeller(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('tellers').update({ active: false }).eq('id', id)
  if (error) throw error
}
