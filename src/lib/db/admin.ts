import { createAdminClient } from '@/lib/supabase/admin'
import { updateShopUsersSubscription } from '@/lib/auth/teller'
import type { AdminOverviewStats, AdminShopListItem, AdminPayment, SubscriptionStatus } from '@/types'

/**
 * Get aggregate stats for the admin overview dashboard.
 */
export async function getOverviewStats(): Promise<AdminOverviewStats> {
  const admin = createAdminClient()

  const { data: shops, error } = await admin
    .from('shops')
    .select('subscription_status, created_at')

  if (error) throw error

  const all = shops ?? []
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  return {
    totalShops: all.length,
    activeShops: all.filter((s) => s.subscription_status === 'active').length,
    trialingShops: all.filter((s) => s.subscription_status === 'trialing').length,
    expiredShops: all.filter((s) => s.subscription_status === 'expired').length,
    manualOverrideShops: all.filter((s) => s.subscription_status === 'manual_override').length,
    recentSignUps: all.filter((s) => new Date(s.created_at) >= sevenDaysAgo).length,
  }
}

/**
 * List shops with search, status filter, and pagination.
 * Joins owner email via auth admin API and last payment via admin_payments.
 */
export async function listShops(opts: {
  search?: string
  status?: SubscriptionStatus
  page: number
  limit: number
}): Promise<{ shops: AdminShopListItem[]; total: number }> {
  const admin = createAdminClient()

  let query = admin
    .from('shops')
    .select('id, name, code, whatsapp_number, subscription_status, access_granted, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (opts.search) {
    query = query.or(`name.ilike.%${opts.search}%,code.ilike.%${opts.search}%`)
  }
  if (opts.status) {
    query = query.eq('subscription_status', opts.status)
  }

  const from = (opts.page - 1) * opts.limit
  const to = from + opts.limit - 1
  query = query.range(from, to)

  const { data: shops, count, error } = await query

  if (error) throw error
  if (!shops || shops.length === 0) return { shops: [], total: count ?? 0 }

  const shopIds = shops.map((s) => s.id)

  // Get owner user_ids for these shops
  const { data: owners } = await admin
    .from('shop_users')
    .select('shop_id, user_id')
    .in('shop_id', shopIds)
    .eq('role', 'owner')

  // Build email lookup via auth admin API
  // NOTE: listUsers has a max of 1000 per page — sufficient for early scale
  const emailMap = new Map<string, string>()
  if (owners && owners.length > 0) {
    const ownerUserIds = new Set(owners.map((o) => o.user_id))
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (authData?.users) {
      for (const u of authData.users) {
        if (ownerUserIds.has(u.id)) {
          emailMap.set(u.id, u.email ?? '')
        }
      }
    }
  }

  // Owner user_id per shop
  const ownerByShop = new Map<string, string>()
  for (const o of owners ?? []) {
    ownerByShop.set(o.shop_id, o.user_id)
  }

  // Last payment per shop
  const { data: payments } = await admin
    .from('admin_payments')
    .select('shop_id, recorded_at')
    .in('shop_id', shopIds)
    .order('recorded_at', { ascending: false })

  const lastPaymentMap = new Map<string, string>()
  for (const p of payments ?? []) {
    if (!lastPaymentMap.has(p.shop_id)) {
      lastPaymentMap.set(p.shop_id, p.recorded_at)
    }
  }

  const result: AdminShopListItem[] = shops.map((s) => {
    const ownerUserId = ownerByShop.get(s.id)
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      whatsapp_number: s.whatsapp_number,
      subscription_status: s.subscription_status as SubscriptionStatus,
      access_granted: s.access_granted,
      created_at: s.created_at,
      owner_email: ownerUserId ? emailMap.get(ownerUserId) ?? null : null,
      last_payment_at: lastPaymentMap.get(s.id) ?? null,
    }
  })

  return { shops: result, total: count ?? 0 }
}

/**
 * Get full shop detail for admin view.
 */
export async function getShopDetail(shopId: string) {
  const admin = createAdminClient()

  const [shopResult, paymentsResult, tellerResult, productResult, salesResult] =
    await Promise.allSettled([
      admin.from('shops').select('*').eq('id', shopId).single(),
      admin.from('admin_payments').select('*').eq('shop_id', shopId).order('recorded_at', { ascending: false }),
      admin.from('tellers').select('id').eq('shop_id', shopId).eq('active', true),
      admin.from('products').select('id').eq('shop_id', shopId),
      admin.from('sales').select('id').eq('shop_id', shopId).gte(
        'completed_at',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      ),
    ])

  if (shopResult.status === 'rejected' || shopResult.value.error || !shopResult.value.data) {
    return null
  }

  const shop = shopResult.value.data

  // Get owner email
  let ownerEmail: string | null = null
  const { data: ownerRow } = await admin
    .from('shop_users')
    .select('user_id')
    .eq('shop_id', shopId)
    .eq('role', 'owner')
    .single()

  if (ownerRow) {
    const { data: authData } = await admin.auth.admin.getUserById(ownerRow.user_id)
    ownerEmail = authData?.user?.email ?? null
  }

  return {
    ...shop,
    owner_email: ownerEmail,
    payments: paymentsResult.status === 'fulfilled' ? (paymentsResult.value.data ?? []) as AdminPayment[] : [],
    teller_count: tellerResult.status === 'fulfilled' ? (tellerResult.value.data?.length ?? 0) : 0,
    product_count: productResult.status === 'fulfilled' ? (productResult.value.data?.length ?? 0) : 0,
    recent_sales_count: salesResult.status === 'fulfilled' ? (salesResult.value.data?.length ?? 0) : 0,
  }
}

/**
 * Record a manual payment and optionally activate subscription.
 */
export async function recordManualPayment(
  data: {
    shop_id: string
    amount: number
    method: 'eft' | 'cash' | 'card' | 'other'
    reference?: string
    notes?: string
    activate_subscription: boolean
  },
  adminUserId: string,
): Promise<AdminPayment> {
  const admin = createAdminClient()

  const { data: payment, error } = await admin
    .from('admin_payments')
    .insert({
      shop_id: data.shop_id,
      amount: data.amount,
      method: data.method,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      recorded_by: adminUserId,
    })
    .select()
    .single()

  if (error) throw error

  if (data.activate_subscription) {
    const subEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { error: updateErr } = await admin
      .from('shops')
      .update({
        subscription_status: 'manual_override',
        subscription_ends_at: subEndsAt,
        access_granted: true,
      })
      .eq('id', data.shop_id)

    if (updateErr) throw updateErr

    await updateShopUsersSubscription(data.shop_id, 'manual_override', subEndsAt, true)
  }

  return payment as AdminPayment
}

/**
 * Toggle shop access_granted flag and sync JWT metadata.
 */
export async function toggleShopAccess(shopId: string, accessGranted: boolean): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('shops')
    .update({ access_granted: accessGranted })
    .eq('id', shopId)

  if (error) throw error

  // Fetch current subscription info to sync metadata
  const { data: shop } = await admin
    .from('shops')
    .select('subscription_status, subscription_ends_at, trial_ends_at')
    .eq('id', shopId)
    .single()

  if (shop) {
    const subUntil = shop.subscription_ends_at ?? shop.trial_ends_at ?? ''
    await updateShopUsersSubscription(shopId, shop.subscription_status, subUntil, accessGranted)
  }
}

/**
 * Update admin notes for a shop.
 */
export async function updateShopNotes(shopId: string, notes: string): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('shops')
    .update({ admin_notes: notes })
    .eq('id', shopId)

  if (error) throw error
}
