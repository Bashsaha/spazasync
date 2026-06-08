'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { saveCart, loadCart, clearCartCache } from '@/lib/offline/db'
import {
  addProductLine,
  addCustomCartLine,
  removeCartLine,
  updateCartLineQty,
  cartTotal,
} from '@/lib/cart/operations'
import type { CartItem, Product } from '@/types'

interface UseCartReturn {
  items: CartItem[]
  total: number
  addItem: (product: Product) => void
  /**
   * Add a custom-priced line for the "No-name product" catch-all (Phase 47).
   * Always a NEW line (its own lineId) so multiple no-name items at different
   * prices stay separate. `unitPrice` is the price the teller typed.
   */
  addCustomLine: (product: Product, unitPrice: number) => void
  /** key = lineId for custom lines, product.id for normal lines. */
  removeItem: (key: string) => void
  updateQty: (key: string, qty: number) => void
  clearCart: () => void
}

export function useCart(): UseCartReturn {
  const [items, setItems] = useState<CartItem[]>([])
  const initialLoadDone = useRef(false)

  // Restore cart from IndexedDB on mount (crash recovery)
  useEffect(() => {
    loadCart().then((saved) => {
      if (saved && saved.length > 0) {
        setItems(saved)
      }
      initialLoadDone.current = true
    })
  }, [])

  // Persist to IndexedDB on every change (after initial load)
  useEffect(() => {
    if (!initialLoadDone.current) return
    if (items.length === 0) {
      clearCartCache()
    } else {
      saveCart(items)
    }
  }, [items])

  const total = cartTotal(items)

  const addItem = useCallback((product: Product) => {
    setItems((prev) => addProductLine(prev, product))
  }, [])

  const addCustomLine = useCallback((product: Product, unitPrice: number) => {
    setItems((prev) => addCustomCartLine(prev, product, unitPrice, crypto.randomUUID()))
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => removeCartLine(prev, key))
  }, [])

  const updateQty = useCallback((key: string, qty: number) => {
    setItems((prev) => updateCartLineQty(prev, key, qty))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    clearCartCache()
  }, [])

  return { items, total, addItem, addCustomLine, removeItem, updateQty, clearCart }
}
