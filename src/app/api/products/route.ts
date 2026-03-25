import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { createProductSchema } from '@/lib/validation/schemas'
import { getCatalogEntry } from '@/lib/db/catalog'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const barcode = searchParams.get('barcode') ?? ''

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase } = auth

  // Barcode lookup: check shop products first, then fall back to shared catalog
  if (barcode) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (data && data.length > 0) {
      return NextResponse.json({ products: data })
    }

    // Not in shop's products — check shared catalog for a name suggestion
    try {
      const catalogHit = await getCatalogEntry(supabase, barcode)
      return NextResponse.json({
        products: [],
        catalog_suggestion: catalogHit ?? undefined,
      })
    } catch {
      return NextResponse.json({ products: [] })
    }
  }

  // Search or list all — no catalog fallback needed
  const base = supabase.from('products').select('*').order('name')
  const { data, error } = search
    ? await base.or(`name.ilike.%${search}%,barcode.ilike.%${search}%`)
    : await base

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data })
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createProductSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId, supabase } = auth

  const { data, error } = await supabase
    .from('products')
    .insert({ ...parsed, shop_id: shopId })
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
