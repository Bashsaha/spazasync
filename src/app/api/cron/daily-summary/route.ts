import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDailySalesForShop, getLowStockForShop, getExpiringProductsForShop } from '@/lib/db/reports'
import { formatDailySummary } from '@/lib/whatsapp/format'
import { sendWhatsApp } from '@/lib/whatsapp/client'

/**
 * GET /api/cron/daily-summary
 *
 * Vercel Cron fires this at 20:00 UTC every day (22:00 SAST).
 * Validates the Authorization: Bearer <CRON_SECRET> header Vercel sends automatically.
 * Iterates every shop with a WhatsApp number and sends a daily summary.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date()

  // Only fetch shops that have a WhatsApp number configured
  const { data: shops, error: shopsError } = await admin
    .from('shops')
    .select('id, name, whatsapp_number, low_stock_threshold')
    .not('whatsapp_number', 'is', null)

  if (shopsError) {
    console.error('Failed to fetch shops:', shopsError)
    return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 })
  }

  let sent = 0
  let errors = 0

  for (const shop of shops ?? []) {
    // Defensive check — .not() filter should ensure this, but be explicit
    if (!shop.whatsapp_number) continue

    try {
      // All queries in getDailySalesForShop + getLowStockForShop are explicitly
      // scoped to shop.id — no cross-shop data leakage is possible.
      const [summary, lowStock, expiringProducts] = await Promise.all([
        getDailySalesForShop(shop.id, today),
        getLowStockForShop(shop.id, shop.low_stock_threshold),
        getExpiringProductsForShop(shop.id),
      ])

      const message = formatDailySummary(shop.name, summary, lowStock, expiringProducts, today)

      await sendWhatsApp(shop.whatsapp_number, message)
      sent++
    } catch (err) {
      // Per-shop errors are isolated — one failing shop doesn't block the others
      console.error(`Daily summary failed for shop ${shop.id} (${shop.name}):`, err)
      errors++
    }
  }

  return NextResponse.json({ sent, errors, total: (shops ?? []).length })
}
