import { formatZAR } from '@/lib/utils/currency'
import type { CartItem as CartItemType } from '@/types'

interface CartItemProps {
  item: CartItemType
  onRemove: (productId: string) => void
  onUpdateQty: (productId: string, qty: number) => void
  threshold?: number
}

export function CartItem({ item, onRemove, onUpdateQty, threshold = 5 }: CartItemProps) {
  const { product, quantity, subtotal } = item

  function decrement() {
    if (quantity === 1) {
      onRemove(product.id)
    } else {
      onUpdateQty(product.id, quantity - 1)
    }
  }

  // Stock warning badge
  const stockBadge =
    product.stock_qty === 0 ? (
      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 mt-0.5">
        Out of stock
      </span>
    ) : quantity > product.stock_qty ? (
      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 mt-0.5">
        Only {product.stock_qty} left
      </span>
    ) : product.stock_qty <= threshold ? (
      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 mt-0.5">
        Low stock: {product.stock_qty} left
      </span>
    ) : null

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      {/* product info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate text-sm">{product.name}</p>
        <p className="text-xs text-gray-400">{formatZAR(product.price)} each</p>
        {stockBadge}
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
        {formatZAR(subtotal)}
      </span>
    </div>
  )
}
