import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { cx } from './cx'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

const BASE = 'bg-white border border-line rounded-2xl'

type CardOwnProps = {
  padding?: CardPadding
  children?: ReactNode
}

export type CardProps = CardOwnProps & HTMLAttributes<HTMLDivElement>

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding = 'md', className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cx(BASE, PADDING[padding], className)} {...rest}>
      {children}
    </div>
  )
})

type LinkCardProps = CardOwnProps & {
  href: string
  className?: string
  prefetch?: boolean
  'aria-label'?: string
}

/** Tappable card that navigates on click. Adds the press-state styling and
 *  `min-h-touch` so it meets the 48px tap-target spec. */
export function LinkCard({
  padding = 'md',
  className,
  children,
  href,
  prefetch,
  ...rest
}: LinkCardProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cx(BASE, PADDING[padding], 'block active:bg-gray-50 min-h-touch', className)}
      {...rest}
    >
      {children}
    </Link>
  )
}
