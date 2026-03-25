import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { listAllProductsWithBatches } from '@/lib/db/batches'

/** GET /api/stock/expiry — all products with expiry-tracked batches, grouped by urgency */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const products = await listAllProductsWithBatches(auth.shopId)
    return NextResponse.json({ products })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
