import { formatZAR } from '@/lib/utils/currency'

interface CartSummaryProps {
  total: number
  itemCount: number
  onCompleteSale: () => void
  isSubmitting: boolean
}

/**
 * Sticky bottom bar showing the cart total and Complete Sale button.
 */
export function CartSummary({ total, itemCount, onCompleteSale, isSubmitting }: CartSummaryProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-lg mx-auto flex items-center gap-4 px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex-shrink-0">
          <p className="text-xs text-gray-400">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xl font-bold text-gray-900">{formatZAR(total)}</p>
        </div>

        <button
          onClick={onCompleteSale}
          disabled={isSubmitting || itemCount === 0}
          className="flex-1 bg-orange-500 text-white font-semibold py-3 rounded-xl active:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-base"
        >
          {isSubmitting ? 'Processing…' : 'Complete Sale'}
        </button>
      </div>
    </div>
  )
}
