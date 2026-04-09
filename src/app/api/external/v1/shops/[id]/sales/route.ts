import { NextResponse } from 'next/server'
import { requireExternalApi } from '@/lib/auth/external-api-guard'
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
    const [today, weekly, recent, topProducts] = await Promise.all([
      getDailySalesForShop(id),
      getWeeklySalesForShop(id),
      getRecentSalesForShop(id),
      getTopProductsThisWeek(id),
    ])

    return NextResponse.json({ today, weekly, recent, topProducts })
  } catch (err) {
    console.error('External API /shops/[id]/sales error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
