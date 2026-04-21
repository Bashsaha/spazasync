import { listBusinessDocuments } from '@/lib/db/business-documents'
import { computeDocumentStatus } from '@/lib/compliance/document-status'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'

const TONE_STYLES = {
  grey: {
    wrap: 'bg-blue-50 border border-blue-200 active:bg-blue-100',
    text: 'text-blue-800',
    arrow: 'text-blue-400',
  },
  green: {
    wrap: 'bg-green-50 border border-green-200 active:bg-green-100',
    text: 'text-green-800',
    arrow: 'text-green-400',
  },
  amber: {
    wrap: 'bg-amber-50 border border-amber-200 active:bg-amber-100',
    text: 'text-amber-800',
    arrow: 'text-amber-400',
  },
  red: {
    wrap: 'bg-red-50 border border-red-200 active:bg-red-100',
    text: 'text-red-800',
    arrow: 'text-red-400',
  },
} as const

export async function DocumentComplianceStatus({
  locale,
}: {
  locale: SupportedLocale
}) {
  try {
    const [docs, { t, tPlural }] = await Promise.all([
      listBusinessDocuments(),
      getServerTranslations(locale, ['documents']),
    ])

    const today = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')
    const summary = computeDocumentStatus(docs, today)
    const tone = TONE_STYLES[summary.overall]

    let message: string
    if (summary.overall === 'grey') {
      message = t('dashboard_grey')
    } else if (summary.overall === 'green') {
      message = t('dashboard_green')
    } else if (summary.overall === 'red') {
      message = tPlural('dashboard_red', summary.expired.length, {
        count: summary.expired.length,
      })
    } else {
      const attentionCount =
        summary.expiringSoon.length +
        summary.missing.length +
        docs.filter((d) => d.status === 'pending' || d.status === 'not_registered').length
      message = tPlural('dashboard_amber', attentionCount, { count: attentionCount })
    }

    return (
      <a
        href="/documents"
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
