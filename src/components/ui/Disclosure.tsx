'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from './cx'

interface DisclosureProps {
  /** Header label — always visible, the tap target that toggles open/closed. */
  title: ReactNode
  /** Optional right-aligned summary shown in the header when collapsed
   *  (e.g. a Badge "Eligible ✓" or "4 of 6 ready"). Hidden when open. */
  summary?: ReactNode
  /** Start expanded. Defaults to collapsed so the page stays short on a phone. */
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

/** Collapsible section. The default-collapsed accordion that lets dense
 *  reference content (tier tables, contacts, eligibility questions) live on
 *  the page without dominating it. Expand is instant — no height animation —
 *  which also keeps it correct under `prefers-reduced-motion`.
 *
 *  Convention: reach for this instead of hand-rolling a `useState` +
 *  conditional-render block whenever a section should fold away. */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <section
      className={cx('bg-white border border-line rounded-2xl overflow-hidden', className)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full min-h-touch flex items-center justify-between gap-3 px-5 py-4 text-left active:bg-gray-50"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="flex items-center gap-2 shrink-0">
          {!open && summary ? summary : null}
          <ChevronDown
            className={cx(
              'w-5 h-5 text-gray-400 transition-transform',
              open && 'rotate-180',
            )}
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="px-5 pb-5 pt-0">
          {children}
        </div>
      ) : null}
    </section>
  )
}
