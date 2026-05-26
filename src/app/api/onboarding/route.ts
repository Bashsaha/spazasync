import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setOwnerMetadata } from '@/lib/auth/teller'
import { onboardingSchema } from '@/lib/validation/schemas'
import { findMunicipalityByArea } from '@/lib/db/municipalities'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { LOCALE_COOKIE, localeCookieOptions, parseLocale } from '@/lib/i18n/locale-cookie'

/**
 * Auto-generate a short, unique shop code from the shop name.
 * Format: first 4 alpha chars (uppercase, padded with X) + 2 random digits.
 * Retries up to 5 times on uniqueness collision.
 */
async function generateShopCode(
  shopName: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const alpha = shopName.replace(/[^A-Za-z]/g, '').toUpperCase()
  const prefix = (alpha + 'XXXX').slice(0, 4)

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = String(Math.floor(Math.random() * 100)).padStart(2, '0')
    const code = prefix + suffix

    const { data } = await admin
      .from('shops')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (!data) return code
  }

  // Fallback: extend suffix to 4 digits for guaranteed uniqueness
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return prefix + suffix
}

/**
 * POST /api/onboarding
 * Body: { shopName, ownerName, registrationNumber?, location? }
 *
 * Creates the shop (with auto-generated code), maps the owner to it,
 * and adds the owner as a teller entry.
 * Also sets app_metadata on the auth user so proxy can read their role.
 */
export async function POST(request: Request) {
  const { limited } = checkRateLimit(request, { limit: 3, windowSecs: 60 })
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

  const parsed = onboardingSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const {
    shopName,
    ownerName,
    registrationNumber,
    location,
    language,
    municipality_id: pickedMunicipalityId,
    municipality_area_text: areaText,
    has_fridge: hasFridge,
    has_freezer: hasFreezer,
  } = parsed.data

  // Resolve area-text into a known municipality_id when possible.
  let municipalityId: string | null = pickedMunicipalityId ?? null
  let municipalityAreaText: string | null = null
  if (!municipalityId && areaText) {
    const matched = await findMunicipalityByArea(areaText)
    if (matched) {
      municipalityId = matched.id
    } else {
      municipalityAreaText = areaText
    }
  }

  // Get the authenticated user from their session
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Check they haven't already onboarded
  const { data: existingShopUser } = await supabase
    .from('shop_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .single()

  if (existingShopUser) {
    return NextResponse.json({ error: 'You have already set up a shop.' }, { status: 409 })
  }

  // Use admin client for inserts (RLS blocks new rows before shop_users exists)
  const admin = createAdminClient()

  // 1. Auto-generate a unique shop code
  const shopCode = await generateShopCode(shopName, admin)

  // 2. Create the shop
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: shop, error: shopError } = await admin
    .from('shops')
    .insert({
      name: shopName,
      code: shopCode,
      registration_number: registrationNumber || null,
      location: location || null,
      language: language ?? 'en',
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      municipality_id: municipalityId,
      municipality_area_text: municipalityAreaText,
      ...(typeof hasFridge === 'boolean' ? { has_fridge: hasFridge } : {}),
      ...(typeof hasFreezer === 'boolean' ? { has_freezer: hasFreezer } : {}),
    })
    .select('id')
    .single()

  if (shopError) {
    if (shopError.code === '23505') {
      return NextResponse.json(
        { error: 'Could not generate a unique shop code. Please try again.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Failed to create shop.' }, { status: 500 })
  }

  // 3. Create shop_users row (owner)
  const { error: shopUserError } = await admin.from('shop_users').insert({
    shop_id: shop.id,
    user_id: user.id,
    role: 'owner',
  })

  if (shopUserError) {
    // Rollback: delete the shop we just created
    await admin.from('shops').delete().eq('id', shop.id)
    return NextResponse.json({ error: 'Failed to set up your account.' }, { status: 500 })
  }

  // 4. Create a tellers entry for the owner (so they can select themselves on sale page)
  await admin.from('tellers').insert({
    shop_id: shop.id,
    name: ownerName,
    user_id: user.id,
    active: true,
  })

  // 5. Set app_metadata so proxy knows this user is an owner + trial status
  try {
    await setOwnerMetadata(user.id, shop.id, {
      sub_status: 'trialing',
      sub_until: trialEndsAt,
    })
  } catch {
    // Not fatal — they can still use the app; proxy falls back to DB check
  }

  // Set the locale cookie so the first load after onboarding lands on the
  // fast path in (app)/layout.tsx (no shop.language reconcile needed).
  const res = NextResponse.json({ shopId: shop.id, shopCode })
  const cookieLocale = parseLocale(language) ?? 'en'
  res.cookies.set(LOCALE_COOKIE, cookieLocale, localeCookieOptions())
  return res
}
