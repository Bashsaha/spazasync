import { createClient } from '@/lib/supabase/server'
import { sanitizeSearch } from '@/lib/utils/search'
import type { Product } from '@/types'

/** List all products for the current user's shop, optionally filtered by name or barcode. */
export async function listProducts(
  search?: string,
  opts?: { missingCost?: boolean; missingSupplier?: boolean },
): Promise<Product[]> {
  const supabase = await createClient()
  let query = supabase.from('products').select('*').order('name').limit(5000)
  if (search?.trim()) {
    const s = sanitizeSearch(search)
    query = query.or(`name.ilike.%${s}%,barcode.ilike.%${s}%`)
  }
  if (opts?.missingCost) {
    query = query.is('cost_price', null)
  }
  if (opts?.missingSupplier) {
    query = query.is('supplier_id', null)
  }
  const { data } = await query
  return (data as Product[]) ?? []
}

/** Get a single product by its UUID. */
export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*').eq('id', id).single()
  return (data as Product) ?? null
}

/** Get a product by barcode — used by the barcode scanner (Phase 5). */
export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*').eq('barcode', barcode).single()
  return (data as Product) ?? null
}

/** Create a new product. shop_id is derived from the user's JWT app_metadata. */
export async function createProduct(input: {
  barcode: string | null
  name: string
  price: number
  stock_qty: number
  supplier_id?: string | null
}): Promise<Product> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, shop_id: shopId })
    .select()
    .single()
  if (error) throw error
  return data as Product
}

/** Update product name, price, stock_qty, and/or supplier. Barcode is immutable. */
export async function updateProduct(
  id: string,
  input: { name?: string; price?: number; stock_qty?: number; supplier_id?: string | null },
): Promise<Product> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Product
}

/** Delete a product by UUID. RLS ensures only the shop owner can delete. */
export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}
