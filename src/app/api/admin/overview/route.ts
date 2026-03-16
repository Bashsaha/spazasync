import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { getOverviewStats } from '@/lib/db/admin'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const stats = await getOverviewStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('Admin overview error:', err)
    return NextResponse.json({ error: 'Failed to load overview stats' }, { status: 500 })
  }
}
