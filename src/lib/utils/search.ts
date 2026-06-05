/**
 * Sanitize a free-text search term before interpolating it into a PostgREST
 * `.or(...)` filter string (e.g. `name.ilike.%<term>%,barcode.ilike.%<term>%`).
 *
 * Inside `.or()` PostgREST treats a comma as the separator BETWEEN conditions
 * and parentheses as grouping — so a raw term like `x,stock_qty.gt.0` would
 * break out of the intended `ilike` and inject an extra predicate. Stripping
 * `,` `(` `)` closes that while preserving realistic searches: a dot is SAFE to
 * keep (it's a valid character inside a filter value, e.g. "1.5L"), so terms
 * like product names with decimals still match. RLS still scopes every result
 * to the caller's own shop regardless — this removes the within-shop
 * filter-logic break-out, not a cross-shop hole.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim()
}
