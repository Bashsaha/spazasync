import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'

const bulkSupplierSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1).max(500),
  supplier_id: z.string().uuid(),
})

/**
 * Bulk-assign a supplier to multiple products in one request.
 * Used by /suppliers/assign to clear the "products without supplier" backlog
 * in one go instead of opening each product page individually.
 *
 * RLS scopes both reads and writes to the caller's shop, so we don't need a
 * defensive shop_id filter — the .update().in() is safe.
 */
export async function PATCH(request: Request) {
  const parsed = await parseBody(request, bulkSupplierSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId, supabase } = auth

  // Verify supplier belongs to caller's shop before assigning — otherwise a
  // malicious client could attach products to a supplier from another shop.
  const { data: supplier, error: supplierErr } = await supabase
    .from('suppliers')
    .select('id')
    .eq('id', parsed.supplier_id)
    .eq('shop_id', shopId)
    .maybeSingle()
  if (supplierErr) return NextResponse.json({ error: supplierErr.message }, { status: 500 })
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('products')
    .update({ supplier_id: parsed.supplier_id })
    .in('id', parsed.product_ids)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: data?.length ?? 0 })
}
