/**
 * Phase 37e — composite reader for the Fund Readiness page.
 *
 * Returns null when the page should not be shown — caller redirects to
 * /compliance/journey. Reuses getComplianceScore so the score shown here
 * matches the dashboard exactly.
 */

import { createClient } from '@/lib/supabase/server'
import { getComplianceScore } from '@/lib/db/compliance-score'
import {
  computeFundReadiness,
  qualifiesAsSaCitizenForFund,
  type FundReadinessResult,
} from '@/lib/compliance/fund'
import type {
  BusinessDocument,
  ComplianceScoreInputs,
  ComplianceScoreResult,
  OwnerProfile,
  Shop,
} from '@/types'

export interface FundReadinessPageData {
  shop: Shop
  ownerProfile: OwnerProfile
  ownerEmail: string | null
  documents: BusinessDocument[]
  complianceScoreInputs: ComplianceScoreInputs
  complianceScoreResult: ComplianceScoreResult
  fundReadiness: FundReadinessResult
}

export async function getFundReadinessData(
  shopId: string,
  userId: string,
): Promise<FundReadinessPageData | null> {
  const supabase = await createClient()

  const [shopResult, ownerProfileResult, documentsResult, scoreResult, userResult] =
    await Promise.all([
      supabase.from('shops').select('*').eq('id', shopId).maybeSingle(),
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
      getComplianceScore(supabase, shopId),
      supabase.auth.getUser(),
    ])

  const shop = shopResult.data as Shop | null
  if (!shop) return null

  const ownerProfile = ownerProfileResult.data as OwnerProfile | null
  if (!ownerProfile) return null

  // Eligibility gates (Design Rule 3): SA citizens (incl. pre-1994 naturalised
  // foreign-born owners — Phase 41a) with fund_interest only.
  if (!qualifiesAsSaCitizenForFund(ownerProfile)) return null
  if (!shop.fund_interest) return null

  const documents = (documentsResult.data as BusinessDocument[] | null) ?? []
  const ownerEmail = userResult.data.user?.email ?? null

  const sarsGraceActive = Boolean(
    shop.sars_grace_period_until &&
      new Date(shop.sars_grace_period_until) > new Date(),
  )

  const fundReadiness = computeFundReadiness({
    nationality_type: ownerProfile.nationality_type,
    naturalised_pre_1994: ownerProfile.naturalised_pre_1994,
    fund_interest: shop.fund_interest,
    fund_township_rural: shop.fund_township_rural,
    fund_owner_managed: shop.fund_owner_managed,
    documents,
    complianceScore: scoreResult.result.overall,
    sarsGraceActive,
  })

  return {
    shop,
    ownerProfile,
    ownerEmail,
    documents,
    complianceScoreInputs: scoreResult.inputs,
    complianceScoreResult: scoreResult.result,
    fundReadiness,
  }
}
