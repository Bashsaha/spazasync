import { NextRequest, NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { removeBatch } from '@/lib/db/batches'
import { checkRateLimit } from '@/lib/utils/rateLimit'

/**
 * DELETE /api/batches/[id]
 * Discard a batch (set qty to 0) and decrement the product's stock_qty.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { limited } = checkRateLimit(request, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await removeBatch(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
