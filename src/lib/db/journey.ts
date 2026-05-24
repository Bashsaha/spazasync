/**
 * Phase 37c — composite reader for the Compliance Journey Hub.
 *
 * One call returns everything the page needs: owner profile, shop fields,
 * municipality + offices + requirements, business_documents, tellers,
 * product names, last-30-day revenue (for the SARS step copy), and the
 * inspection-readiness panel data.
 *
 * The page would otherwise need ~10 awaits — this keeps the call sites tidy
 * and lets us batch where possible.
 */

import { createClient } from '@/lib/supabase/server'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import {
  filterRequirementsByNationality,
  getMunicipalityById,
  getOfficesForMunicipality,
} from '@/lib/db/municipalities'
import { getInspectionReadiness } from '@/lib/db/inspection-readiness'
import { getShopForRequest } from '@/lib/db/shop'
import { generateJourneySteps } from '@/lib/compliance/journey'
import type {
  BusinessDocument,
  ComplianceJourneyData,
  DocumentRequirement,
  Municipality,
  MunicipalityOffice,
  MunicipalityRequirement,
  NationalityType,
  OwnerProfile,
  Sale,
  Shop,
  Teller,
} from '@/types'

export async function getJourneyData(
  shopId: string,
  userId: string,
): Promise<ComplianceJourneyData | null> {
  const supabase = await createClient()

  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const monthlyRevenueFromIso = formatInTimeZone(
    thirtyDaysAgo,
    SAST_TZ,
    "yyyy-MM-dd'T'00:00:00XXX",
  )

  const [
    shopResult,
    ownerProfileResult,
    documentsResult,
    tellersResult,
    productsResult,
    monthlyRevenueResult,
    userResult,
  ] = await Promise.all([
    supabase
      .from('shops')
      .select(
        'id, name, location, whatsapp_number, has_fridge, has_freezer, has_employees, fund_interest, municipality_id, municipality_area_text, registration_number',
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
    supabase
      .from('tellers')
      .select('*')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('products')
      .select('name')
      .eq('shop_id', shopId)
      .limit(200),
    supabase
      .from('sales')
      .select('total')
      .eq('shop_id', shopId)
      .gte('completed_at', monthlyRevenueFromIso),
    supabase.auth.getUser(),
  ])

  const shop = shopResult.data as ComplianceJourneyData['shop'] | null
  if (!shop) return null

  const ownerProfile = (ownerProfileResult.data as OwnerProfile | null) ?? null
  const documents = (documentsResult.data as BusinessDocument[] | null) ?? []
  const tellers = (tellersResult.data as Teller[] | null) ?? []
  const products = (productsResult.data as { name: string }[] | null) ?? []
  const sales = (monthlyRevenueResult.data as Pick<Sale, 'total'>[] | null) ?? []
  const ownerEmail = userResult.data?.user?.email ?? null

  const monthlyRevenueZar = sales.reduce((acc, s) => acc + Number(s.total ?? 0), 0)

  // Municipality + offices + requirements (only when a municipality is on file).
  let municipality: Municipality | null = null
  let permitOffices: MunicipalityOffice[] = []
  let healthOffices: MunicipalityOffice[] = []
  let permitRequirements: DocumentRequirement[] = []
  let coaRequirements: DocumentRequirement[] = []

  if (shop.municipality_id) {
    municipality = await getMunicipalityById(shop.municipality_id)
    if (municipality) {
      const [permitOff, healthOff, permitReqRow, coaReqRow] = await Promise.all([
        getOfficesForMunicipality(municipality.id, 'trading_permit'),
        getOfficesForMunicipality(municipality.id, 'environmental_health'),
        supabase
          .from('municipality_requirements')
          .select('*')
          .eq('municipality_id', municipality.id)
          .eq('requirement_type', 'trading_permit')
          .maybeSingle(),
        supabase
          .from('municipality_requirements')
          .select('*')
          .eq('municipality_id', municipality.id)
          .eq('requirement_type', 'coa')
          .maybeSingle(),
      ])

      permitOffices = permitOff
      healthOffices = healthOff

      // Filter both requirement lists by the owner's nationality, defaulting
      // to SA-citizen rules when nationality hasn't been set yet (the safer
      // default — over-listing required docs is better than under-listing).
      const nationality: NationalityType = ownerProfile?.nationality_type ?? 'sa_citizen'
      const permitRow = permitReqRow.data as MunicipalityRequirement | null
      const coaRow = coaReqRow.data as MunicipalityRequirement | null
      if (permitRow)
        permitRequirements = filterRequirementsByNationality(
          permitRow.documents_required,
          nationality,
        )
      if (coaRow)
        coaRequirements = filterRequirementsByNationality(
          coaRow.documents_required,
          nationality,
        )
    }
  }

  const inspectionReadiness = await getInspectionReadiness(supabase, shopId, documents)

  const steps = generateJourneySteps(
    ownerProfile,
    { has_employees: shop.has_employees, fund_interest: shop.fund_interest },
    documents,
  )

  return {
    ownerProfile,
    shop,
    ownerEmail,
    municipality,
    permitOffices,
    healthOffices,
    permitRequirements,
    coaRequirements,
    documents,
    tellers,
    productNames: products.map((p) => p.name),
    monthlyRevenueZar,
    steps,
    inspectionReadiness,
  }
}

/**
 * Slim variant for the dashboard ComplianceCard — same step engine, no
 * inspection panel or municipality lookups (those add 4–5 queries we don't
 * need just to render "X of Y steps done").
 */
export async function getJourneyProgressSummary(
  shopId: string,
  userId: string,
): Promise<{
  steps: ComplianceJourneyData['steps']
  ownerProfile: OwnerProfile | null
  shop: Pick<Shop, 'has_employees' | 'fund_interest'> | null
}> {
  const supabase = await createClient()
  // Shared shop fetch — memoised via React.cache at the layout call site.
  const [shopRow, ownerProfileResult, documentsResult] = await Promise.all([
    getShopForRequest(shopId, supabase),
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
  ])

  const shop = shopRow
    ? { has_employees: shopRow.has_employees ?? false, fund_interest: shopRow.fund_interest ?? false }
    : null
  const ownerProfile = (ownerProfileResult.data as OwnerProfile | null) ?? null
  const documents = (documentsResult.data as BusinessDocument[] | null) ?? []

  const steps = shop
    ? generateJourneySteps(ownerProfile, shop, documents)
    : []
  return { steps, ownerProfile, shop }
}
