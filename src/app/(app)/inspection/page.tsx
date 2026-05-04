import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getComplianceScore } from '@/lib/db/compliance-score'
import { listBusinessDocuments } from '@/lib/db/business-documents'
import { getInspectionReadiness } from '@/lib/db/inspection-readiness'
import { InspectionReadinessPanel } from '@/components/compliance/InspectionReadinessPanel'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import type { ComplianceScoreCategory } from '@/types'

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

export default async function InspectionPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['inspection'])

  // Fetch documents once and reuse for both score + readiness.
  const documents = await listBusinessDocuments()
  const [{ result: score }, readiness] = await Promise.all([
    getComplianceScore(auth.supabase, auth.shopId),
    getInspectionReadiness(auth.supabase, auth.shopId, documents),
  ])

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
        className="flex items-center justify-between bg-blue-600 text-white rounded-2xl p-5 shadow-sm active:bg-blue-700 mb-3"
      >
        <div>
          <p className="font-bold text-lg">{t('download_pdf')}</p>
          <p className="text-blue-100 text-sm">{t('download_hint')}</p>
        </div>
        <span className="text-3xl">📄</span>
      </a>

      {/* Phase 37d — Food Safety Evidence Pack */}
      <a
        href="/api/reports/food-safety-pack"
        className="flex items-center justify-between bg-emerald-600 text-white rounded-2xl p-5 shadow-sm active:bg-emerald-700 mb-4"
      >
        <div>
          <p className="font-bold text-lg">{t('download_evidence_pack')}</p>
          <p className="text-emerald-100 text-sm">{t('download_evidence_hint')}</p>
        </div>
        <span className="text-3xl">🧾</span>
      </a>

      {/* Pre-check list (extracted to reusable panel — Phase 37c) */}
      <div className="mb-4">
        <InspectionReadinessPanel result={readiness} t={t} />
      </div>

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
