import { getLastPestVisitDate, isPestOverdue, daysSince } from '@/lib/db/pest-control'
import { todaySAST } from '@/lib/db/waste-management'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

export async function PestControlReminder({
  locale,
}: {
  shopId: string
  locale: SupportedLocale
}) {
  try {
    const [lastVisit, { t }] = await Promise.all([
      getLastPestVisitDate(),
      getServerTranslations(locale, ['waste-pest']),
    ])

    const today = todaySAST()
    if (!isPestOverdue(lastVisit, today)) return null

    const days = daysSince(lastVisit, today)
    const message = lastVisit
      ? t('reminder_pest_overdue', { days: String(days ?? 0) })
      : t('reminder_pest_never')
    const href = lastVisit ? '/waste-pest/pest/new' : '/waste-pest/pest/new'

    return (
      <a
        href={href}
        className="block rounded-2xl px-4 py-3 mb-4 bg-amber-50 border border-amber-200 active:bg-amber-100"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-amber-800">{message}</p>
          <span className="text-amber-400 text-lg">&rsaquo;</span>
        </div>
      </a>
    )
  } catch {
    return null
  }
}
