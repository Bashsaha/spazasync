import Link from 'next/link'
import { BackButton } from '@/components/BackButton'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { redirect } from 'next/navigation'
import {
  getLastPestVisitDate,
  isPestOverdue,
  daysSince,
} from '@/lib/db/pest-control'
import {
  getWasteManagement,
  isWasteConfirmationStale,
  todaySAST,
} from '@/lib/db/waste-management'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function WastePestHubPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['waste-pest'])
  const today = todaySAST()

  const [lastVisit, waste] = await Promise.all([
    getLastPestVisitDate(),
    getWasteManagement(),
  ])

  const pestDays = daysSince(lastVisit, today)
  const pestOverdue = isPestOverdue(lastVisit, today)

  let pestStatus: string
  let pestTone: 'red' | 'amber' | 'green'
  if (lastVisit === null) {
    pestStatus = t('card_pest_status_never')
    pestTone = 'red'
  } else if (pestOverdue) {
    pestStatus = t('card_pest_status_overdue', { days: String(pestDays ?? 0) })
    pestTone = 'amber'
  } else {
    pestStatus = t('card_pest_status_recent', { days: String(pestDays ?? 0) })
    pestTone = 'green'
  }

  const wasteDays = daysSince(waste?.last_confirmed_date ?? null, today)
  const wasteStale = isWasteConfirmationStale(waste?.last_confirmed_date ?? null, today)

  let wasteStatus: string
  let wasteTone: 'red' | 'amber' | 'green'
  if (!waste) {
    wasteStatus = t('card_waste_status_never')
    wasteTone = 'red'
  } else if (waste.last_confirmed_date === null || wasteStale) {
    wasteStatus = t('card_waste_status_stale', { days: String(wasteDays ?? 0) })
    wasteTone = 'amber'
  } else {
    wasteStatus = t('card_waste_status_recent', { days: String(wasteDays ?? 0) })
    wasteTone = 'green'
  }

  const pillStyles: Record<'red' | 'amber' | 'green', string> = {
    red: 'bg-red-50 text-red-700 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    green: 'bg-green-50 text-green-700 border-green-100',
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallbackHref="/profile" />
        <h1 className="text-2xl font-bold text-gray-900">{t('hub_title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">{t('hub_subtitle')}</p>

      <ul className="space-y-3">
        <li>
          <Link
            href="/waste-pest/pest"
            className="block bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">{t('card_pest_title')}</p>
              <span className="text-gray-300 text-lg">&rsaquo;</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('card_pest_desc')}</p>
            <p
              className={`inline-block mt-3 text-xs font-medium px-2 py-1 rounded-full border ${pillStyles[pestTone]}`}
            >
              {pestStatus}
            </p>
          </Link>
        </li>

        <li>
          <Link
            href="/waste-pest/waste"
            className="block bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">{t('card_waste_title')}</p>
              <span className="text-gray-300 text-lg">&rsaquo;</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('card_waste_desc')}</p>
            <p
              className={`inline-block mt-3 text-xs font-medium px-2 py-1 rounded-full border ${pillStyles[wasteTone]}`}
            >
              {wasteStatus}
            </p>
          </Link>
        </li>
      </ul>
    </main>
  )
}
