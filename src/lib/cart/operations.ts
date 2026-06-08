// Pure cart-line operations (Phase 47). Extracted from useCart so the merge /
// custom-line / quantity logic is unit-testable without React or IndexedDB.
//
// Identity rule: a line's key is `lineId ?? product.id`. Normal products leave
// lineId undefined and MERGE by product.id. Custom "No-name product" lines each
// carry a unique lineId so several of them — at different prices — stay separate
// even though they share one product.id.

import type { CartItem, Product } from '@/types'

/** Stable identity key for a cart line. */
export function cartLineKey(item: CartItem): string {
  return item.lineId ?? item.product.id
}

/** Add a normal product: merge with its existing (non-custom) line, else append. */
export function addProductLine(items: CartItem[], product: Product): CartItem[] {
  const existing = items.find((i) => !i.lineId && i.product.id === product.id)
  if (existing) {
    const qty = existing.quantity + 1
    return items.map((i) =>
      i === existing ? { ...i, quantity: qty, subtotal: qty * product.price } : i,
    )
  }
  return [...items, { product, quantity: 1, subtotal: product.price }]
}

/**
 * Add a custom-priced line (the "No-name product" catch-all). Always a NEW line
 * keyed by `lineId`. The typed price is stamped onto a product clone so subtotal
 * math and the sale-submit `unit_price` mapping (both read product.price) work
 * unchanged.
 */
export function addCustomCartLine(
  items: CartItem[],
  product: Product,
  unitPrice: number,
  lineId: string,
): CartItem[] {
  return [
    ...items,
    { product: { ...product, price: unitPrice }, quantity: 1, subtotal: unitPrice, lineId },
  ]
}

/** Remove the line matching `key` (lineId for custom lines, product.id for normal). */
export function removeCartLine(items: CartItem[], key: string): CartItem[] {
  return items.filter((i) => cartLineKey(i) !== key)
}

/** Set a line's quantity (recomputing subtotal). Ignored for qty < 1. */
export function updateCartLineQty(items: CartItem[], key: string, qty: number): CartItem[] {
  if (qty < 1) return items
  return items.map((i) =>
    cartLineKey(i) === key ? { ...i, quantity: qty, subtotal: qty * i.product.price } : i,
  )
}

/** Sum of all line subtotals. */
export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.subtotal, 0)
}
