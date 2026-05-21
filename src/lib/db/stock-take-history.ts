import { createClient } from '@/lib/supabase/server'

/** One counted product line within a session. */
export interface StockTakeHistoryItem {
  product_name: string
  qty_before: number
  qty_after: number
  delta: number
}

/** A single stock-count session — one form submit by one person. */
export interface StockTakeSession {
  /** Stable key for React lists: taken_at + teller. */
  key: string
  /** ISO timestamp the count was recorded. */
  taken_at: string
  /** Display name of who counted, or null if it couldn't be attributed. */
  counted_by: string | null
  /** Every product touched in this session. */
  items: StockTakeHistoryItem[]
  /** How many of the items actually changed (qty_after !== qty_before). */
  changed_count: number
}

/** Normalised input row — one stock_take_entries row with its joins flattened. */
export interface RawStockTakeEntry {
  taken_at: string
  qty_before: number
  qty_after: number
  teller_name: string | null
  product_name: string | null
}

/**
 * Group raw stock-take entries into sessions. A "session" is one form submit:
 * Postgres evaluates now() once per transaction, so every row from a single
 * saveStockTake() insert shares the same taken_at — we group on (taken_at,
 * teller_name). Pure (no DB / no clock) so it's unit-testable.
 *
 * Returns sessions most-recent-first; items within a session preserve input
 * order (the caller fetches newest-first, so callers should pass entries in the
 * order they want items displayed).
 */
export function shapeStockTakeHistory(entries: RawStockTakeEntry[]): StockTakeSession[] {
  const sessions = new Map<string, StockTakeSession>()
  const order: string[] = []

  for (const e of entries) {
    const key = `${e.taken_at}__${e.teller_name ?? ''}`
    let session = sessions.get(key)
    if (!session) {
      session = {
        key,
        taken_at: e.taken_at,
        counted_by: e.teller_name,
        items: [],
        changed_count: 0,
      }
      sessions.set(key, session)
      order.push(key)
    }
    const delta = e.qty_after - e.qty_before
    session.items.push({
      product_name: e.product_name ?? '—',
      qty_before: e.qty_before,
      qty_after: e.qty_after,
      delta,
    })
    if (delta !== 0) session.changed_count += 1
  }

  return order
    .map((k) => sessions.get(k)!)
    .sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime())
}

/**
 * Fetch recent stock-count sessions for a shop, attributed to the person who
 * did each count. Scoped by RLS (caller must be in the shop). Capped at the
 * most recent 500 entry rows.
 */
export async function getStockTakeHistory(shopId: string): Promise<StockTakeSession[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('stock_take_entries')
    .select('taken_at, qty_before, qty_after, tellers(name), products(name)')
    .eq('shop_id', shopId)
    .order('taken_at', { ascending: false })
    .limit(500)

  if (error) throw error

  const rows: RawStockTakeEntry[] = (data ?? []).map((r) => {
    // Supabase returns the joined relation as an object (or array under some
    // configs) — normalise both shapes to a flat name.
    const teller = r.tellers as { name?: string } | { name?: string }[] | null
    const product = r.products as { name?: string } | { name?: string }[] | null
    const tellerName = Array.isArray(teller) ? teller[0]?.name : teller?.name
    const productName = Array.isArray(product) ? product[0]?.name : product?.name
    return {
      taken_at: r.taken_at as string,
      qty_before: (r.qty_before as number) ?? 0,
      qty_after: (r.qty_after as number) ?? 0,
      teller_name: tellerName ?? null,
      product_name: productName ?? null,
    }
  })

  return shapeStockTakeHistory(rows)
}
