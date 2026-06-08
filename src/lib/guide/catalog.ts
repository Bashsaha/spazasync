import type { FeatureTip } from './types'

/**
 * THE feature-tip catalog (Phase 46 → 47) — hand-authored from a walk of the
 * whole app. This is the "build-time inventory": at runtime it is just static
 * data, no AI.
 *
 * Anchors map to `data-tour="<anchor>"` attributes placed on real elements:
 *   - ROUTE tips: one per guide screen, anchored to that page's primary element,
 *     so each page's help sheet always has at least one thing to show.
 *   - CONTEXTUAL tips (with a `trigger`, no `route`): ambient — anchored to the
 *     bottom-nav tabs / New-Sale FAB which exist on every guide screen — so they
 *     surface wherever the owner is, but only while their condition is true, and
 *     then they sort first + light the dot.
 *
 * To add a feature here: pick a stable `id`, add the matching `data-tour`
 * attribute on the page, and add the `titleKey`/`bodyKey` to all five
 * guide.json locale files (the i18n parity test enforces this).
 */
export const CATALOG: FeatureTip[] = [
  // ---- Route tips: one per guide screen ---------------------------------
  {
    id: 'start-sale',
    anchor: 'start-sale',
    route: '/dashboard',
    titleKey: 'tip_start_sale_title',
    bodyKey: 'tip_start_sale_body',
    order: 10,
  },
  {
    id: 'today-summary',
    anchor: 'today-summary',
    route: '/dashboard',
    titleKey: 'tip_today_summary_title',
    bodyKey: 'tip_today_summary_body',
    order: 20,
  },
  {
    id: 'inventory-stock',
    anchor: 'inventory-stock',
    route: '/inventory',
    titleKey: 'tip_inventory_title',
    bodyKey: 'tip_inventory_body',
    order: 30,
  },
  {
    id: 'stock-scan',
    anchor: 'stock-scan',
    route: '/stock',
    titleKey: 'tip_stock_scan_title',
    bodyKey: 'tip_stock_scan_body',
    order: 32,
  },
  {
    id: 'product-add',
    anchor: 'product-add',
    route: '/products',
    titleKey: 'tip_product_add_title',
    bodyKey: 'tip_product_add_body',
    order: 34,
  },
  {
    id: 'sales-history',
    anchor: 'sales-history',
    route: '/sales',
    titleKey: 'tip_sales_title',
    bodyKey: 'tip_sales_body',
    order: 40,
  },
  {
    id: 'manage-journey',
    anchor: 'manage-journey',
    route: '/manage',
    titleKey: 'tip_manage_title',
    bodyKey: 'tip_manage_body',
    order: 50,
  },

  // ---- Contextual: ambient, surface only at the moment they matter ------
  {
    id: 'low-stock',
    anchor: 'nav-inventory',
    titleKey: 'tip_low_stock_title',
    bodyKey: 'tip_low_stock_body',
    order: 5,
    trigger: 'low_stock',
  },
  {
    id: 'expiring-soon',
    anchor: 'nav-inventory',
    titleKey: 'tip_expiring_title',
    bodyKey: 'tip_expiring_body',
    order: 6,
    trigger: 'expiring_soon',
  },
  {
    id: 'missing-cost',
    anchor: 'nav-inventory',
    titleKey: 'tip_missing_cost_title',
    bodyKey: 'tip_missing_cost_body',
    order: 7,
    trigger: 'missing_cost',
  },
  {
    id: 'no-sale-today',
    anchor: 'start-sale',
    titleKey: 'tip_no_sale_title',
    bodyKey: 'tip_no_sale_body',
    order: 8,
    trigger: 'no_sale_today',
  },
]
