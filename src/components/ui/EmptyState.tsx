import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'

interface EmptyStateProps {
  icon?: LucideIcon
  title: ReactNode
  body?: ReactNode
  /** Optional CTA — typically a `<Button>` or `<LinkButton>`. */
  action?: ReactNode
  className?: string
}

/** Friendly empty-state block: icon + title + supporting copy + optional CTA.
 *  Designed to replace the bespoke "no products yet" / "no sales yet" markup
 *  scattered across list pages. */
export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center text-center py-12 px-6 bg-white border border-line rounded-2xl',
        className,
      )}
    >
      {Icon ? (
        <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-brand" aria-hidden />
        </div>
      ) : null}
      <p className="text-base font-semibold text-gray-900">{title}</p>
      {body ? <p className="text-sm text-gray-500 mt-1 max-w-xs">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
