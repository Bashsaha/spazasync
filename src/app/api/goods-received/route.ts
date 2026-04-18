import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { createGoodsReceivedSchema } from '@/lib/validation/schemas'
import { logGoodsReceived, listGoodsReceived } from '@/lib/db/goods-received'

export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('product_id') ?? undefined
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || 100)) : undefined

  try {
    const rows = await listGoodsReceived({ productId, from, to, limit })
    return NextResponse.json(rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list goods received'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createGoodsReceivedSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const entry = await logGoodsReceived(parsed)
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to log goods received'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
