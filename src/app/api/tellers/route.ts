import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody, STABLE_READ_CACHE } from '@/lib/utils/api'
import { createAdminClient } from '@/lib/supabase/admin'
import { createTellerSchema } from '@/lib/validation/schemas'
import { provisionTellerAccount } from '@/lib/auth/teller'

export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase } = auth

  const { data, error } = await supabase
    .from('tellers')
    .select('*')
    .eq('active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: STABLE_READ_CACHE })
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createTellerSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, shopId, supabase } = auth

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only owners can add tellers' }, { status: 403 })
  }

  // Look up shop code (needed for synthetic email)
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('code')
    .eq('id', shopId)
    .single()
  if (shopError || !shop) return NextResponse.json({ error: 'Shop not found' }, { status: 500 })

  const { name, password } = parsed

  // Check for name conflict before provisioning
  const { data: existing } = await supabase
    .from('tellers')
    .select('id')
    .eq('shop_id', shopId)
    .ilike('name', name)
    .single()
  if (existing) {
    return NextResponse.json({ error: 'A teller with that name already exists' }, { status: 409 })
  }

  // Provision Supabase Auth account
  let authUserId: string
  try {
    const result = await provisionTellerAccount(name, shop.code, shopId, password)
    authUserId = result.authUserId
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create teller account'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const admin = createAdminClient()

  // Insert teller record
  const { data: teller, error: tellerError } = await supabase
    .from('tellers')
    .insert({ shop_id: shopId, name, user_id: authUserId })
    .select()
    .single()

  if (tellerError) {
    // Roll back the auth user
    await admin.auth.admin.deleteUser(authUserId)
    if (tellerError.code === '23505') {
      return NextResponse.json({ error: 'A teller with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: tellerError.message }, { status: 500 })
  }

  // Insert shop_users record
  const { error: shopUserError } = await supabase
    .from('shop_users')
    .insert({ shop_id: shopId, user_id: authUserId, role: 'teller' })

  if (shopUserError) {
    // Roll back
    await admin.auth.admin.deleteUser(authUserId)
    await supabase.from('tellers').delete().eq('id', teller.id)
    return NextResponse.json({ error: 'Failed to link teller to shop' }, { status: 500 })
  }

  return NextResponse.json(teller, { status: 201 })
}
