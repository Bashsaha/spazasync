import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { saveStockTake } from '@/lib/db/stock-take'
import { stockTakeSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(request, stockTakeSchema)
  if (parsed instanceof NextResponse) return parsed

  try {
    const result = await saveStockTake(parsed.entries)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save stock take'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
