import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'

export type CalloutTone = 'info' | 'warning' | 'error' | 'success' | 'brand'

const TONES: Record<CalloutTone, { wrap: string; title: string; body: string; icon: string }> = {
  info: {
    wrap: 'bg-blue-50 border-blue-200',
    title: 'text-blue-900',
    body: 'text-blue-800',
    icon: 'text-blue-600',
  },
  warning: {
    wrap: 'bg-amber-50 border-amber-200',
    title: 'text-amber-900',
    body: 'text-amber-800',
    icon: 'text-amber-600',
  },
  error: {
    wrap: 'bg-red-50 border-red-200',
    title: 'text-red-900',
    body: 'text-red-800',
    icon: 'text-red-600',
  },
  success: {
    wrap: 'bg-green-50 border-green-200',
    title: 'text-green-900',
    body: 'text-green-800',
    icon: 'text-green-600',
  },
  brand: {
    wrap: 'bg-brand-light border-brand-light',
    title: 'text-brand-dark',
    body: 'text-brand-dark',
    icon: 'text-brand',
  },
}

interface CalloutProps {
  tone?: CalloutTone
  icon?: LucideIcon
  title?: ReactNode
  /** Body content. Optional — title-only callouts are valid. */
  children?: ReactNode
  className?: string
}

/** Standardised info / warning / error / success banner.
 *  Replaces every hand-written `<div className="bg-amber-50 border ...">`. */
export function Callout({
  tone = 'info',
  icon: Icon,
  title,
  children,
  className,
}: CalloutProps) {
  const t = TONES[tone]
  return (
    <div className={cx('border rounded-2xl p-4 flex gap-3', t.wrap, className)}>
      {Icon ? <Icon className={cx('w-5 h-5 shrink-0 mt-0.5', t.icon)} aria-hidden /> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className={cx('text-sm font-semibold', t.title)}>{title}</p> : null}
        {children ? (
          <div className={cx('text-sm', t.body, !!title && 'mt-1')}>{children}</div>
        ) : null}
      </div>
    </div>
  )
}
