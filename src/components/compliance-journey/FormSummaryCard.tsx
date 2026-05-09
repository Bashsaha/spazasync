/**
 * Phase 37c — pre-filled "Your details (copy onto the form)" card.
 *
 * Per the spec: the goal is to save shop owners from re-typing what Movestock
 * already knows. Each row is a label + value. When the value is missing we
 * either render `[Add in Settings →]` (something the owner can fix in the
 * app) or a literal "Fill in at the office" instruction (per Design Rule 6 —
 * we don't store ID/passport/tax numbers, so the owner writes them at the
 * counter).
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

type T = (key: string, params?: Record<string, string | number>) => string

export interface FormSummaryRow {
  /** i18n key for the field label, e.g. 'form_full_name'. */
  labelKey: string
  /** Resolved value, or null when missing. */
  value: string | null
  /** Override placeholder when value is null. Defaults to `[Add in Settings →]`. */
  missing?: 'fill_at_office' | 'add_in_settings' | 'unknown'
  /** When `missing === 'add_in_settings'`, link target. Defaults to /settings. */
  settingsHref?: string
}

interface Props {
  rows: FormSummaryRow[]
  t: T
  /** i18n key for the section header. */
  headerKey?: string
  /** i18n key for the warning footer (e.g. "Bring your ID to the office"). */
  footerKey?: string
  children?: ReactNode
}

export function FormSummaryCard({
  rows,
  t,
  headerKey = 'form_summary_header',
  footerKey,
  children,
}: Props) {
  return (
    <section className="bg-brand-light border border-brand-light rounded-xl p-4">
      <h4 className="text-sm font-semibold text-brand-hover mb-3">{t(headerKey)}</h4>
      <dl className="space-y-2">
        {rows.map((row, index) => (
          <div key={`${row.labelKey}-${index}`} className="flex items-baseline gap-3 text-sm">
            <dt className="text-brand-hover font-medium shrink-0 w-32">{t(row.labelKey)}</dt>
            <dd className="flex-1 min-w-0 text-gray-800 break-words">
              {row.value ? (
                row.value
              ) : row.missing === 'fill_at_office' ? (
                <span className="italic text-gray-500">{t('form_fill_at_office')}</span>
              ) : row.missing === 'unknown' ? (
                <span className="italic text-gray-500">{t('form_unknown')}</span>
              ) : (
                <Link
                  href={row.settingsHref ?? '/settings'}
                  className="text-brand active:text-brand-hover underline"
                >
                  {t('form_add_in_settings')}
                </Link>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {children}
      {footerKey && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
          ⚠️ {t(footerKey)}
        </p>
      )}
    </section>
  )
}
