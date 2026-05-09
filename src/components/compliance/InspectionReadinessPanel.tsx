/**
 * Phase 37c — reusable inspection-readiness panel.
 *
 * Originally inlined in [src/app/(app)/inspection/page.tsx]. The Compliance
 * Journey Hub Step 2 (Health Certificate) renders the same panel, so we lift
 * it into a shared component to avoid drift.
 *
 * Server component: takes a pre-computed InspectionReadinessResult plus an
 * `inspection`-namespace `t` function. Stays pure-presentational so callers
 * own the data fetch and can choose where to render it.
 */

import Link from 'next/link'
import type { InspectionReadinessResult } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  result: InspectionReadinessResult
  t: T
  /** Optional override for the section header (defaults to "Inspection-day checklist"). */
  headerKey?: string
  /** Hide the header row when embedding inside a card that already has one. */
  showHeader?: boolean
}

export function InspectionReadinessPanel({
  result,
  t,
  headerKey = 'pre_check_header',
  showHeader = true,
}: Props) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {showHeader && (
        <h2 className="text-sm font-semibold text-gray-700 px-4 pt-4 pb-2">
          {t(headerKey)}
        </h2>
      )}
      <ul className="divide-y divide-gray-100">
        {result.checks.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-between px-4 py-3 gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  row.pass
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
                aria-hidden="true"
              >
                {row.pass ? '✓' : '✗'}
              </span>
              <p className="text-sm text-gray-800 truncate">{t(row.key)}</p>
            </div>
            {row.pass ? (
              <span className="text-xs text-green-600 font-medium shrink-0">
                {t('ok')}
              </span>
            ) : (
              <Link
                href={row.fixHref}
                className="text-xs font-semibold text-brand active:text-brand-hover shrink-0"
              >
                {t('fix_now')} &rsaquo;
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
