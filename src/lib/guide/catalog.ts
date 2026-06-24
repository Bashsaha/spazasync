import type { FeatureTip } from './types'

/**
 * THE feature-tip catalog (Phase 46 → 47 → 49) — hand-authored from a walk of the
 * whole app. This is the "build-time inventory": at runtime it is just static
 * data, no AI.
 *
 * Anchors map to `data-tour="<anchor>"` attributes placed on real elements:
 *   - ROUTE tips: belong to one guide screen (matched via `matchGuideRoute`), so
 *     each page's help sheet shows everything teachable on that page. Grouped into
 *     sheet sections via `group` (basics / reports / setup) to stay scannable.
 *   - CONTEXTUAL tips (with a `trigger`, no `route`): ambient — anchored to the
 *     bottom-nav tabs / New-Sale FAB which exist on every guide screen — so they
 *     surface wherever the owner is, but only while their condition is true, and
 *     then they pin to the "Needs attention" section + light the dot.
 *
 * To add a feature here: pick a stable `id`, add the matching `data-tour`
 * attribute on the page, give it a `route` (canonical key) + `group`, and add the
 * `titleKey`/`bodyKey` to all five guide.json locale files (the i18n parity test
 * enforces this).
 */
export const CATALOG: FeatureTip[] = [
  // ======================================================================
  // Contextual: ambient, surface only at the moment they matter (pinned to
  // the "Needs attention" section when active).
  // ======================================================================
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

  // ======================================================================
  // /dashboard
  // ======================================================================
  {
    id: 'start-sale',
    anchor: 'start-sale',
    route: '/dashboard',
    titleKey: 'tip_start_sale_title',
    bodyKey: 'tip_start_sale_body',
    group: 'basics',
    order: 10,
  },
  {
    id: 'today-summary',
    anchor: 'today-summary',
    route: '/dashboard',
    titleKey: 'tip_today_summary_title',
    bodyKey: 'tip_today_summary_body',
    group: 'basics',
    order: 20,
  },
  {
    id: 'dash-latest-sales',
    anchor: 'latest-sales',
    route: '/dashboard',
    titleKey: 'tip_dash_latest_title',
    bodyKey: 'tip_dash_latest_body',
    group: 'reports',
    order: 30,
  },
  {
    id: 'dash-compliance',
    anchor: 'compliance-card',
    route: '/dashboard',
    titleKey: 'tip_dash_compliance_title',
    bodyKey: 'tip_dash_compliance_body',
    group: 'setup',
    order: 40,
  },
  {
    id: 'dash-journey',
    anchor: 'journey-card',
    route: '/dashboard',
    titleKey: 'tip_dash_journey_title',
    bodyKey: 'tip_dash_journey_body',
    group: 'setup',
    order: 42,
  },

  // ======================================================================
  // /sales (hub)
  // ======================================================================
  {
    id: 'sales-start',
    anchor: 'sales-start-sale',
    route: '/sales',
    titleKey: 'tip_sales_start_title',
    bodyKey: 'tip_sales_start_body',
    group: 'basics',
    order: 10,
  },
  {
    id: 'sales-today',
    anchor: 'sales-today',
    route: '/sales',
    titleKey: 'tip_sales_today_title',
    bodyKey: 'tip_sales_today_body',
    group: 'basics',
    order: 12,
  },
  {
    id: 'sales-weekly',
    anchor: 'sales-weekly',
    route: '/sales',
    titleKey: 'tip_sales_weekly_title',
    bodyKey: 'tip_sales_weekly_body',
    group: 'reports',
    order: 30,
  },
  {
    id: 'sales-top-products',
    anchor: 'sales-top-products',
    route: '/sales',
    titleKey: 'tip_sales_top_title',
    bodyKey: 'tip_sales_top_body',
    group: 'reports',
    order: 32,
  },
  {
    id: 'sales-history',
    anchor: 'sales-history',
    route: '/sales',
    titleKey: 'tip_sales_history_title',
    bodyKey: 'tip_sales_history_body',
    group: 'reports',
    order: 34,
  },
  {
    id: 'sales-statistics',
    anchor: 'sales-statistics',
    route: '/sales',
    titleKey: 'tip_sales_stats_title',
    bodyKey: 'tip_sales_stats_body',
    group: 'reports',
    order: 36,
  },

  // ======================================================================
  // /inventory (hub)
  // ======================================================================
  {
    id: 'inventory-stock',
    anchor: 'inventory-stock',
    route: '/inventory',
    titleKey: 'tip_inventory_title',
    bodyKey: 'tip_inventory_body',
    group: 'basics',
    order: 10,
  },
  {
    id: 'inventory-products',
    anchor: 'inventory-products',
    route: '/inventory',
    titleKey: 'tip_inv_products_title',
    bodyKey: 'tip_inv_products_body',
    group: 'basics',
    order: 12,
  },
  {
    id: 'inventory-expiry',
    anchor: 'inventory-expiry',
    route: '/inventory',
    titleKey: 'tip_inv_expiry_title',
    bodyKey: 'tip_inv_expiry_body',
    group: 'basics',
    order: 14,
  },
  {
    id: 'inventory-counts',
    anchor: 'inventory-counts',
    route: '/inventory',
    titleKey: 'tip_inv_counts_title',
    bodyKey: 'tip_inv_counts_body',
    group: 'reports',
    order: 20,
  },
  {
    id: 'inventory-stock-take',
    anchor: 'inventory-stock-take',
    route: '/inventory',
    titleKey: 'tip_inv_stocktake_title',
    bodyKey: 'tip_inv_stocktake_body',
    group: 'setup',
    order: 30,
  },
  {
    id: 'inventory-suppliers',
    anchor: 'inventory-suppliers',
    route: '/inventory',
    titleKey: 'tip_inv_suppliers_title',
    bodyKey: 'tip_inv_suppliers_body',
    group: 'setup',
    order: 32,
  },

  // ======================================================================
  // /stock (list)
  // ======================================================================
  {
    id: 'stock-scan',
    anchor: 'stock-scan',
    route: '/stock',
    titleKey: 'tip_stock_scan_title',
    bodyKey: 'tip_stock_scan_body',
    group: 'basics',
    order: 10,
  },
  {
    id: 'stock-search',
    anchor: 'stock-search',
    route: '/stock',
    titleKey: 'tip_stock_search_title',
    bodyKey: 'tip_stock_search_body',
    group: 'basics',
    order: 12,
  },
  {
    id: 'stock-tabs',
    anchor: 'stock-tabs',
    route: '/stock',
    titleKey: 'tip_stock_tabs_title',
    bodyKey: 'tip_stock_tabs_body',
    group: 'basics',
    order: 14,
  },
  {
    id: 'stock-summary',
    anchor: 'stock-summary',
    route: '/stock',
    titleKey: 'tip_stock_summary_title',
    bodyKey: 'tip_stock_summary_body',
    group: 'reports',
    order: 20,
  },

  // ======================================================================
  // /stock/[id] (adjust a product's stock + batches)
  // ======================================================================
  {
    id: 'sd-adjust',
    anchor: 'adjust-mode',
    route: '/stock/[id]',
    titleKey: 'tip_sd_adjust_title',
    bodyKey: 'tip_sd_adjust_body',
    group: 'basics',
    order: 10,
  },
  {
    id: 'sd-quick',
    anchor: 'adjust-quick',
    route: '/stock/[id]',
    titleKey: 'tip_sd_quick_title',
    bodyKey: 'tip_sd_quick_body',
    group: 'basics',
    order: 12,
  },
  {
    id: 'sd-batches',
    anchor: 'stock-batches',
    route: '/stock/[id]',
    titleKey: 'tip_sd_batches_title',
    bodyKey: 'tip_sd_batches_body',
    group: 'setup',
    order: 30,
  },

  // ======================================================================
  // /products (list)
  // ======================================================================
  {
    id: 'product-add',
    anchor: 'product-add',
    route: '/products',
    titleKey: 'tip_product_add_title',
    bodyKey: 'tip_product_add_body',
    group: 'basics',
    order: 10,
  },
  {
    id: 'products-import',
    anchor: 'products-import',
    route: '/products',
    titleKey: 'tip_products_import_title',
    bodyKey: 'tip_products_import_body',
    group: 'basics',
    order: 12,
  },
  {
    id: 'products-search',
    anchor: 'products-search',
    route: '/products',
    titleKey: 'tip_products_search_title',
    bodyKey: 'tip_products_search_body',
    group: 'basics',
    order: 14,
  },
  {
    id: 'products-row',
    anchor: 'products-row',
    route: '/products',
    titleKey: 'tip_products_row_title',
    bodyKey: 'tip_products_row_body',
    group: 'basics',
    order: 16,
  },

  // ======================================================================
  // /manage (hub)
  // ======================================================================
  {
    id: 'manage-staff',
    anchor: 'manage-staff',
    route: '/manage',
    titleKey: 'tip_manage_staff_title',
    bodyKey: 'tip_manage_staff_body',
    group: 'setup',
    order: 10,
  },
  {
    id: 'manage-journey',
    anchor: 'manage-journey',
    route: '/manage',
    titleKey: 'tip_manage_title',
    bodyKey: 'tip_manage_body',
    group: 'setup',
    order: 12,
  },
  {
    id: 'manage-compliance',
    anchor: 'manage-compliance',
    route: '/manage',
    titleKey: 'tip_manage_compliance_title',
    bodyKey: 'tip_manage_compliance_body',
    group: 'setup',
    order: 14,
  },
  {
    id: 'manage-waste-pest',
    anchor: 'manage-waste-pest',
    route: '/manage',
    titleKey: 'tip_manage_waste_pest_title',
    bodyKey: 'tip_manage_waste_pest_body',
    group: 'setup',
    order: 16,
  },

  // ======================================================================
  // /sales/statistics
  // ======================================================================
  {
    id: 'stat-range',
    anchor: 'stats-range',
    route: '/sales/statistics',
    titleKey: 'tip_stat_range_title',
    bodyKey: 'tip_stat_range_body',
    group: 'basics',
    order: 10,
  },
  {
    id: 'stat-tiles',
    anchor: 'stats-tiles',
    route: '/sales/statistics',
    titleKey: 'tip_stat_tiles_title',
    bodyKey: 'tip_stat_tiles_body',
    group: 'reports',
    order: 20,
  },
  {
    id: 'stat-trend',
    anchor: 'stats-trend',
    route: '/sales/statistics',
    titleKey: 'tip_stat_trend_title',
    bodyKey: 'tip_stat_trend_body',
    group: 'reports',
    order: 22,
  },
  {
    id: 'stat-top',
    anchor: 'stats-top',
    route: '/sales/statistics',
    titleKey: 'tip_stat_top_title',
    bodyKey: 'tip_stat_top_body',
    group: 'reports',
    order: 24,
  },
  {
    id: 'stat-pdf',
    anchor: 'stats-pdf',
    route: '/sales/statistics',
    titleKey: 'tip_stat_pdf_title',
    bodyKey: 'tip_stat_pdf_body',
    group: 'reports',
    order: 30,
  },

  // ======================================================================
  // /sales/history
  // ======================================================================
  {
    id: 'hist-date',
    anchor: 'hist-date',
    route: '/sales/history',
    titleKey: 'tip_hist_date_title',
    bodyKey: 'tip_hist_date_body',
    group: 'basics',
    order: 10,
  },
  {
    id: 'hist-list',
    anchor: 'hist-list',
    route: '/sales/history',
    titleKey: 'tip_hist_list_title',
    bodyKey: 'tip_hist_list_body',
    group: 'basics',
    order: 12,
  },
  {
    id: 'hist-totals',
    anchor: 'hist-totals',
    route: '/sales/history',
    titleKey: 'tip_hist_totals_title',
    bodyKey: 'tip_hist_totals_body',
    group: 'reports',
    order: 20,
  },
  {
    id: 'hist-pdf',
    anchor: 'hist-pdf',
    route: '/sales/history',
    titleKey: 'tip_hist_pdf_title',
    bodyKey: 'tip_hist_pdf_body',
    group: 'reports',
    order: 22,
  },
]
