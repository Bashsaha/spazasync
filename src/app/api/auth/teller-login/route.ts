import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildTellerEmail } from '@/lib/auth/teller'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { z } from 'zod'

const schema = z.object({
  shopCode: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  tellerName: z.string().min(1).max(100),
})

/**
 * POST /api/auth/teller-login
 * Body: { shopCode, tellerName }
 *
 * Validates the teller exists in the shop, then returns the synthetic email
 * so the client can call supabase.auth.signInWithPassword().
 *
 * Does NOT perform the actual sign-in — that stays client-side so
 * the session cookie is set correctly by @supabase/ssr.
 */
export async function POST(request: Request) {
  const { limited } = checkRateLimit(request, { limit: 10, windowSecs: 60 })
  if (limited) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a minute and try again.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid shop code or name' }, { status: 400 })
  }

  const { shopCode, tellerName } = parsed.data
  const admin = createAdminClient()

  // Look up the shop by code
  const { data: shop, error: shopError } = await admin
    .from('shops')
    .select('id')
    .eq('code', shopCode)
    .single()

  if (shopError || !shop) {
    return NextResponse.json(
      { error: 'Shop not found. Check your shop code.' },
      { status: 404 },
    )
  }

  // Check the teller exists and has a login (user_id set)
  const { data: teller, error: tellerError } = await admin
    .from('tellers')
    .select('id, user_id, name')
    .eq('shop_id', shop.id)
    .eq('active', true)
    .ilike('name', tellerName.trim())  // case-insensitive name match
    .single()

  if (tellerError || !teller) {
    return NextResponse.json(
      { error: 'Teller not found. Check your name.' },
      { status: 404 },
    )
  }

  if (!teller.user_id) {
    return NextResponse.json(
      { error: 'This teller does not have a login yet. Ask your owner to set one up.' },
      { status: 403 },
    )
  }

  // Return the synthetic email — client will use this to call signInWithPassword
  const syntheticEmail = buildTellerEmail(teller.name, shopCode)

  return NextResponse.json({ syntheticEmail })
}
