import type { ReactNode } from 'react'
import { cx } from './cx'

interface SectionHeaderProps {
  title: ReactNode
  /** Right-aligned slot — typically a "See all →" link. */
  action?: ReactNode
  className?: string
}

/** Lightweight h2-equivalent that sits above a section within a page. */
export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cx('flex items-center justify-between gap-3 mb-3', className)}>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {action ? <div className="text-sm">{action}</div> : null}
    </div>
  )
}
