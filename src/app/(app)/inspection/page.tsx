import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getComplianceScore } from '@/lib/db/compliance-score'
import { listBusinessDocuments } from '@/lib/db/business-documents'
import { computeDocumentStatus } from '@/lib/compliance/document-status'
import { isPestOverdue } from '@/lib/compliance/waste-pest-status'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import type {
  BusinessDocument,
  ComplianceScoreCategory,
  DailyChecklist,
} from '@/types'

export const dynamic = 'force-dynamic'

type Tone = 'green' | 'amber' | 'red'

const BAND_BADGE: Record<Tone, { wrap: string; ring: string; track: string; score: string; label: string }> = {
  green: {
    wrap: 'bg-green-50 border-green-200',
    ring: 'text-green-600',
    track: 'text-green-100',
    score: 'text-green-700',
    label: 'text-green-800',
  },
  amber: {
    wrap: 'bg-amber-50 border-amber-200',
    ring: 'text-amber-500',
    track: 'text-amber-100',
    score: 'text-amber-700',
    label: 'text-amber-800',
  },
  red: {
    wrap: 'bg-red-50 border-red-200',
    ring: 'text-red-600',
    track: 'text-red-100',
    score: 'text-red-700',
    label: 'text-red-800',
  },
}

interface PreCheckRow {
  key: string
  pass: boolean
  fixHref: string
}

export default async function InspectionPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['inspection'])

  const today = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const weekFromDate = formatInTimeZone(sevenDaysAgo, SAST_TZ, 'yyyy-MM-dd')

  const [
    { result: score },
    documents,
    todayChecklistResult,
    weekChecklistResult,
    pestResult,
  ] = await Promise.all([
    getComplianceScore(auth.supabase, auth.shopId),
    listBusinessDocuments(),
    auth.supabase
      .from('daily_checklists')
      .select('id,fridge_temp,freezer_temp')
      .eq('shop_id', auth.shopId)
      .eq('date', today)
      .maybeSingle(),
    auth.supabase
      .from('daily_checklists')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', auth.shopId)
      .gte('date', weekFromDate),
    auth.supabase
      .from('pest_control_logs')
      .select('visit_date')
      .eq('shop_id', auth.shopId)
      .order('visit_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const docs = (documents as BusinessDocument[] | null) ?? []
  const docSummary = computeDocumentStatus(docs, today)
  const expiredTypes = new Set(docSummary.expired.map((d) => d.document_type))
  const missingTypes = new Set(docSummary.missing)

  const municipalDoc = docs.find((d) => d.document_type === 'municipal_registration')
  const coaDoc = docs.find((d) => d.document_type === 'coa')

  const municipalOk =
    !!municipalDoc &&
    !missingTypes.has('municipal_registration') &&
    !expiredTypes.has('municipal_registration') &&
    municipalDoc.status !== 'pending' &&
    municipalDoc.status !== 'not_registered'

  const coaOk =
    !!coaDoc &&
    !missingTypes.has('coa') &&
    !expiredTypes.has('coa') &&
    coaDoc.status !== 'pending' &&
    coaDoc.status !== 'not_registered' &&
    coaDoc.status !== 'expired'

  const checklistsThisWeek = weekChecklistResult.count ?? 0
  const checklistWeekOk = checklistsThisWeek >= 5

  const expiryCategory = score.categories.find((c) => c.key === 'expiry')
  const noExpiredOk = expiryCategory ? expiryCategory.score === 100 : true

  const supplierCategory = score.categories.find((c) => c.key === 'suppliers')
  const suppliersOk = supplierCategory ? supplierCategory.score >= 80 : true

  const lastPestVisit =
    (pestResult.data as { visit_date: string } | null)?.visit_date ?? null
  const pestOk = !isPestOverdue(lastPestVisit, today)

  const todayChecklist =
    (todayChecklistResult.data as Pick<DailyChecklist, 'id' | 'fridge_temp' | 'freezer_temp'> | null) ?? null
  const tempLoggedToday =
    !!todayChecklist &&
    (todayChecklist.fridge_temp !== null || todayChecklist.freezer_temp !== null)

  const preCheck: PreCheckRow[] = [
    { key: 'pc_municipal', pass: municipalOk, fixHref: '/documents/municipal_registration' },
    { key: 'pc_coa', pass: coaOk, fixHref: '/documents/coa' },
    { key: 'pc_checklist_week', pass: checklistWeekOk, fixHref: '/checklist' },
    { key: 'pc_suppliers', pass: suppliersOk, fixHref: '/products' },
    { key: 'pc_no_expired', pass: noExpiredOk, fixHref: '/expiry' },
    { key: 'pc_pest', pass: pestOk, fixHref: '/waste-pest/pest/new' },
    { key: 'pc_temp_today', pass: tempLoggedToday, fixHref: '/checklist' },
  ]

  const tone: Tone = score.band
  const bandLabelKey =
    score.band === 'green'
      ? 'band_ready'
      : score.band === 'amber'
        ? 'band_improving'
        : 'band_urgent'

  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dash = (score.overall / 100) * circumference

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('subtitle')}</p>

      {/* Score badge */}
      <section className={`rounded-2xl border px-4 py-5 mb-4 ${BAND_BADGE[tone].wrap}`}>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
              <circle
                cx="60"
                cy="60"
                r={radius}
                strokeWidth="10"
                fill="none"
                className={BAND_BADGE[tone].track}
                stroke="currentColor"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                className={BAND_BADGE[tone].ring}
                stroke="currentColor"
                strokeDasharray={`${dash} ${circumference}`}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-3xl font-bold ${BAND_BADGE[tone].score}`}>
                {score.overall}
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                {t('score_out_of')}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('score_label')}</p>
            <p className={`text-base font-bold mt-1 ${BAND_BADGE[tone].label}`}>
              {t(bandLabelKey)}
            </p>
          </div>
        </div>
      </section>

      {/* PDF download */}
      <a
        href="/api/reports/compliance-pdf"
        className="flex items-center justify-between bg-blue-600 text-white rounded-2xl p-5 shadow-sm active:bg-blue-700 mb-4"
      >
        <div>
          <p className="font-bold text-lg">{t('download_pdf')}</p>
          <p className="text-blue-100 text-sm">{t('download_hint')}</p>
        </div>
        <span className="text-3xl">📄</span>
      </a>

      {/* Pre-check list */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 px-4 pt-4 pb-2">
          {t('pre_check_header')}
        </h2>
        <ul className="divide-y divide-gray-100">
          {preCheck.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between px-4 py-3 gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    row.pass
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {row.pass ? '✓' : '✗'}
                </span>
                <p className="text-sm text-gray-800 truncate">{t(row.key)}</p>
              </div>
              {row.pass ? (
                <span className="text-xs text-green-600 font-medium shrink-0">
                  {t('ok')}
                </span>
              ) : (
                <Link
                  href={row.fixHref}
                  className="text-xs font-semibold text-blue-600 active:text-blue-800 shrink-0"
                >
                  {t('fix_now')} &rsaquo;
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Score breakdown */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 px-4 pt-4 pb-2">
          {t('breakdown_header')}
        </h2>
        <ul className="divide-y divide-gray-100">
          {score.categories.map((cat) => (
            <CategoryRow key={cat.key} category={cat} t={t} />
          ))}
        </ul>
      </section>
    </main>
  )
}

function CategoryRow({
  category,
  t,
}: {
  category: ComplianceScoreCategory
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const labelKey = `cat_${category.key}`
  const tone: Tone =
    category.score >= 80 ? 'green' : category.score >= 50 ? 'amber' : 'red'
  const dotClass =
    tone === 'green' ? 'bg-green-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} aria-hidden="true" />
          <p className="text-sm font-medium text-gray-800 truncate">{t(labelKey)}</p>
        </div>
        <p className="text-xs text-gray-500 shrink-0">
          {t('breakdown_contribution', { score: category.score, weight: category.weight })}
        </p>
      </div>
      {category.tipKey && (
        <p className="text-xs text-gray-500 mt-1 ml-4">
          {t(category.tipKey, category.tipParams as Record<string, string | number> | undefined)}
        </p>
      )}
    </li>
  )
}
