import { NextResponse } from 'next/server'
import { requireExternalApi } from '@/lib/auth/external-api-guard'
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

    const [products, lowStock] = await Promise.all([
      getProductsForShop(id),
      getLowStockForShop(id, threshold),
    ])

    return NextResponse.json({ products, lowStock })
  } catch (err) {
    console.error('External API /shops/[id]/stock error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
