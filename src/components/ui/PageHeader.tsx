import type { ReactNode } from 'react'
import { cx } from './cx'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned slot for an action button or status pill. */
  action?: ReactNode
  className?: string
}

/** Standard h1 + optional subtitle that sits at the top of every page.
 *  Sweeping all hand-written `<h1 className="text-2xl font-bold ...">`
 *  blocks behind this component keeps the page-header pattern uniform. */
export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cx('flex items-start justify-between gap-3 mb-6', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
