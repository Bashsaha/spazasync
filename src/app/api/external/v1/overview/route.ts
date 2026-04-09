import { NextResponse } from 'next/server'
import { requireExternalApi } from '@/lib/auth/external-api-guard'
import { getOverviewStats } from '@/lib/db/admin'

export async function GET(request: Request) {
  const denied = requireExternalApi(request)
  if (denied) return denied

  try {
    const stats = await getOverviewStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('External API /overview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
