import { describe, it, expect } from 'vitest'
import { shapeStockTakeHistory, type RawStockTakeEntry } from '@/lib/db/stock-take-history'

const t = '2026-05-21T08:00:00.000Z'
const t2 = '2026-05-20T08:00:00.000Z'

function entry(over: Partial<RawStockTakeEntry>): RawStockTakeEntry {
  return {
    taken_at: t,
    qty_before: 10,
    qty_after: 10,
    teller_name: 'Amina',
    product_name: 'Milk 1L',
    ...over,
  }
}

describe('shapeStockTakeHistory', () => {
  it('groups entries that share taken_at + person into one session', () => {
    const sessions = shapeStockTakeHistory([
      entry({ product_name: 'Milk 1L' }),
      entry({ product_name: 'Bread' }),
    ])
    expect(sessions).toHaveLength(1)
    expect(sessions[0].items).toHaveLength(2)
    expect(sessions[0].counted_by).toBe('Amina')
  })

  it('splits sessions by person even at the same timestamp', () => {
    const sessions = shapeStockTakeHistory([
      entry({ teller_name: 'Amina' }),
      entry({ teller_name: 'Sipho' }),
    ])
    expect(sessions).toHaveLength(2)
  })

  it('splits sessions by timestamp', () => {
    const sessions = shapeStockTakeHistory([
      entry({ taken_at: t }),
      entry({ taken_at: t2 }),
    ])
    expect(sessions).toHaveLength(2)
  })

  it('counts only items whose quantity changed', () => {
    const sessions = shapeStockTakeHistory([
      entry({ product_name: 'A', qty_before: 10, qty_after: 10 }), // unchanged
      entry({ product_name: 'B', qty_before: 10, qty_after: 7 }), // changed
      entry({ product_name: 'C', qty_before: 0, qty_after: 5 }), // changed
    ])
    expect(sessions[0].changed_count).toBe(2)
    expect(sessions[0].items).toHaveLength(3)
  })

  it('computes signed delta per item', () => {
    const [s] = shapeStockTakeHistory([
      entry({ qty_before: 4, qty_after: 9 }),
    ])
    expect(s.items[0].delta).toBe(5)
  })

  it('returns most-recent session first', () => {
    const sessions = shapeStockTakeHistory([
      entry({ taken_at: t2 }), // older listed first in input
      entry({ taken_at: t }),
    ])
    expect(sessions[0].taken_at).toBe(t)
    expect(sessions[1].taken_at).toBe(t2)
  })

  it('falls back gracefully when person or product is null', () => {
    const [s] = shapeStockTakeHistory([
      entry({ teller_name: null, product_name: null }),
    ])
    expect(s.counted_by).toBeNull()
    expect(s.items[0].product_name).toBe('—')
  })

  it('returns an empty array for no entries', () => {
    expect(shapeStockTakeHistory([])).toEqual([])
  })
})
