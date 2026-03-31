import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { z } from 'zod'

const bulkImportSchema = z.object({
  items: z
    .array(
      z.object({
        barcode: z.string().min(1),
        name: z.string().min(1),
        price: z.number().positive('Every product needs a price'),
      }),
    )
    .min(1)
    .max(200),
})

/**
 * POST /api/products/bulk-import
 * Imports selected catalog items into the shop's products with owner-set price, stock_qty=0.
 * Skips any barcode already present (by checking first, then inserting).
 */
export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId, supabase } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bulkImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { items } = parsed.data

  // Get barcodes already in the shop to avoid duplicates
  const barcodes = items.map((i) => i.barcode)
  const { data: existing } = await supabase
    .from('products')
    .select('barcode')
    .in('barcode', barcodes)

  const existingSet = new Set((existing ?? []).map((p) => p.barcode as string))
  const toInsert = items.filter((i) => !existingSet.has(i.barcode))
  const skipped = items.length - toInsert.length

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skipped })
  }

  const rows = toInsert.map((item) => ({
    shop_id: shopId,
    barcode: item.barcode,
    name: item.name,
    price: item.price,
    stock_qty: 0,
  }))

  const { data, error } = await supabase.from('products').insert(rows).select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: data?.length ?? 0, skipped })
}
