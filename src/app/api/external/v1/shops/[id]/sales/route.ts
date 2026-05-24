import { NextResponse } from 'next/server'
import { requireExternalApi } from '@/lib/auth/external-api-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getDailySalesForShop,
  getWeeklySalesForShop,
  getRecentSalesForShop,
  getTopProductsThisWeek,
} from '@/lib/db/reports'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireExternalApi(request)
  if (denied) return denied

  try {
    const { id } = await params
    // External API has no owner session — admin client required.
    const admin = createAdminClient()
    const [today, weekly, recent, topProducts] = await Promise.all([
      getDailySalesForShop(id, undefined, admin),
      getWeeklySalesForShop(id, undefined, undefined, admin),
      getRecentSalesForShop(id, undefined, admin),
      getTopProductsThisWeek(id, undefined, undefined, admin),
    ])

    return NextResponse.json({ today, weekly, recent, topProducts })
  } catch (err) {
    console.error('External API /shops/[id]/sales error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
