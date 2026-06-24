import { NextResponse } from 'next/server'
import { getShopAuthFast } from '@/lib/auth/shop-auth'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { STABLE_READ_CACHE } from '@/lib/utils/api'
import { getComplianceScore } from '@/lib/db/compliance-score'
import { getTodayChecklist, getRecentChecklistDates, todaySAST } from '@/lib/db/daily-checklist'
import { computeChecklistStreak } from '@/lib/checklist/stats'
import { listBusinessDocuments } from '@/lib/db/business-documents'
import { computeDocumentStatus } from '@/lib/compliance/document-status'
import { getJourneyProgressSummary } from '@/lib/db/journey'
import { getRecentSalesForShop } from '@/lib/db/reports'
import type {
  DocumentStatus,
  NationalityType,
  OnboardingDocumentType,
  VisaType,
} from '@/types'

/**
 * GET /api/dashboard — the whole owner dashboard in one payload (Phase 44 App
 * Shell). Lets the dashboard render DATA-FREE + client cache-first (so its HTML
 * is SW-cacheable and it never server-renders into a sleeping radio on resume —
 * the proper fix for BUG-051). Owner/admin only; the cards are owner-scoped.
 */
const ONBOARDING_DOC_TYPES: OnboardingDocumentType[] = [
  'municipal_registration', 'coa', 'cipc', 'sars_tax', 'uif',
]

export async function GET(request: Request) {
  const { limited } = await checkRateLimit(request, { limit: 120, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = await getShopAuthFast()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role === 'teller') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { shopId, supabase, user } = auth
  const today = todaySAST()
  // 60-day window is plenty to resolve any live streak for the dashboard chip.
  const streakSince = new Date(Date.parse(`${today}T00:00:00Z`) - 60 * 86_400_000)
    .toISOString()
    .slice(0, 10)

  // Each reader degrades to a safe empty/null on its own throw so one slow query
  // can't 500 the whole dashboard.
  const safe = <T,>(p: PromiseLike<T>, fallback: T): Promise<T> =>
    Promise.resolve(p).then((v) => v, () => fallback)

  const [
    shopRes,
    score,
    todayChecklist,
    docs,
    journey,
    latestSales,
    profileRes,
    checklistDates,
  ] = await Promise.all([
    safe(
      supabase
        .from('shops')
        .select(
          'name, code, subscription_status, trial_ends_at, subscription_ends_at, profit_tracking_enabled, municipality_id, fund_interest, onboarding_compliance_completed, onboarding_compliance_dismissed_at, onboarding_compliance_dismiss_count',
        )
        .eq('id', shopId)
        .single()
        .then((r) => r.data),
      null as null | Record<string, unknown>,
    ),
    safe(getComplianceScore(supabase, shopId), null),
    safe(getTodayChecklist(shopId, today), null),
    safe(listBusinessDocuments(), [] as Awaited<ReturnType<typeof listBusinessDocuments>>),
    safe(getJourneyProgressSummary(shopId, user.id), { steps: [], ownerProfile: null, shop: null }),
    safe(getRecentSalesForShop(shopId, 10), []),
    safe(
      supabase
        .from('owner_profiles')
        .select(
          'nationality_type, food_safety_training_completed, food_safety_training_date, food_safety_training_provider, visa_type, visa_expiry_date, naturalised_pre_1994',
        )
        .eq('user_id', user.id)
        .maybeSingle()
        .then((r) => r.data),
      null as null | Record<string, unknown>,
    ),
    safe(getRecentChecklistDates(shopId, streakSince), [] as string[]),
  ])

  const checklistStreak = computeChecklistStreak(checklistDates, today)

  // ── Compliance card (band/score + typed alert descriptors) ───────────────
  let compliance: {
    band: string
    overall: number
    alerts: { type: 'checklist' | 'documents' | 'pest' | 'waste'; count?: number }[]
  } | null = null
  if (score) {
    const docSummary = computeDocumentStatus(docs, today)
    const docAttentionCount =
      docSummary.expiringSoon.length +
      docSummary.expired.length +
      docSummary.missing.length +
      docs.filter((d) => d.status === 'pending' || d.status === 'not_registered').length

    const alerts: { type: 'checklist' | 'documents' | 'pest' | 'waste'; count?: number }[] = []
    if (!todayChecklist) alerts.push({ type: 'checklist' })
    if (docAttentionCount > 0) alerts.push({ type: 'documents', count: docAttentionCount })
    if (score.inputs.pestOverdue) alerts.push({ type: 'pest' })
    if (score.inputs.wasteStale) alerts.push({ type: 'waste' })

    compliance = { band: score.result.band, overall: score.result.overall, alerts }
  }

  // ── Journey card ─────────────────────────────────────────────────────────
  let journeyCard: {
    completed: number
    total: number
    nextKey: string | null
    allDone: boolean
    showFundTeaser: boolean
  } | null = null
  if (journey.shop && journey.steps.length > 0) {
    const completed = journey.steps.filter((s) => s.status === 'complete').length
    const total = journey.steps.length
    const allDone = completed === total
    const next =
      journey.steps.find((s) => s.status === 'in_progress') ??
      journey.steps.find((s) => s.status === 'not_started') ??
      journey.steps.find((s) => s.status === 'locked') ??
      null
    journeyCard = {
      completed,
      total,
      nextKey: next?.key ?? null,
      allDone,
      showFundTeaser:
        journey.ownerProfile?.nationality_type === 'sa_citizen' &&
        Boolean(journey.shop.fund_interest) &&
        !allDone,
    }
  }

  // ── Onboarding modal pre-fill ────────────────────────────────────────────
  let municipality: { id: string; name: string } | null = null
  const municipalityId = shopRes?.municipality_id as string | null | undefined
  if (municipalityId) {
    const m = await safe(
      supabase.from('municipalities').select('id, name').eq('id', municipalityId).maybeSingle().then((r) => r.data),
      null as null | { id: string; name: string },
    )
    if (m) municipality = { id: m.id, name: m.name }
  }

  const onboardingDocs = docs
    .filter((d) => ONBOARDING_DOC_TYPES.includes(d.document_type as OnboardingDocumentType))
    .map((d) => ({ document_type: d.document_type as OnboardingDocumentType, status: d.status as DocumentStatus }))

  return NextResponse.json(
    {
      shop: shopRes
        ? {
            name: (shopRes.name as string | null) ?? null,
            code: shopRes.code ?? '',
            subscription_status: shopRes.subscription_status ?? null,
            trial_ends_at: shopRes.trial_ends_at ?? null,
            subscription_ends_at: shopRes.subscription_ends_at ?? null,
            profit_tracking_enabled: Boolean(shopRes.profit_tracking_enabled),
            onboarding_compliance_completed: Boolean(shopRes.onboarding_compliance_completed),
            onboarding_compliance_dismissed_at: shopRes.onboarding_compliance_dismissed_at ?? null,
            onboarding_compliance_dismiss_count: Number(shopRes.onboarding_compliance_dismiss_count ?? 0),
          }
        : null,
      compliance,
      journey: journeyCard,
      checklistStreak,
      latestSales,
      onboarding: {
        docs: onboardingDocs,
        nationality: (profileRes?.nationality_type as NationalityType | null) ?? null,
        foodSafety: profileRes
          ? {
              completed: Boolean(profileRes.food_safety_training_completed),
              date: (profileRes.food_safety_training_date as string | null) ?? null,
              provider: (profileRes.food_safety_training_provider as string | null) ?? null,
            }
          : null,
        visa: profileRes
          ? {
              type: (profileRes.visa_type as VisaType | null) ?? null,
              expiryDate: (profileRes.visa_expiry_date as string | null) ?? null,
            }
          : null,
        naturalised: (profileRes?.naturalised_pre_1994 as boolean | null) ?? null,
        municipality,
      },
    },
    { headers: STABLE_READ_CACHE },
  )
}
