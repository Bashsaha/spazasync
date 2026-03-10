import { formatCurrency } from '@/lib/utils/currency'
import type { CartItem as CartItemType } from '@/types'

interface CartItemProps {
  item: CartItemType
  onRemove: (productId: string) => void
  onUpdateQty: (productId: string, qty: number) => void
}

export function CartItem({ item, onRemove, onUpdateQty }: CartItemProps) {
  const { product, quantity, subtotal } = item

  function decrement() {
    if (quantity === 1) {
      onRemove(product.id)
    } else {
      onUpdateQty(product.id, quantity - 1)
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      {/* product info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate text-sm">{product.name}</p>
        <p className="text-xs text-gray-400">{formatCurrency(product.price)} each</p>
      </div>

      {/* qty controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={decrement}
          aria-label="Decrease quantity"
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg leading-none active:bg-gray-200"
        >
          −
        </button>
        <span className="w-5 text-center font-semibold text-gray-900 text-sm">{quantity}</span>
        <button
          onClick={() => onUpdateQty(product.id, quantity + 1)}
          aria-label="Increase quantity"
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-bold text-lg leading-none active:bg-gray-200"
        >
          +
        </button>
      </div>

      {/* subtotal */}
      <span className="w-20 text-right font-semibold text-gray-900 text-sm">
        {formatCurrency(subtotal)}
      </span>
    </div>
  )
}
