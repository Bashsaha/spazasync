import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'

/**
 * GET /api/products/popular
 * Returns up to 10 product IDs ordered by total quantity sold in the last 30 days.
 * Used by ProductPicker to show "Top sellers" at the top of the list.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase } = auth

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Get sales IDs for this shop in the last 30 days (RLS scopes to user's shop)
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id')
    .gte('completed_at', thirtyDaysAgo)

  if (salesError) return NextResponse.json({ error: salesError.message }, { status: 500 })

  const saleIds = (sales ?? []).map((s) => s.id)
  if (saleIds.length === 0) return NextResponse.json({ popular: [] })

  // Get all sale items for those sales (RLS: sale_items via sale_id)
  const { data: items, error: itemsError } = await supabase
    .from('sale_items')
    .select('product_id, quantity')
    .in('sale_id', saleIds)

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  if (!items?.length) return NextResponse.json({ popular: [] })

  // Aggregate quantity sold per product
  const totals = new Map<string, number>()
  for (const item of items) {
    totals.set(item.product_id, (totals.get(item.product_id) ?? 0) + item.quantity)
  }

  // Return top 10 by total quantity, most sold first
  const popular = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  return NextResponse.json({ popular })
}
