'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { saveCart, loadCart, clearCartCache } from '@/lib/offline/db'
import type { CartItem, Product } from '@/types'

interface UseCartReturn {
  items: CartItem[]
  total: number
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
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

  const total = items.reduce((sum, item) => sum + item.subtotal, 0)

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        const qty = existing.quantity + 1
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: qty, subtotal: qty * product.price }
            : i,
        )
      }
      return [...prev, { product, quantity: 1, subtotal: product.price }]
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }, [])

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty < 1) return
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: qty, subtotal: qty * i.product.price }
          : i,
      ),
    )
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    clearCartCache()
  }, [])

  return { items, total, addItem, removeItem, updateQty, clearCart }
}
