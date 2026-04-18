import { createClient } from '@/lib/supabase/server'
import type { Supplier } from '@/types'

/** List all suppliers for the current user's shop. */
export async function listSuppliers(): Promise<Supplier[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('suppliers').select('*').order('name')
  return (data as Supplier[]) ?? []
}

/** Get a single supplier by UUID. */
export async function getSupplier(id: string): Promise<Supplier | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('suppliers').select('*').eq('id', id).single()
  return (data as Supplier) ?? null
}

/** Create a new supplier. shop_id derived from user JWT. */
export async function createSupplier(input: {
  name: string
  contact_number?: string | null
  type?: string | null
  location?: string | null
}): Promise<Supplier> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...input, shop_id: shopId })
    .select()
    .single()
  if (error) throw error
  return data as Supplier
}

/** Update a supplier by UUID. */
export async function updateSupplier(
  id: string,
  input: { name?: string; contact_number?: string | null; type?: string | null; location?: string | null },
): Promise<Supplier> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Supplier
}

/** Delete a supplier by UUID. RLS ensures only the shop owner can delete. */
export async function deleteSupplier(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}
