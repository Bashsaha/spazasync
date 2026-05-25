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
 * Fetch recent stock-change sessions for a shop, attributed to the person who
 * made each change. Sources:
 *   - stock_take_entries — bulk "Count stock" submissions on /stock-take
 *   - stock_adjustments — single-product Add / Remove on /stock/[id]
 *
 * Both are merged into one chronological list so owners can see every stock
 * change in one place. Scoped by RLS (caller must be in the shop). Capped at
 * the most recent 500 combined entry rows.
 */
export async function getStockTakeHistory(shopId: string): Promise<StockTakeSession[]> {
  const supabase = await createClient()

  const [takeRes, adjustRes, tellersRes] = await Promise.all([
    supabase
      .from('stock_take_entries')
      .select('taken_at, qty_before, qty_after, tellers(name), products(name)')
      .eq('shop_id', shopId)
      .order('taken_at', { ascending: false })
      .limit(500),
    // stock_adjustments has no FK to tellers (adjusted_by → auth.users.id),
    // so we resolve names via a separate tellers lookup below.
    supabase
      .from('stock_adjustments')
      .select('adjusted_at, qty_before, qty_after, adjusted_by, products(name)')
      .eq('shop_id', shopId)
      .order('adjusted_at', { ascending: false })
      .limit(500),
    supabase
      .from('tellers')
      .select('user_id, name')
      .eq('shop_id', shopId),
  ])

  if (takeRes.error) throw takeRes.error
  if (adjustRes.error) throw adjustRes.error

  const userIdToName = new Map<string, string>()
  for (const t of tellersRes.data ?? []) {
    const uid = t.user_id as string | null
    const name = t.name as string | null
    if (uid && name) userIdToName.set(uid, name)
  }

  // Supabase returns joined relations as either an object or a single-element
  // array depending on PostgREST inference — normalise both shapes to a name.
  const extractName = (rel: unknown): string | null => {
    const r = rel as { name?: string } | { name?: string }[] | null
    if (!r) return null
    return (Array.isArray(r) ? r[0]?.name : r.name) ?? null
  }

  const takeRows: RawStockTakeEntry[] = (takeRes.data ?? []).map((r) => ({
    taken_at: r.taken_at as string,
    qty_before: (r.qty_before as number) ?? 0,
    qty_after: (r.qty_after as number) ?? 0,
    teller_name: extractName(r.tellers),
    product_name: extractName(r.products),
  }))

  const adjustRows: RawStockTakeEntry[] = (adjustRes.data ?? []).map((r) => {
    const adjustedBy = r.adjusted_by as string | null
    return {
      taken_at: r.adjusted_at as string,
      qty_before: (r.qty_before as number) ?? 0,
      qty_after: (r.qty_after as number) ?? 0,
      teller_name: adjustedBy ? userIdToName.get(adjustedBy) ?? null : null,
      product_name: extractName(r.products),
    }
  })

  // Merge, sort by timestamp desc, cap at 500 most-recent combined rows.
  const allRows = [...takeRows, ...adjustRows]
    .sort((a, b) => b.taken_at.localeCompare(a.taken_at))
    .slice(0, 500)

  return shapeStockTakeHistory(allRows)
}
