import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/account
 *
 * Permanently deletes the calling owner's account and their entire shop. This
 * is irreversible. After it runs, the owner's email / Google identity is freed
 * so they can sign up again from scratch.
 *
 * Order of operations (all via the service-role admin client):
 *   1. Collect the shop's teller auth user ids (before the shop is gone).
 *   2. Delete the shop row — ON DELETE CASCADE wipes shop_users, tellers,
 *      products, sales, stock-take entries and every other shop-scoped table.
 *   3. Delete each teller's auth user (frees their synthetic logins).
 *   4. Delete the owner's auth user LAST (cascades owner_profiles).
 *
 * Step 2 is best-effort: if a non-cascading FK ever blocks it we still proceed
 * to delete the auth users, which is what actually frees the email — orphaned
 * shop rows are RLS-invisible and harmless.
 *
 * Restricted to role === 'owner'. Admin accounts are managed via script and are
 * not self-deletable here.
 */
export async function DELETE() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, shopId } = auth
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner') {
    return NextResponse.json(
      { error: 'Only shop owners can delete their account here.' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()

  // 1. Teller auth users tied to this shop (exclude the owner's own row).
  const { data: tellerRows } = await admin
    .from('tellers')
    .select('user_id')
    .eq('shop_id', shopId)
    .not('user_id', 'is', null)

  const tellerUserIds = (tellerRows ?? [])
    .map((r) => r.user_id as string)
    .filter((id) => id && id !== user.id)

  // 2. Delete the shop — cascades all shop-scoped data. Best-effort.
  const { error: shopError } = await admin.from('shops').delete().eq('id', shopId)
  if (shopError) {
    console.warn('account delete: shop row delete failed (continuing):', shopError.message)
  }

  // 3. Delete teller auth users.
  for (const id of tellerUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) console.warn(`account delete: teller auth user ${id} failed:`, error.message)
  }

  // 4. Delete the owner's auth user last.
  const { error: ownerError } = await admin.auth.admin.deleteUser(user.id)
  if (ownerError) {
    return NextResponse.json(
      { error: 'Could not delete your account. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
