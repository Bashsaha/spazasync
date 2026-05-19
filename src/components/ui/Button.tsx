import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold ' +
  'transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white active:bg-brand-hover',
  secondary: 'bg-brand-light text-brand-dark active:bg-brand-light/80',
  outline: 'bg-white text-gray-900 border border-line active:bg-gray-50',
  destructive: 'bg-red-600 text-white active:bg-red-700',
  ghost: 'bg-transparent text-brand active:bg-brand-light',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 min-h-[36px]',
  md: 'text-sm px-4 py-2.5 min-h-[44px]',
  lg: 'text-base px-5 py-3.5 min-h-[48px]',
}

type ButtonOwnProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  children?: ReactNode
}

export type ButtonProps = ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    icon: Icon,
    iconPosition = 'left',
    fullWidth = false,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" />
      ) : Icon && iconPosition === 'left' ? (
        <Icon className="w-4 h-4" aria-hidden />
      ) : null}
      {children}
      {!loading && Icon && iconPosition === 'right' ? (
        <Icon className="w-4 h-4" aria-hidden />
      ) : null}
    </button>
  )
})

type LinkButtonProps = ButtonOwnProps & {
  href: string
  className?: string
  prefetch?: boolean
  'aria-label'?: string
}

/** Same styling as `<Button>` but renders as a Next `<Link>` for soft
 *  navigation. Use when the click destination is a same-app route. */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  className,
  children,
  href,
  prefetch,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cx(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {Icon && iconPosition === 'left' ? <Icon className="w-4 h-4" aria-hidden /> : null}
      {children}
      {Icon && iconPosition === 'right' ? <Icon className="w-4 h-4" aria-hidden /> : null}
    </Link>
  )
}
