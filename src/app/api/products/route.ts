import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createProductSchema } from '@/lib/validation/schemas'
import { getCatalogEntry } from '@/lib/db/catalog'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const barcode = searchParams.get('barcode') ?? ''

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) return NextResponse.json({ error: 'No shop found' }, { status: 403 })

  const { data, error } = await supabase
    .from('products')
    .insert({ ...parsed.data, shop_id: shopId })
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
