import {
  getWasteManagement,
  isWasteConfirmationStale,
  todaySAST,
} from '@/lib/db/waste-management'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

export async function WasteConfirmReminder({
  locale,
}: {
  shopId: string
  locale: SupportedLocale
}) {
  try {
    const [waste, { t }] = await Promise.all([
      getWasteManagement(),
      getServerTranslations(locale, ['waste-pest']),
    ])

    const today = todaySAST()

    // No arrangement set up yet — prompt to configure.
    if (!waste) {
      return (
        <a
          href="/waste-pest/waste"
          className="block rounded-2xl px-4 py-3 mb-4 bg-amber-50 border border-amber-200 active:bg-amber-100"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-800">{t('reminder_waste_never')}</p>
            <span className="text-amber-400 text-lg">&rsaquo;</span>
          </div>
        </a>
      )
    }

    // Arrangement exists — remind if the monthly confirmation has gone stale.
    if (!isWasteConfirmationStale(waste.last_confirmed_date, today)) return null

    return (
      <a
        href="/waste-pest/waste"
        className="block rounded-2xl px-4 py-3 mb-4 bg-amber-50 border border-amber-200 active:bg-amber-100"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-amber-800">{t('reminder_waste_stale')}</p>
          <span className="text-amber-400 text-lg">&rsaquo;</span>
        </div>
      </a>
    )
  } catch {
    return null
  }
}
