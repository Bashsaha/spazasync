import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { adminStoreListQuerySchema } from '@/lib/validation/schemas'
import { listShops } from '@/lib/db/admin'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = adminStoreListQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const { shops, total } = await listShops(parsed.data)
    return NextResponse.json({
      shops,
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    })
  } catch (err) {
    console.error('Admin shops list error:', err)
    return NextResponse.json({ error: 'Failed to load shops' }, { status: 500 })
  }
}
