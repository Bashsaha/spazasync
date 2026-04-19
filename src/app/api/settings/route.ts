import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateShopSettingsSchema } from '@/lib/validation/schemas'

/**
 * GET /api/settings
 * Returns the current shop settings for the logged-in owner.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: shop, error } = await auth.supabase
    .from('shops')
    .select('id, name, code, whatsapp_number, low_stock_threshold, registration_number, location, language, profit_tracking_enabled, has_fridge, has_freezer, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('id', auth.shopId)
    .single()

  if (error || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  // Count products missing cost_price — used by UI to nudge owner when toggle is on
  const { count: missingCostCount } = await auth.supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', auth.shopId)
    .is('cost_price', null)

  return NextResponse.json({ ...shop, products_missing_cost: missingCostCount ?? 0 })
}

/**
 * PATCH /api/settings
 * Updates shop name, low-stock threshold, and other shop details.
 * Shop code cannot be changed.
 */
export async function PATCH(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(request, updateShopSettingsSchema)
  if (parsed instanceof NextResponse) return parsed

  const admin = createAdminClient()

  // Verify the authenticated user is the owner of this shop
  const { data: shopUser } = await admin
    .from('shop_users')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('shop_id', auth.shopId)
    .single()

  if (shopUser?.role !== 'owner') {
    return NextResponse.json({ error: 'Only the shop owner can change settings' }, { status: 403 })
  }

  const { name, low_stock_threshold, registration_number, location, language, profit_tracking_enabled, has_fridge, has_freezer } = parsed

  const updatePayload: Record<string, unknown> = {
    name,
    low_stock_threshold,
    registration_number: registration_number ?? null,
    location: location ?? null,
  }
  if (language) updatePayload.language = language
  if (typeof profit_tracking_enabled === 'boolean') {
    updatePayload.profit_tracking_enabled = profit_tracking_enabled
  }
  if (typeof has_fridge === 'boolean') updatePayload.has_fridge = has_fridge
  if (typeof has_freezer === 'boolean') updatePayload.has_freezer = has_freezer

  const { data: updated, error } = await admin
    .from('shops')
    .update(updatePayload)
    .eq('id', auth.shopId)
    .select('id, name, code, whatsapp_number, low_stock_threshold, registration_number, location, language, profit_tracking_enabled, has_fridge, has_freezer')
    .single()

  if (error) {
    console.error('Failed to update shop settings:', error)
    return NextResponse.json({ error: 'Could not save settings' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
