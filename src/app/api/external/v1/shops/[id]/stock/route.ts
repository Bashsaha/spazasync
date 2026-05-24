import { NextResponse } from 'next/server'
import { requireExternalApi } from '@/lib/auth/external-api-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProductsForShop, getLowStockForShop } from '@/lib/db/reports'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireExternalApi(request)
  if (denied) return denied

  try {
    const { id } = await params
    const url = new URL(request.url)
    const threshold = parseInt(url.searchParams.get('threshold') ?? '5', 10) || 5

    // External API has no owner session — pass the admin client so RLS
    // doesn't block the read.
    const admin = createAdminClient()
    const [products, lowStock] = await Promise.all([
      getProductsForShop(id, admin),
      getLowStockForShop(id, threshold, admin),
    ])

    return NextResponse.json({ products, lowStock })
  } catch (err) {
    console.error('External API /shops/[id]/stock error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
