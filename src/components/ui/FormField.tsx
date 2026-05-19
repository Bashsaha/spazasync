import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react'
import { cx } from './cx'

// Shared input styling used by Input, Textarea, Select. Matches the canonical
// pattern already in the codebase: rounded-xl + gray-200 border + brand focus
// ring + 48px tap target.
const FIELD_BASE =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand ' +
  'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed ' +
  'placeholder:text-gray-400'

const FIELD_INVALID = 'border-red-300 focus:ring-red-500 focus:border-red-500'

// ── Input ──────────────────────────────────────────────────────────────────

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx(FIELD_BASE, invalid && FIELD_INVALID, className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})

// ── Textarea ───────────────────────────────────────────────────────────────

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(FIELD_BASE, invalid && FIELD_INVALID, 'resize-y min-h-[88px]', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})

// ── Select ─────────────────────────────────────────────────────────────────

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx(FIELD_BASE, invalid && FIELD_INVALID, 'pr-10', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  )
})

// ── Field wrapper ──────────────────────────────────────────────────────────

interface FormFieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  htmlFor?: string
  required?: boolean
  className?: string
  children: ReactNode
}

/** Wraps a label + control + hint/error around any input primitive.
 *  If the child input doesn't already have an `id`, you can pass `htmlFor`
 *  or rely on the auto-generated id from `useId`. The hint/error are
 *  rendered with `aria-describedby` style semantics implicit in the prose. */
export function FormField({
  label,
  hint,
  error,
  htmlFor,
  required,
  className,
  children,
}: FormFieldProps) {
  const autoId = useId()
  const id = htmlFor ?? autoId
  return (
    <div className={cx('space-y-1', className)}>
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
          {required ? <span className="text-red-600 ml-0.5">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}
