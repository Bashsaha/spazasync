/**
 * Phase 37d — composite reader for the document-generation PDF endpoints.
 *
 * Most generated documents need the same shape: shop info + owner profile +
 * municipality name + a "what does this shop sell" string + a sales rollup
 * for the fund pack. Pulling this together once keeps the five PDF route
 * handlers tidy.
 *
 * NOTE Design Rule 6: this helper deliberately does NOT fetch / surface ID
 * numbers, passport numbers, or tax registration numbers. The fields aren't
 * even stored on `owner_profiles`, but if a future migration adds them, the
 * `assertNoSensitiveValues` guard in `lib/pdf/shared.ts` is the second line
 * of defense.
 */

import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import { generateGoodsDescription } from '@/lib/compliance/goods-description'
import { getMunicipalityById } from '@/lib/db/municipalities'
import type {
  BusinessDocument,
  Municipality,
  OwnerProfile,
  Sale,
  Shop,
} from '@/types'

export interface OwnerProfileReportData {
  shop: Pick<
    Shop,
    | 'id'
    | 'name'
    | 'code'
    | 'location'
    | 'whatsapp_number'
    | 'registration_number'
    | 'municipality_id'
    | 'municipality_area_text'
    | 'has_employees'
    | 'fund_interest'
  >
  ownerProfile: OwnerProfile | null
  ownerName: string | null
  ownerEmail: string | null
  municipality: Municipality | null
  /** Resolved area name — municipality short_name OR free-text fallback. */
  areaLabel: string | null
  /** Comma-separated list of category buckets matching the shop's catalogue. */
  goodsDescription: string
  documents: BusinessDocument[]
  /** Total ZAR revenue over the last 90 days (used for the fund pack monthly average). */
  ninetyDayRevenue: number
  /** Distinct days with at least one sale in the last 90 days. */
  activeDays: number
}

/**
 * Aggregates everything the document endpoints might need.
 *
 * `userId` is the owner auth user — used to look up `owner_profiles`. The
 * caller is expected to have already verified the user owns `shopId`.
 */
export async function getOwnerProfileReportData(
  shopId: string,
  userId: string,
): Promise<OwnerProfileReportData | null> {
  const supabase = await createClient()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgoIso = formatInTimeZone(
    ninetyDaysAgo,
    SAST_TZ,
    "yyyy-MM-dd'T'00:00:00XXX",
  )

  const [
    shopResult,
    ownerProfileResult,
    documentsResult,
    productsResult,
    salesResult,
    userResult,
  ] = await Promise.all([
    supabase
      .from('shops')
      .select(
        'id, name, code, location, whatsapp_number, registration_number, municipality_id, municipality_area_text, has_employees, fund_interest',
      )
      .eq('id', shopId)
      .maybeSingle(),
    supabase
      .from('owner_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('business_documents')
      .select('*')
      .eq('shop_id', shopId)
      .order('document_type'),
    supabase.from('products').select('name').eq('shop_id', shopId).limit(200),
    supabase
      .from('sales')
      .select('total, completed_at')
      .eq('shop_id', shopId)
      .gte('completed_at', ninetyDaysAgoIso),
    supabase.auth.getUser(),
  ])

  const shop = shopResult.data as OwnerProfileReportData['shop'] | null
  if (!shop) return null

  const ownerProfile = (ownerProfileResult.data as OwnerProfile | null) ?? null
  const documents = (documentsResult.data as BusinessDocument[] | null) ?? []
  const products = (productsResult.data as { name: string }[] | null) ?? []
  const sales =
    (salesResult.data as Pick<Sale, 'total' | 'completed_at'>[] | null) ?? []

  const ninetyDayRevenue = sales.reduce((acc, s) => acc + Number(s.total ?? 0), 0)
  const activeDaySet = new Set(
    sales.map((s) => formatInTimeZone(new Date(s.completed_at), SAST_TZ, 'yyyy-MM-dd')),
  )

  // Owner name: Supabase user_metadata.full_name first, fall back to email local-part.
  const authUser = userResult.data?.user ?? null
  const fullName =
    (authUser?.user_metadata as { full_name?: string } | undefined)?.full_name ?? null
  const email = authUser?.email ?? null
  const ownerName = fullName ?? (email ? email.split('@')[0] : null)

  let municipality: Municipality | null = null
  if (shop.municipality_id) {
    municipality = await getMunicipalityById(shop.municipality_id)
  }
  const areaLabel =
    shop.municipality_area_text ?? municipality?.short_name ?? null

  return {
    shop,
    ownerProfile,
    ownerName,
    ownerEmail: email,
    municipality,
    areaLabel,
    goodsDescription: generateGoodsDescription(products.map((p) => p.name)),
    documents,
    ninetyDayRevenue,
    activeDays: activeDaySet.size,
  }
}
