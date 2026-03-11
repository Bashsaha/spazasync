import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listProductsWithStock, adjustStock } from '@/lib/db/stock'
import { stockAdjustSchema } from '@/lib/validation/schemas'

/** GET /api/stock?search= — list products with stock levels */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? undefined

  try {
    const result = await listProductsWithStock(search)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST /api/stock — adjust stock qty for a product */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = stockAdjustSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const updated = await adjustStock({
      product_id: parsed.data.product_id,
      qty_delta: parsed.data.qty_delta,
      reason: parsed.data.reason,
    })
    return NextResponse.json(updated, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
