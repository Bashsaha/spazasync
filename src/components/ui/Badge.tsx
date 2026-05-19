import type { ReactNode } from 'react'
import { cx } from './cx'

export type BadgeTone = 'brand' | 'amber' | 'red' | 'green' | 'gray' | 'blue'

const TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-light text-brand-dark',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  green: 'bg-green-100 text-green-800',
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-800',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/** Inline pill chip for status labels, counts, tags. */
export function Badge({ tone = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
