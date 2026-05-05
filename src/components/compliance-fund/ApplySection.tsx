/**
 * Phase 37e — How to apply.
 *
 * Static external links. Government-verified contacts only (Design Rule 7):
 * SEFA portal, fund email, fund call centre.
 */

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  t: T
}

const SEFA_PORTAL_URL = 'https://systemsnew.sefa.org.za/SMMEPortal/'
const FUND_CALL_CENTRE = '011 305 8080'
const NEF_PHONE = '0861 843 633'
const SEDFA_PHONE = '012 748 9600'
const FUND_EMAIL = 'spazafund@nefcorp.co.za'
const SEFA_EMAIL = 'spaza@sefa.org.za'

export function ApplySection({ t }: Props) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">
        {t('apply_header')}
      </h2>

      <div className="space-y-4 text-sm">
        <div>
          <p className="font-semibold text-gray-900">💻 {t('apply_online_title')}</p>
          <a
            href={SEFA_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 text-xs font-semibold active:text-blue-800"
          >
            {t('apply_open_sefa_portal')} →
          </a>
        </div>

        <div>
          <p className="font-semibold text-gray-900">🏢 {t('apply_in_person_title')}</p>
          <p className="text-xs text-gray-600">{t('apply_in_person_desc')}</p>
        </div>

        <div>
          <p className="font-semibold text-gray-900">📧 {t('apply_email_title')}</p>
          <a
            href={`mailto:${SEFA_EMAIL}`}
            className="text-blue-600 text-xs font-semibold active:text-blue-800"
          >
            {SEFA_EMAIL}
          </a>
        </div>

        <div className="pt-3 border-t border-gray-100">
          <p className="font-semibold text-gray-900">📞 {t('apply_help_title')}</p>
          <p className="text-xs text-gray-600">
            {t('apply_help_call_centre')}{' '}
            <a href={`tel:${FUND_CALL_CENTRE.replace(/\s/g, '')}`} className="text-blue-600 font-semibold">
              {FUND_CALL_CENTRE}
            </a>
          </p>
          <p className="text-xs text-gray-500">{t('apply_help_hours')}</p>
          <p className="text-xs text-gray-600 mt-2">
            NEF:{' '}
            <a href={`tel:${NEF_PHONE.replace(/\s/g, '')}`} className="text-blue-600 font-semibold">
              {NEF_PHONE}
            </a>
          </p>
          <p className="text-xs text-gray-600">
            SEDFA:{' '}
            <a href={`tel:${SEDFA_PHONE.replace(/\s/g, '')}`} className="text-blue-600 font-semibold">
              {SEDFA_PHONE}
            </a>
          </p>
          <p className="text-xs text-gray-600">
            Email:{' '}
            <a href={`mailto:${FUND_EMAIL}`} className="text-blue-600 font-semibold">
              {FUND_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
