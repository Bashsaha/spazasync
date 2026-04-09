import { NextResponse } from 'next/server'
import { requireExternalApi } from '@/lib/auth/external-api-guard'
import { getExpiringProductsForShop } from '@/lib/db/reports'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireExternalApi(request)
  if (denied) return denied

  try {
    const { id } = await params
    const expiring = await getExpiringProductsForShop(id)
    return NextResponse.json(expiring)
  } catch (err) {
    console.error('External API /shops/[id]/expiry error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
