import { NextResponse } from 'next/server'
import { requireExternalApi } from '@/lib/auth/external-api-guard'
import { getShopDetail } from '@/lib/db/admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireExternalApi(request)
  if (denied) return denied

  try {
    const { id } = await params
    const shop = await getShopDetail(id)
    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }
    return NextResponse.json(shop)
  } catch (err) {
    console.error('External API /shops/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
