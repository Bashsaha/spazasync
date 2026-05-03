/**
 * Phase 37c — "What you need to bring" list shown inside a step card.
 *
 * Renders a server-side list pulled from `municipality_requirements`. Items
 * with a `notes` field render the note as muted secondary copy. When a doc
 * row is missing entirely (no requirement found for the municipality), we
 * fall back to a generic baseline list so the section never reads as empty.
 */

import type { DocumentRequirement } from '@/types'

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  requirements: DocumentRequirement[]
  t: T
  /** i18n key for the section header (e.g. 'permit_what_to_bring'). */
  headerKey: string
  /** When the municipality has no requirement row, render this fallback. */
  fallbackKey?: string
}

export function DocumentChecklist({
  requirements,
  t,
  headerKey,
  fallbackKey,
}: Props) {
  const isEmpty = requirements.length === 0

  return (
    <section>
      <h4 className="text-sm font-semibold text-gray-800 mb-2">{t(headerKey)}</h4>
      {isEmpty ? (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          {fallbackKey ? t(fallbackKey) : t('checklist_unknown_fallback')}
        </p>
      ) : (
        <ul className="space-y-2">
          {requirements.map((req, index) => (
            <li
              key={`${req.name}-${index}`}
              className="flex items-start gap-2 text-sm"
            >
              <span
                className="mt-0.5 inline-flex items-center justify-center w-4 h-4 border border-gray-300 rounded-sm shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-gray-800">{req.name}</p>
                {req.notes ? (
                  <p className="text-xs text-gray-500 mt-0.5">{req.notes}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
