/**
 * Phase 37f — Info card shown at the top of /compliance/journey for
 * foreign-national owners. Reminds the owner that their trading permit is
 * tied to their visa/permit and shows a countdown when an expiry date is on
 * file. Pure presentational — owner data resolves on the server.
 */

import type { VisaType } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  t: T
  visaType: VisaType | null
  visaExpiryDate: string | null   // YYYY-MM-DD
  /** Pre-computed in the server component to avoid client-side date math. */
  daysRemaining: number | null
}

export function VisaPermitWarning({ t, visaType, visaExpiryDate, daysRemaining }: Props) {
  const visaLabel = visaType ? t(`visa_type_${visaType}`) : null
  const showExpiryLine = visaExpiryDate != null

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-amber-900 mb-1">
        ℹ️ {t('visa_warning_title')}
      </h2>
      <p className="text-sm text-amber-800 leading-relaxed">
        {t('visa_warning_body')}
      </p>
      {showExpiryLine && (
        <p className="text-xs text-amber-900 mt-3 font-medium">
          {visaLabel && <span>{visaLabel}: </span>}
          <span>{visaExpiryDate}</span>
          {daysRemaining != null && daysRemaining >= 0 && (
            <span className="ml-1 text-amber-700">
              ({t('visa_expiry_days_remaining', { n: daysRemaining })})
            </span>
          )}
          {daysRemaining != null && daysRemaining < 0 && (
            <span className="ml-1 text-red-700 font-semibold">
              ({t('visa_expired')})
            </span>
          )}
        </p>
      )}
    </section>
  )
}
