import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/catalog/importable
 * Returns barcode_catalog entries whose barcode is not yet in this shop's products.
 * Owners use this to pick which catalog items to pre-load into their shop.
 */
export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase } = auth

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim().toLowerCase() ?? ''

  // Get barcodes already in this shop's products
  const { data: existing, error: existingError } = await supabase
    .from('products')
    .select('barcode')
    .not('barcode', 'is', null)

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  const existingSet = new Set((existing ?? []).map((p) => p.barcode as string))

  // Fetch entire catalog via admin client (catalog writes are service-role-only)
  const admin = createAdminClient()
  const { data: catalog, error: catalogError } = await admin
    .from('barcode_catalog')
    .select('barcode, name, category')
    .order('name')

  if (catalogError) return NextResponse.json({ error: catalogError.message }, { status: 500 })

  // Filter: not already in shop + optional search
  const items = (catalog ?? []).filter((c) => {
    if (existingSet.has(c.barcode)) return false
    if (!search) return true
    return (
      c.name.toLowerCase().includes(search) ||
      c.barcode.toLowerCase().includes(search)
    )
  })

  return NextResponse.json({ items })
}
