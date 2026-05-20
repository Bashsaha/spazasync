import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getSalesStatistics } from '@/lib/db/sales-statistics'
import { drawHeader, drawFooter, drawSectionHeading, pdfFilename, pdfResponse } from '@/lib/pdf/shared'
import { formatSAST } from '@/lib/utils/date'
import type { jsPDF } from 'jspdf'
import type { ProductMovement } from '@/lib/db/sales-statistics'
import type { WeeklyDataPoint } from '@/types'

const BRAND: [number, number, number] = [26, 188, 156]

function fmtR(n: number): string {
  return `R${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function fmtRShort(n: number): string {
  if (n >= 1000) return `R${Math.round(n / 1000)}k`
  return `R${Math.round(n)}`
}

function fmtDate(ymd: string): string {
  return formatSAST(`${ymd}T00:00:00+02:00`, 'dd MMM yyyy')
}

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } }

/**
 * GET /api/reports/sales-statistics-pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Owner-only corporate-style PDF: KPI cards, a revenue trend bar chart (drawn
 * directly in the PDF — recharts is browser-only), and ranked product tables.
 */
export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to are required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be <= to' }, { status: 400 })
  }

  try {
    const { data: shop } = await auth.supabase
      .from('shops')
      .select('name, code, profit_tracking_enabled')
      .eq('id', auth.shopId)
      .single()
    const profitOn = Boolean(shop?.profit_tracking_enabled)

    const stats = await getSalesStatistics(auth.shopId, from, to, profitOn)

    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const shopName = (shop?.name as string | undefined) ?? 'Shop'
    const shopCode = (shop?.code as string | undefined) ?? ''

    let y = drawHeader(doc, {
      title: 'Movestock — Sales Statistics',
      subtitle: shopName,
      meta: [
        `Period: ${fmtDate(from)} – ${fmtDate(to)}`,
        shopCode ? `Shop code: ${shopCode}` : '',
      ].filter(Boolean),
    })

    // ── Local layout helpers (close over `y`) ────────────────────────────────
    function ensureSpace(needed: number) {
      if (y + needed > pageHeight - 18) {
        doc.addPage()
        y = 15
      }
    }

    function emptyLine(text: string) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120)
      doc.text(text, 14, y)
      doc.setTextColor(0)
      y += 9
    }

    function drawKpiCards(cards: { label: string; value: string }[]) {
      const left = 14
      const right = pageWidth - 14
      const gap = 4
      const n = cards.length
      const w = (right - left - gap * (n - 1)) / n
      const h = 20
      ensureSpace(h + 4)
      let x = left
      for (const c of cards) {
        doc.setDrawColor(222)
        doc.setFillColor(247, 250, 251)
        doc.roundedRect(x, y, w, h, 2, 2, 'FD')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(120)
        doc.text(c.label.toUpperCase(), x + w / 2, y + 7, { align: 'center' })

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(26, 32, 44)
        let fs = 13
        doc.setFontSize(fs)
        while (doc.getTextWidth(c.value) > w - 4 && fs > 7) {
          fs -= 0.5
          doc.setFontSize(fs)
        }
        doc.text(c.value, x + w / 2, y + 15, { align: 'center' })
        x += w + gap
      }
      doc.setTextColor(0)
      y += h + 8
    }

    function drawBarChart(data: WeeklyDataPoint[], caption: string) {
      const left = 20 // room for y-axis labels
      const right = pageWidth - 14
      const chartW = right - left
      const chartH = 50
      ensureSpace(chartH + 18)
      const top = y
      const baseline = top + chartH
      const maxRev = Math.max(1, ...data.map((d) => d.revenue))

      // Horizontal gridlines + y-axis value labels (0, 50%, 100%).
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.setDrawColor(232)
      for (const frac of [0, 0.5, 1]) {
        const yy = baseline - frac * chartH
        doc.line(left, yy, right, yy)
        doc.text(fmtRShort(maxRev * frac), left - 2, yy + 1.5, { align: 'right' })
      }

      // Bars.
      const n = data.length
      const slot = chartW / n
      const barW = Math.min(slot * 0.72, 16)
      doc.setFillColor(BRAND[0], BRAND[1], BRAND[2])
      for (let i = 0; i < n; i++) {
        const h = (data[i].revenue / maxRev) * chartH
        if (h <= 0) continue
        const cx = left + slot * i + slot / 2
        doc.rect(cx - barW / 2, baseline - h, barW, h, 'F')
      }

      // X-axis labels — thinned to ~8 so they don't overlap; always label the last.
      doc.setTextColor(120)
      doc.setFontSize(6.5)
      const step = Math.max(1, Math.ceil(n / 8))
      for (let i = 0; i < n; i += step) {
        const cx = left + slot * i + slot / 2
        doc.text(data[i].label, cx, baseline + 4, { align: 'center' })
      }
      if ((n - 1) % step !== 0) {
        const cx = left + slot * (n - 1) + slot / 2
        doc.text(data[n - 1].label, cx, baseline + 4, { align: 'center' })
      }

      doc.setTextColor(150)
      doc.setFontSize(7)
      doc.text(caption, left, baseline + 9)
      doc.setTextColor(0)
      y = baseline + 14
    }

    const headStyles = { fillColor: BRAND, textColor: 255, fontStyle: 'bold' as const }
    const baseStyles = { fontSize: 9, cellPadding: 1.8, overflow: 'linebreak' as const }
    const altRow = { fillColor: [245, 247, 250] as [number, number, number] }

    function drawTable(head: string[][], body: string[][], columnStyles: Record<number, object>) {
      autoTable(doc, {
        startY: y,
        head,
        body,
        styles: baseStyles,
        headStyles,
        alternateRowStyles: altRow,
        margin: { left: 14, right: 14 },
        columnStyles,
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
      y += 9
    }

    const sellerHead = [['#', 'Product', 'Units', 'Revenue']]
    const sellerBody = (rows: ProductMovement[]) =>
      rows.map((r, i) => [String(i + 1), r.name, String(r.units_sold), fmtR(r.revenue)])
    const sellerColumnStyles = {
      0: { cellWidth: 10, halign: 'right' as const },
      1: { cellWidth: 110 },
      2: { cellWidth: 24, halign: 'right' as const },
      3: { cellWidth: 38, halign: 'right' as const },
    }

    // ── Overview (KPI cards) ──
    y = drawSectionHeading(doc, y, 'Overview')
    const kpis: { label: string; value: string }[] = [
      { label: 'Sales', value: String(stats.totals.sales_count) },
      { label: 'Items sold', value: String(stats.totals.units_sold) },
      { label: 'Revenue', value: fmtR(stats.totals.revenue) },
      { label: 'Average sale', value: fmtR(stats.totals.avg_sale_value) },
    ]
    if (stats.totals.profit !== null) {
      kpis.push({ label: 'Profit', value: fmtR(stats.totals.profit) })
    }
    drawKpiCards(kpis)
    if (profitOn && stats.totals.products_missing_cost > 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(180, 100, 30)
      doc.text(
        `Note: ${stats.totals.products_missing_cost} sold product(s) have no cost price — profit ranking excludes them.`,
        14,
        y,
      )
      doc.setTextColor(0)
      y += 7
    }

    // ── Revenue trend chart ──
    y = drawSectionHeading(doc, y, 'Revenue over time')
    if (stats.totals.sales_count === 0) {
      emptyLine('No sales in this period.')
    } else {
      drawBarChart(stats.trend, stats.granularity === 'daily' ? 'Revenue per day' : 'Revenue per week')
    }

    // ── Top sellers ──
    ensureSpace(30)
    y = drawSectionHeading(doc, y, 'Top sellers (by units sold)')
    if (stats.top_sellers.length === 0) emptyLine('No sales in this period.')
    else drawTable(sellerHead, sellerBody(stats.top_sellers), sellerColumnStyles)

    // ── Lowest sellers ──
    ensureSpace(30)
    y = drawSectionHeading(doc, y, 'Lowest sellers (sold at least once)')
    if (stats.lowest_sellers.length === 0) emptyLine('No sales in this period.')
    else drawTable(sellerHead, sellerBody(stats.lowest_sellers), sellerColumnStyles)

    // ── Most profitable (only when profit tracking is on) ──
    if (profitOn) {
      ensureSpace(30)
      y = drawSectionHeading(doc, y, 'Most profitable products')
      if (stats.top_profit.length === 0) {
        emptyLine('No profit data — set cost prices on your products to see this.')
      } else {
        const profitHead = [['#', 'Product', 'Units', 'Profit']]
        const profitBody = stats.top_profit.map((r, i) => [
          String(i + 1),
          r.name,
          String(r.units_sold),
          fmtR(r.profit ?? 0),
        ])
        drawTable(profitHead, profitBody, sellerColumnStyles)
      }
    }

    // ── Non-movers ──
    ensureSpace(30)
    y = drawSectionHeading(doc, y, 'Non-movers (in stock, sold nothing)')
    if (stats.non_movers.length === 0) {
      emptyLine('Every product with stock sold at least once.')
    } else {
      const nmHead = [['Product', 'In stock', 'Price']]
      const nmBody = stats.non_movers.map((n) => [n.name, String(n.stock_qty), fmtR(n.price)])
      drawTable(nmHead, nmBody, {
        0: { cellWidth: 120 },
        1: { cellWidth: 30, halign: 'right' as const },
        2: { cellWidth: 32, halign: 'right' as const },
      })
    }

    drawFooter(doc, new Date())
    return pdfResponse(doc.output('arraybuffer'), pdfFilename('movestock-sales-statistics', new Date()))
  } catch (err) {
    console.error('Sales statistics PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
