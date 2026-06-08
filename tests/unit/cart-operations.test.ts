import { describe, it, expect } from 'vitest'
import {
  addProductLine,
  addCustomCartLine,
  removeCartLine,
  updateCartLineQty,
  cartTotal,
  cartLineKey,
} from '@/lib/cart/operations'
import type { CartItem, Product } from '@/types'

function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    shop_id: 's1',
    barcode: null,
    name: 'Bread',
    price: 10,
    cost_price: null,
    stock_qty: 5,
    supplier_id: null,
    created_at: '2026-06-08T00:00:00.000Z',
    ...over,
  }
}

const catchAll = product({ id: 'catch', name: 'No-name product', price: 0, track_stock: false, is_catch_all: true })

describe('cart operations — normal products', () => {
  it('appends a new product as quantity 1', () => {
    const items = addProductLine([], product())
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ quantity: 1, subtotal: 10 })
    expect(items[0].lineId).toBeUndefined()
  })

  it('merges a repeat add of the same product', () => {
    let items: CartItem[] = []
    items = addProductLine(items, product())
    items = addProductLine(items, product())
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ quantity: 2, subtotal: 20 })
  })
})

describe('cart operations — No-name custom lines', () => {
  it('each custom add is its own line, never merged', () => {
    let items: CartItem[] = []
    items = addCustomCartLine(items, catchAll, 12, 'line-1')
    items = addCustomCartLine(items, catchAll, 5, 'line-2')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ lineId: 'line-1', subtotal: 12 })
    expect(items[1]).toMatchObject({ lineId: 'line-2', subtotal: 5 })
    // The typed price is stamped onto the product clone.
    expect(items[0].product.price).toBe(12)
    expect(items[1].product.price).toBe(5)
  })

  it('does not merge custom lines into a normal line for the same product id', () => {
    // Pathological: a normal product that happens to share the catch-all id.
    let items: CartItem[] = addProductLine([], product({ id: 'catch', price: 99 }))
    items = addCustomCartLine(items, catchAll, 3, 'line-1')
    expect(items).toHaveLength(2)
  })

  it('keys custom lines on lineId and normal lines on product.id', () => {
    const normal = addProductLine([], product())[0]
    const custom = addCustomCartLine([], catchAll, 7, 'line-x')[0]
    expect(cartLineKey(normal)).toBe('p1')
    expect(cartLineKey(custom)).toBe('line-x')
  })
})

describe('cart operations — qty + remove + total', () => {
  it('updates qty by line key and recomputes subtotal at that line price', () => {
    let items = addCustomCartLine([], catchAll, 12, 'line-1')
    items = updateCartLineQty(items, 'line-1', 3)
    expect(items[0]).toMatchObject({ quantity: 3, subtotal: 36 })
  })

  it('ignores qty < 1', () => {
    const items = addProductLine([], product())
    expect(updateCartLineQty(items, 'p1', 0)).toEqual(items)
  })

  it('removes the matching line only', () => {
    let items = addProductLine([], product())
    items = addCustomCartLine(items, catchAll, 4, 'line-1')
    items = removeCartLine(items, 'line-1')
    expect(items).toHaveLength(1)
    expect(items[0].product.id).toBe('p1')
  })

  it('totals mixed normal + custom lines', () => {
    let items = addProductLine([], product())       // 10
    items = addProductLine(items, product())          // -> 20
    items = addCustomCartLine(items, catchAll, 12, 'a') // +12
    items = addCustomCartLine(items, catchAll, 5, 'b')  // +5
    expect(cartTotal(items)).toBe(37)
  })
})
