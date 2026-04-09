import { NextResponse } from 'next/server'
import { requireExternalApi } from '@/lib/auth/external-api-guard'
import { listShops } from '@/lib/db/admin'
import type { SubscriptionStatus } from '@/types'

export async function GET(request: Request) {
  const denied = requireExternalApi(request)
  if (denied) return denied

  try {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))
    const search = url.searchParams.get('search') ?? undefined
    const status = url.searchParams.get('status') as SubscriptionStatus | undefined

    const result = await listShops({ page, limit, search, status })
    return NextResponse.json(result)
  } catch (err) {
    console.error('External API /shops error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
