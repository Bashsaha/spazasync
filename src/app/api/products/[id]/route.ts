import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { updateProductSchema } from '@/lib/validation/schemas'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase } = auth

  const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const parsed = await parseBody(request, updateProductSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase } = auth

  // cost_price is always optional — it may be set, cleared, or left untouched
  // regardless of the profit-tracking toggle. A product without a cost just
  // shows up in the missing-cost nudge and is skipped in profit math.

  const { data, error } = await supabase
    .from('products')
    .update(parsed)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      const msg = (error.message ?? '').toLowerCase()
      if (msg.includes('name')) {
        return NextResponse.json(
          { error: 'You already have a product called that' },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: 'A product with that barcode already exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Product not found or update failed' }, { status: 404 })
  }
  if (!data)
    return NextResponse.json({ error: 'Product not found or update failed' }, { status: 404 })
  return NextResponse.json(data)
}

