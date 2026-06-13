/**
 * Phase 37e — How to apply.
 * Phase 50 — bare content (the page wraps it in a <Disclosure>); the scam
 * warning was pulled OUT to a persistent page-level Callout so it is never
 * hidden behind a tap.
 *
 * Static external links. Government-verified contacts only (Design Rule 7):
 * SEFA portal, fund email, fund call centre.
 */

import { Monitor, Building2, Mail, Phone } from 'lucide-react'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  t: T
}

// Phase 41b — point to the OFFICIAL fund portal (spazashopfund.co.za, run by
// NEF on behalf of SEDFA). SAnews has explicitly warned about fake assistants —
// only these government channels.
const FUND_PORTAL_URL = 'https://www.spazashopfund.co.za'
const FUND_CALL_CENTRE = '011 305 8080'
const NEF_PHONE = '0861 843 633'
const SEDFA_PHONE = '012 748 9600'
const FUND_EMAIL = 'spazafund@nefcorp.co.za'

export function ApplySection({ t }: Props) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Monitor className="w-4 h-4" strokeWidth={1.75} />{t('apply_online_title')}</p>
        <a
          href={FUND_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand text-xs font-semibold active:text-brand-hover"
        >
          {t('apply_open_sefa_portal')} →
        </a>
        <p className="text-[11px] text-gray-500 mt-1">{t('apply_portal_url_hint')}</p>
      </div>

      <div>
        <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Building2 className="w-4 h-4" strokeWidth={1.75} />{t('apply_in_person_title')}</p>
        <p className="text-xs text-gray-600">{t('apply_in_person_desc')}</p>
      </div>

      <div>
        <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Mail className="w-4 h-4" strokeWidth={1.75} />{t('apply_email_title')}</p>
        <a href={`mailto:${FUND_EMAIL}`} className="text-brand text-xs font-semibold active:text-brand-hover">
          {FUND_EMAIL}
        </a>
        <p className="text-[11px] text-gray-500 mt-1">{t('apply_email_hint')}</p>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Phone className="w-4 h-4" strokeWidth={1.75} />{t('apply_help_title')}</p>
        <p className="text-xs text-gray-600">
          {t('apply_help_call_centre')}{' '}
          <a href={`tel:${FUND_CALL_CENTRE.replace(/\s/g, '')}`} className="text-brand font-semibold">
            {FUND_CALL_CENTRE}
          </a>
        </p>
        <p className="text-xs text-gray-500">{t('apply_help_hours')}</p>
        <p className="text-xs text-gray-600 mt-2">
          NEF:{' '}
          <a href={`tel:${NEF_PHONE.replace(/\s/g, '')}`} className="text-brand font-semibold">
            {NEF_PHONE}
          </a>
        </p>
        <p className="text-xs text-gray-600">
          SEDFA:{' '}
          <a href={`tel:${SEDFA_PHONE.replace(/\s/g, '')}`} className="text-brand font-semibold">
            {SEDFA_PHONE}
          </a>
        </p>
        <p className="text-xs text-gray-600">
          Email:{' '}
          <a href={`mailto:${FUND_EMAIL}`} className="text-brand font-semibold">
            {FUND_EMAIL}
          </a>
        </p>
      </div>
    </div>
  )
}
