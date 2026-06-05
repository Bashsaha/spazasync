import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { buildTellerEmail } from '@/lib/auth/teller'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { LOCALE_COOKIE, localeCookieOptions, parseLocale } from '@/lib/i18n/locale-cookie'
import { z } from 'zod'

const schema = z.object({
  shopCode: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  tellerName: z.string().min(1).max(100),
  pin: z.string().min(1).max(100),
})

/**
 * POST /api/auth/teller-login
 * Body: { shopCode, tellerName, pin }
 *
 * Validates the teller exists in the shop, then performs the PIN sign-in
 * SERVER-SIDE (setting the session cookies via @supabase/ssr) and returns
 * { ok: true }. The client then hard-navigates to /sale (BUG-043).
 *
 * Why server-side: the rate limiter below (10/min per IP) only gates a PIN
 * brute-force if the actual signInWithPassword runs HERE. The previous design
 * returned only the synthetic email and let the CLIENT call signInWithPassword
 * straight to Supabase Auth — bypassing this limiter entirely (a 6-digit PIN is
 * only 1,000,000 combinations). Keeping the sign-in server-side closes that,
 * and — per BUG-043 — the session is established server-side before the client's
 * hard nav, so it can never race the cookie write.
 */
export async function POST(request: Request) {
  const { limited } = await checkRateLimit(request, { limit: 10, windowSecs: 60 })
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

  const { shopCode, tellerName, pin } = parsed.data
  const admin = createAdminClient()

  // Look up the shop by code
  const { data: shop, error: shopError } = await admin
    .from('shops')
    .select('id, language')
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

  // Perform the PIN sign-in SERVER-SIDE so the rate limit above actually gates
  // brute-force attempts. The @supabase/ssr server client writes the session
  // cookies onto this response via the next/headers cookie store (same proven
  // pattern as /auth/callback); the client then hard-navigates to /sale.
  const syntheticEmail = buildTellerEmail(teller.name, shopCode)
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password: pin,
  })

  if (signInError) {
    // Generic message — don't reveal anything beyond "the PIN was wrong".
    return NextResponse.json(
      { error: 'Incorrect PIN. Please try again.' },
      { status: 401 },
    )
  }

  // Pre-set the locale cookie to the shop's language so the first /sale render
  // after sign-in already has the right translations hydrated server-side.
  const cookieLocale = parseLocale(shop.language as string | undefined)
  if (cookieLocale) {
    const store = await cookies()
    store.set(LOCALE_COOKIE, cookieLocale, localeCookieOptions())
  }

  return NextResponse.json({ ok: true })
}
