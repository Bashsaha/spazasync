import type { FeatureTip } from './types'

/**
 * THE feature-tip catalog (Phase 46) — hand-authored from a walk of the whole
 * app. This is the "build-time inventory" the owner asked for: at runtime it is
 * just static data, no AI.
 *
 * Anchors map to `data-tour="<anchor>"` attributes placed on real elements:
 *   - ambient (no `route`): the bottom-nav tabs + New-Sale FAB — present on
 *     every home screen, so these tips show in-place wherever the owner is.
 *   - `today-summary`: lives on /dashboard only → Stocky navigates there first.
 *
 * Two kinds of tip:
 *   - CURRICULUM (no `trigger`): taught in `order` sequence, money-making core
 *     first (sell → see takings → stock → history → manage).
 *   - CONTEXTUAL (`trigger`): only surfaces when its real-world condition is
 *     true, and then jumps the queue (e.g. teach the stock screen exactly when
 *     something is running low). Pure rules — see triggers.ts.
 *
 * To add a feature here: pick a stable `id`, add the matching `data-tour`
 * attribute on the page, and add the `titleKey`/`bodyKey` to all five
 * guide.json locale files (the i18n parity test enforces this).
 */
export const CATALOG: FeatureTip[] = [
  // ---- Curriculum: earn & see money first -------------------------------
  {
    id: 'start-sale',
    anchor: 'start-sale',
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
    id: 'inventory-hub',
    anchor: 'nav-inventory',
    titleKey: 'tip_inventory_title',
    bodyKey: 'tip_inventory_body',
    order: 30,
  },
  {
    id: 'sales-hub',
    anchor: 'nav-sales',
    titleKey: 'tip_sales_title',
    bodyKey: 'tip_sales_body',
    order: 40,
  },
  {
    id: 'manage-hub',
    anchor: 'nav-manage',
    titleKey: 'tip_manage_title',
    bodyKey: 'tip_manage_body',
    order: 50,
  },

  // ---- Contextual: taught at the moment they matter ---------------------
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
