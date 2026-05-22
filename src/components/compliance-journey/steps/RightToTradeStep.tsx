/**
 * Step 0 — Right to Trade (foreign nationals only).
 *
 * A foreign national's entire ability to run a shop legally depends on holding
 * a valid visa or permit. The citizen journey has no equivalent step, so we
 * surface this first and frame it as the foundation. It is NOT a hard lock on
 * the rest of the journey (a foreign owner can still read what the other steps
 * need while sorting out a permit), but it carries:
 *   - which permits allow trading,
 *   - the owner's recorded visa/permit + expiry,
 *   - a renewal note (the trading licence is tied to the permit's validity),
 *   - a fronting warning (B-BBEE Act §13O — a real criminal risk for foreign
 *     owners pressured to register in a citizen's name).
 *
 * Status is derived from owner_profiles.visa_type (see rawStepStatus in
 * lib/compliance/journey.ts), so there's no Mark-as-done action here — it's
 * complete once a permit is on file from onboarding.
 *
 * Sources for the copy (verified 2026-05-21): DHA / Immigration Act 13 of 2002
 * §22/§24; B-BBEE Act 53 of 2003 §13O. See tasks/compliance-facts-audit.md §H.
 */

import { ShieldAlert, AlertTriangle } from 'lucide-react'
import { LinkButton } from '@/components/ui'
import type { VisaType } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  t: T
  visaType: VisaType | null
  visaExpiryDate: string | null // YYYY-MM-DD
  /** Pre-computed in the server component to avoid client-side date math. */
  daysRemaining: number | null
}

export function RightToTradeStep({ t, visaType, visaExpiryDate, daysRemaining }: Props) {
  const visaLabel = visaType ? t(`visa_type_${visaType}`) : null

  return (
    <>
      {/* What allows you to trade */}
      <section className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-gray-800 mb-2">{t('rtt_what_header')}</h4>
        <p className="text-gray-700 mb-2">{t('rtt_what_body')}</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>{t('rtt_permit_business')}</li>
          <li>{t('rtt_permit_s24')}</li>
          <li>{t('rtt_permit_s22')}</li>
          <li>{t('rtt_permit_pr')}</li>
        </ul>
      </section>

      {/* Your status on file */}
      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">{t('rtt_your_status_header')}</h4>
        {visaType ? (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm">
            <p className="text-gray-700">
              <span className="text-gray-500">{t('rtt_status_label')} </span>
              <strong>{visaLabel}</strong>
            </p>
            {visaExpiryDate && (
              <p className="mt-1 text-gray-700">
                <span>{visaExpiryDate}</span>
                {daysRemaining != null && daysRemaining >= 0 && (
                  <span className="ml-1 text-gray-500">
                    ({t('visa_expiry_days_remaining', { n: daysRemaining })})
                  </span>
                )}
                {daysRemaining != null && daysRemaining < 0 && (
                  <span className="ml-1 text-red-700 font-semibold">({t('visa_expired')})</span>
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <p className="mb-3">{t('rtt_no_status_body')}</p>
            <LinkButton href="/settings" variant="secondary" size="sm">
              {t('rtt_update_cta')}
            </LinkButton>
          </div>
        )}
      </section>

      {/* Renewal note — the trading licence is tied to the permit */}
      <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.75} />
        <span>{t('rtt_renew_note')}</span>
      </p>

      {/* Fronting warning */}
      <section className="bg-red-50 border border-red-200 rounded-xl p-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-red-800 mb-1">
          <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          {t('rtt_fronting_title')}
        </h4>
        <p className="text-xs text-red-700 leading-relaxed">{t('rtt_fronting_body')}</p>
      </section>
    </>
  )
}
