import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateShopSettingsSchema } from '@/lib/validation/schemas'

async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) return null
  return { user, shopId }
}

/**
 * GET /api/settings
 * Returns the current shop settings for the logged-in owner.
 */
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, name, code, whatsapp_number, low_stock_threshold')
    .eq('id', ctx.shopId)
    .single()

  if (error || !shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
  }

  return NextResponse.json(shop)
}

/**
 * PATCH /api/settings
 * Updates shop name, WhatsApp number, and low-stock threshold.
 * Shop code cannot be changed.
 */
export async function PATCH(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = updateShopSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  // Verify the authenticated user is the owner of this shop
  const { data: shopUser } = await admin
    .from('shop_users')
    .select('role')
    .eq('user_id', ctx.user.id)
    .eq('shop_id', ctx.shopId)
    .single()

  if (shopUser?.role !== 'owner') {
    return NextResponse.json({ error: 'Only the shop owner can change settings' }, { status: 403 })
  }

  const { name, whatsapp_number, low_stock_threshold } = parsed.data

  const { data: updated, error } = await admin
    .from('shops')
    .update({ name, whatsapp_number: whatsapp_number ?? null, low_stock_threshold })
    .eq('id', ctx.shopId)
    .select('id, name, code, whatsapp_number, low_stock_threshold')
    .single()

  if (error) {
    console.error('Failed to update shop settings:', error)
    return NextResponse.json({ error: 'Could not save settings' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
