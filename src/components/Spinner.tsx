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

/** Centered page-area spinner — use in loading.tsx for tab navigation.
 * Doesn't overlay BottomNav so the user can still switch tabs. */
export function PageSpinner({ label }: { label?: string }) {
  return (
    <main className="px-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Spinner size="lg" className="text-blue-600" />
      {label && <p className="text-gray-500 text-sm font-medium">{label}</p>}
    </main>
  )
}

/** Full-screen translucent overlay spinner — use during blocking operations.
 * Inline zIndex (9999) bypasses any Tailwind arbitrary-value cache issues
 * and guarantees we sit above sticky CartSummary, BottomNav, and modals. */
export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{ zIndex: 9999 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
    >
      <Spinner size="lg" className="text-white" />
      {label && <p className="text-white text-base font-medium">{label}</p>}
    </div>
  )
}
