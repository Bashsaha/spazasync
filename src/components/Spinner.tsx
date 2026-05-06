interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
}

/**
 * Circular loading spinner. Pure CSS — no JS, works offline.
 * Pairs with a label for accessibility (set aria-label on the parent).
 */
export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block ${SIZE_CLASSES[size]} rounded-full border-current border-t-transparent animate-spin ${className}`}
    />
  )
}

/** Full-screen translucent overlay spinner — use during blocking operations. */
export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
    >
      <Spinner size="lg" className="text-white" />
      {label && <p className="text-white text-sm font-medium">{label}</p>}
    </div>
  )
}
