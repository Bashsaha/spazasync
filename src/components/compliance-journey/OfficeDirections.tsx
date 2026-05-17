/**
 * Phase 37c — "Where to go" card.
 *
 * Pulls from `municipality_offices`. When the owner's municipality is
 * unknown (free-text area not matched in 37a) or hasn't been seeded yet,
 * renders a helpful generic fallback per the design rules — never a blank
 * card, never a wrong address.
 */

import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import type { MunicipalityOffice } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  offices: MunicipalityOffice[]
  /** Free-text area name used when there are no offices, so the fallback can mention it. */
  areaText: string | null
  t: T
  /** i18n key for the section header. */
  headerKey: string
}

export function OfficeDirections({ offices, areaText, t, headerKey }: Props) {
  if (offices.length === 0) {
    return (
      <section>
        <h4 className="text-sm font-semibold text-gray-800 mb-2">{t(headerKey)}</h4>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600">
          <p className="mb-2">
            {t('office_unknown_fallback', { area: areaText ?? t('office_unknown_area') })}
          </p>
          <p className="text-xs text-gray-500">{t('office_unknown_hint')}</p>
        </div>
      </section>
    )
  }

  // Primary = first office; "Other offices near you" lists the rest.
  const [primary, ...rest] = offices

  return (
    <section>
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{t(headerKey)}</h4>
      <div className="bg-white border border-gray-200 rounded-2xl p-4 text-sm">
        <MapPin className="w-6 h-6 mb-2 text-brand" strokeWidth={1.75} aria-hidden="true" />
        <p className="font-bold text-gray-900">{primary.name}</p>
        <p className="text-gray-700 whitespace-pre-line mt-1">{primary.address}</p>
        {primary.phone && (
          <p className="text-gray-700 mt-2 flex items-center gap-1.5">
            <Phone className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <a href={`tel:${primary.phone.replace(/\s+/g, '')}`} className="text-brand active:text-brand-hover">
              {primary.phone}
            </a>
          </p>
        )}
        {primary.email && (
          <p className="text-gray-700 mt-1 flex items-center gap-1.5">
            <Mail className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <a href={`mailto:${primary.email}`} className="text-brand active:text-brand-hover break-all">
              {primary.email}
            </a>
          </p>
        )}
        {primary.hours && (
          <p className="text-gray-700 mt-1 flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{primary.hours}</span>
          </p>
        )}
        {/* Phase 41c — duplicate form/portal links removed; the new
            <OfficialFormCallout> at the top of Trading Permit + CoA steps owns
            the form/portal CTA so we don't render the same URL twice on screen. */}
      </div>

      {rest.length > 0 && (
        <details className="mt-2 bg-white border border-gray-100 rounded-2xl">
          <summary className="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer">
            {t('office_other_nearby')}
          </summary>
          <ul className="px-4 pb-3 space-y-3">
            {rest.map((o) => (
              <li key={o.id} className="text-sm">
                <p className="font-semibold text-gray-900">{o.name}</p>
                <p className="text-gray-600 whitespace-pre-line mt-0.5">{o.address}</p>
                {o.phone && (
                  <p className="text-gray-600 mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                    <span>{o.phone}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
