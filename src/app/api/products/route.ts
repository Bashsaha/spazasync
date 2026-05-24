import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody, STABLE_READ_CACHE } from '@/lib/utils/api'
import { createProductSchema } from '@/lib/validation/schemas'
import { getCatalogEntry } from '@/lib/db/catalog'
import { barcodeCandidates } from '@/lib/utils/barcode'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const barcode = searchParams.get('barcode') ?? ''

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase } = auth

  // Barcode lookup: check shop products first, then fall back to shared catalog.
  // Match both UPC-A (12 digits) and EAN-13 (13 digits with leading zero) forms
  // — the same code in two representations. ZXing returned the 12-digit form;
  // Chrome's native BarcodeDetector returns the 13-digit form.
  if (barcode) {
    const candidates = barcodeCandidates(barcode)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('barcode', candidates)
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
  const missingSupplier = searchParams.get('missing_supplier') === '1'
  const missingCost = searchParams.get('missing_cost') === '1'

  let q = supabase.from('products').select('*').order('name').limit(5000)
  if (search) {
    q = q.or(`name.ilike.%${search}%,barcode.ilike.%${search}%`)
  }
  if (missingSupplier) q = q.is('supplier_id', null)
  if (missingCost) q = q.is('cost_price', null)
  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data }, { headers: STABLE_READ_CACHE })
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createProductSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId, supabase } = auth

  // When profit tracking is on, cost_price is mandatory
  const { data: shop } = await supabase
    .from('shops')
    .select('profit_tracking_enabled')
    .eq('id', shopId)
    .single()

  if (shop?.profit_tracking_enabled) {
    if (parsed.cost_price === undefined || parsed.cost_price === null) {
      return NextResponse.json(
        { error: 'Cost price is required when profit tracking is on', code: 'cost_required' },
        { status: 422 },
      )
    }
  }

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
