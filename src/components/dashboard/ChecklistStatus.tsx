import { getTodayChecklist, todaySAST } from '@/lib/db/daily-checklist'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'

export async function ChecklistStatus({
  shopId,
  locale,
}: {
  shopId: string
  locale: SupportedLocale
}) {
  try {
    const [checklist, { t }] = await Promise.all([
      getTodayChecklist(shopId, todaySAST()),
      getServerTranslations(locale, ['checklist']),
    ])

    if (checklist) {
      return (
        <a
          href="/checklist"
          className="block bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 active:bg-green-100"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-green-800">{t('status_done')}</p>
            <span className="text-green-400 text-lg">&rsaquo;</span>
          </div>
        </a>
      )
    }

    // Determine time-of-day tone: orange after 10:00 SAST, blue otherwise.
    const hour = Number(formatInTimeZone(new Date(), SAST_TZ, 'H'))
    const isReminder = hour >= 10

    const message = isReminder ? t('status_reminder') : t('status_todo')
    const tone = isReminder
      ? {
          wrap: 'bg-amber-50 border border-amber-200 active:bg-amber-100',
          text: 'text-amber-800',
          arrow: 'text-amber-400',
        }
      : {
          wrap: 'bg-blue-50 border border-blue-200 active:bg-blue-100',
          text: 'text-blue-800',
          arrow: 'text-blue-400',
        }

    return (
      <a
        href="/checklist"
        className={`block rounded-2xl px-4 py-3 mb-4 ${tone.wrap}`}
      >
        <div className="flex items-center justify-between">
          <p className={`text-sm font-semibold ${tone.text}`}>{message}</p>
          <span className={`${tone.arrow} text-lg`}>&rsaquo;</span>
        </div>
      </a>
    )
  } catch {
    return null
  }
}
