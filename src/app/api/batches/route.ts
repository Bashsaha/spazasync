import { NextRequest, NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { addBatchSchema } from '@/lib/validation/schemas'
import { listBatchesForProduct, addBatch } from '@/lib/db/batches'
import { checkRateLimit } from '@/lib/utils/rateLimit'

/**
 * GET /api/batches?product_id=<uuid>
 * List non-zero batches for a product (earliest expiry first).
 */
export async function GET(request: NextRequest) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const productId = request.nextUrl.searchParams.get('product_id')
  if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

  try {
    const batches = await listBatchesForProduct(productId)
    return NextResponse.json(batches)
  } catch (err) {
    console.error('[GET /api/batches] Error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/**
 * POST /api/batches
 * Add a batch with an expiry date. Also increments the product's stock_qty.
 */
export async function POST(request: NextRequest) {
  const { limited } = await checkRateLimit(request, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = addBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const batch = await addBatch(parsed.data)
    return NextResponse.json(batch, { status: 201 })
  } catch (err) {
    console.error('[POST /api/batches] Error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
