import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { completeSale } from '@/lib/db/sales'
import { completeSaleSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(request, completeSaleSchema)
  if (parsed instanceof NextResponse) return parsed

  try {
    const sale = await completeSale(parsed)
    return NextResponse.json(sale, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete sale'

    // stock_qty >= 0 constraint violation
    if (message.includes('stock_qty') || message.includes('check')) {
      return NextResponse.json(
        { error: 'Not enough stock for one or more items.' },
        { status: 422 },
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
