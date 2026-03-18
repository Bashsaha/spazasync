import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BarcodeCatalogEntry } from '@/types'

/**
 * Look up a barcode in the shared catalog.
 * Uses the user's authenticated client (RLS allows SELECT for all).
 */
export async function getCatalogEntry(
  supabase: SupabaseClient,
  barcode: string,
): Promise<{ barcode: string; name: string } | null> {
  const { data, error } = await supabase
    .from('barcode_catalog')
    .select('barcode, name')
    .eq('barcode', barcode)
    .maybeSingle()

  if (error) throw error
  return data
}

// ── Admin CRUD (service role) ──────────────────────────────

/**
 * List catalog entries with optional search and pagination.
 */
export async function listCatalogEntries(opts: {
  search?: string
  page: number
  limit: number
}): Promise<{ entries: BarcodeCatalogEntry[]; total: number }> {
  const admin = createAdminClient()

  let query = admin
    .from('barcode_catalog')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })

  if (opts.search) {
    query = query.or(`barcode.ilike.%${opts.search}%,name.ilike.%${opts.search}%`)
  }

  const from = (opts.page - 1) * opts.limit
  const to = from + opts.limit - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) throw error
  return { entries: (data ?? []) as BarcodeCatalogEntry[], total: count ?? 0 }
}

/**
 * Get a single catalog entry by ID (admin).
 */
export async function getCatalogEntryById(
  id: string,
): Promise<BarcodeCatalogEntry | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('barcode_catalog')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as BarcodeCatalogEntry | null
}

/**
 * Create a new catalog entry.
 */
export async function createCatalogEntry(
  barcode: string,
  name: string,
  category?: string | null,
): Promise<BarcodeCatalogEntry> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('barcode_catalog')
    .insert({ barcode, name, category: category ?? null })
    .select()
    .single()

  if (error) throw error
  return data as BarcodeCatalogEntry
}

/**
 * Update an existing catalog entry.
 */
export async function updateCatalogEntry(
  id: string,
  updates: { name?: string; category?: string | null },
): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('barcode_catalog')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

/**
 * Delete a catalog entry by ID.
 */
export async function deleteCatalogEntry(id: string): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('barcode_catalog')
    .delete()
    .eq('id', id)

  if (error) throw error
}
