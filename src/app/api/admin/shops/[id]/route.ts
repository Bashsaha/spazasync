import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { getShopDetail } from '@/lib/db/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const detail = await getShopDetail(id)
    if (!detail) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (err) {
    console.error('Admin shop detail error:', err)
    return NextResponse.json({ error: 'Failed to load shop detail' }, { status: 500 })
  }
}
