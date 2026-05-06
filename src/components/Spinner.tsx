interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-16 h-16 border-4',
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

/** Full-screen translucent overlay spinner — use during blocking operations.
 * z-[100] sits above the sticky CartSummary (z-50) and BottomNav. */
export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
    >
      <Spinner size="lg" className="text-white" />
      {label && <p className="text-white text-base font-medium">{label}</p>}
    </div>
  )
}
