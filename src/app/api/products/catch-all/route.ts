import { NextResponse } from 'next/server'
import { getShopAuthFast } from '@/lib/auth/shop-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerTranslations } from '@/lib/i18n/server'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale } from '@/lib/i18n/types'

/**
 * GET /api/products/catch-all  (Phase 47)
 *
 * Returns the shop's single "No-name product" catch-all, lazily creating it on
 * first use. It is a real `products` row (so it shows up in recent sales and
 * reports for free) but is `track_stock=false` (never deducts stock) and
 * `is_catch_all=true` (hidden from every product/stock management list).
 *
 * The teller types the price per sale on the sale screen; the stored price is 0.
 */
export async function GET() {
  const auth = await getShopAuthFast()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId, supabase } = auth

  // Already exists? (RLS-scoped read — the caller is in this shop.)
  const { data: existing } = await supabase
    .from('products')
    .select('*')
    .eq('is_catch_all', true)
    .limit(1)
    .maybeSingle()
  if (existing) return NextResponse.json(existing)

  // Create it with the service role so it works regardless of role (tellers do
  // sales too) and the one-per-shop unique index is the source of truth.
  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select('language')
    .eq('id', shopId)
    .single()
  const lang = (shop?.language as string | undefined) ?? DEFAULT_LOCALE
  const locale = (SUPPORTED_LOCALES.includes(lang as SupportedLocale)
    ? lang
    : DEFAULT_LOCALE) as SupportedLocale
  const { t } = await getServerTranslations(locale, ['sale'])

  const { data: created, error } = await admin
    .from('products')
    .insert({
      shop_id: shopId,
      name: t('no_name_product'),
      price: 0,
      stock_qty: 0,
      barcode: null,
      cost_price: null,
      track_stock: false,
      is_catch_all: true,
    })
    .select()
    .single()

  if (error) {
    // Lost a race (one-per-shop unique index) — fetch the winner and return it.
    const { data: raced } = await admin
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_catch_all', true)
      .maybeSingle()
    if (raced) return NextResponse.json(raced)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(created, { status: 201 })
}
