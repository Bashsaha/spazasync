import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'

/**
 * GET /api/account/export
 *
 * POPIA "right of access" — owner-self-service data export. Returns a single
 * JSON file containing every row Movestock holds about the owner + their
 * shop. Triggered from Settings → "Your data".
 *
 * Owner-only (tellers don't own the shop's data). Subscription-exempt —
 * Section 23 of POPIA grants the data subject the right of access regardless
 * of subscription state.
 *
 * Implementation notes:
 *   - Uses the admin client because POPIA covers EVERY column we hold,
 *     including a few that RLS would hide from the owner's own view (e.g.
 *     admin_notes on shops). Suppressing those would actively misrepresent
 *     the access right.
 *   - The export is read-only. No mutation, no PII leak risk beyond what the
 *     owner already has access to from their own dashboard.
 *   - Synthetic teller emails (`{slug}@shop-{code}.spazasync.app`) are not
 *     personal data in the POPIA sense — they're machine-generated routing
 *     tokens, not the person's real email. We DO include the teller `name`
 *     they chose at provisioning.
 *
 * The browser receives a Content-Disposition: attachment header so the file
 * downloads instead of opening inline.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, shopId } = auth
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner') {
    return NextResponse.json(
      { error: 'Only shop owners can export account data.' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()

  // Pull everything in parallel. Each table is explicitly scoped to the
  // owner's shop_id or user_id; nothing crosses shop boundaries.
  const [
    shopRes,
    tellersRes,
    productsRes,
    productBatchesRes,
    salesRes,
    saleItemsRes,
    suppliersRes,
    goodsReceivedRes,
    stockAdjustmentsRes,
    stockTakeEntriesRes,
    dailyChecklistsRes,
    businessDocumentsRes,
    pestControlLogsRes,
    wasteManagementRes,
    accessRequestsRes,
    complianceRemindersRes,
    ownerProfileRes,
  ] = await Promise.all([
    admin.from('shops').select('*').eq('id', shopId).maybeSingle(),
    admin.from('tellers').select('id, name, active, food_safety_trained_at, created_at').eq('shop_id', shopId),
    admin.from('products').select('*').eq('shop_id', shopId),
    admin.from('product_batches').select('*').eq('shop_id', shopId),
    admin.from('sales').select('*').eq('shop_id', shopId),
    admin
      .from('sale_items')
      .select('*, sales!inner(shop_id)')
      .eq('sales.shop_id', shopId),
    admin.from('suppliers').select('*').eq('shop_id', shopId),
    admin.from('goods_received').select('*').eq('shop_id', shopId),
    admin.from('stock_adjustments').select('*').eq('shop_id', shopId),
    admin.from('stock_take_entries').select('*').eq('shop_id', shopId),
    admin.from('daily_checklists').select('*').eq('shop_id', shopId),
    admin.from('business_documents').select('*').eq('shop_id', shopId),
    admin.from('pest_control_logs').select('*').eq('shop_id', shopId),
    admin.from('waste_management').select('*').eq('shop_id', shopId).maybeSingle(),
    admin.from('access_requests').select('*').eq('shop_id', shopId),
    admin.from('compliance_reminders').select('*').eq('shop_id', shopId),
    admin.from('owner_profiles').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  const exportedAt = new Date().toISOString()
  const dateForFilename = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')
  const shopCode = (shopRes.data?.code as string | undefined) ?? 'shop'

  const payload = {
    movestock_export_version: 1,
    exported_at: exportedAt,
    exported_for: {
      email: user.email,
      user_id: user.id,
    },
    shop: shopRes.data ?? null,
    owner_profile: ownerProfileRes.data ?? null,
    tellers: tellersRes.data ?? [],
    products: productsRes.data ?? [],
    product_batches: productBatchesRes.data ?? [],
    suppliers: suppliersRes.data ?? [],
    goods_received: goodsReceivedRes.data ?? [],
    sales: salesRes.data ?? [],
    // Sale items come back with the `sales!inner(shop_id)` join key attached
    // — strip it before emitting so the export only contains the column
    // schema the caller can map straight back to the table.
    sale_items:
      (saleItemsRes.data ?? []).map((row) => {
        const { sales, ...rest } = row as Record<string, unknown> & { sales?: unknown }
        void sales
        return rest
      }),
    stock_adjustments: stockAdjustmentsRes.data ?? [],
    stock_take_entries: stockTakeEntriesRes.data ?? [],
    daily_checklists: dailyChecklistsRes.data ?? [],
    business_documents: businessDocumentsRes.data ?? [],
    pest_control_logs: pestControlLogsRes.data ?? [],
    waste_management: wasteManagementRes.data ?? null,
    access_requests: accessRequestsRes.data ?? [],
    compliance_reminders: complianceRemindersRes.data ?? [],
  }

  const filename = `movestock-export-${shopCode}-${dateForFilename}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
