/**
 * Phase 41b — prominent "Download the official form" callout.
 *
 * The seed data in `municipality_offices` already carries `online_form_url`
 * (real metro PDFs — e.g. Joburg Form 13) and `online_portal_url` (online-only
 * application sites — e.g. Tshwane Spazaregister, Cape Town City-Connect).
 * `OfficeDirections` renders these as small underlined links nested deep
 * inside the "Where to go" card — easy for owners to miss.
 *
 * This callout surfaces the same data as a top-of-step amber CTA so owners
 * know up front: the actual government form lives HERE, and Movestock's
 * pre-filled summary below is just a cheat-sheet to copy onto it.
 *
 * Server component (no hooks). Renders nothing when the metro hasn't been
 * seeded with either a form URL or a portal URL.
 */

import { FileDown, Globe } from 'lucide-react'
import type { MunicipalityOffice } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  offices: MunicipalityOffice[]
  t: T
}

export function OfficialFormCallout({ offices, t }: Props) {
  // Use the first office that exposes either field. If none do, render
  // nothing — the existing "Where to go" fallback handles the unseeded case.
  const officeWithLink = offices.find(
    (o) => o.online_form_url || o.online_portal_url,
  )
  if (!officeWithLink) return null

  const formUrl = officeWithLink.online_form_url
  const portalUrl = officeWithLink.online_portal_url
  const primaryUrl = formUrl ?? portalUrl!
  const isPdf = Boolean(formUrl)

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-1">
      <div className="flex items-start gap-2.5">
        {isPdf ? (
          <FileDown className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Globe className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-amber-900">
            {isPdf ? t('official_form_pdf_title') : t('official_form_portal_title')}
          </h4>
          <p className="text-xs text-amber-800 mt-1">
            {isPdf ? t('official_form_pdf_body') : t('official_form_portal_body')}
          </p>
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-full active:bg-amber-700"
          >
            {isPdf ? t('official_form_pdf_cta') : t('official_form_portal_cta')}
          </a>
        </div>
      </div>
    </section>
  )
}
