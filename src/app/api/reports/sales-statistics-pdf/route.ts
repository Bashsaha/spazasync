import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getSalesStatistics } from '@/lib/db/sales-statistics'
import { drawHeader, drawFooter, drawSectionHeading, pdfFilename, pdfResponse } from '@/lib/pdf/shared'
import { formatSAST } from '@/lib/utils/date'
import type { jsPDF } from 'jspdf'
import type { ProductMovement } from '@/lib/db/sales-statistics'

function fmtR(n: number): string {
  return `R${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function fmtDate(ymd: string): string {
  return formatSAST(`${ymd}T00:00:00+02:00`, 'dd MMM yyyy')
}

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } }

/**
 * GET /api/reports/sales-statistics-pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Owner-only PDF of the sales-statistics period overview.
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

    // ── Summary ──
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', 14, y)
    y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Sales: ${stats.totals.sales_count}`, 14, y); y += 5
    doc.text(`Items sold: ${stats.totals.units_sold}`, 14, y); y += 5
    doc.text(`Revenue: ${fmtR(stats.totals.revenue)}`, 14, y); y += 5
    doc.text(`Average sale: ${fmtR(stats.totals.avg_sale_value)}`, 14, y); y += 5
    if (stats.totals.profit !== null) {
      doc.text(`Profit: ${fmtR(stats.totals.profit)}`, 14, y); y += 5
    }
    if (profitOn && stats.totals.products_missing_cost > 0) {
      doc.setTextColor(180, 100, 30)
      doc.text(
        `Note: ${stats.totals.products_missing_cost} sold product(s) have no cost price — profit ranking excludes them.`,
        14,
        y,
      )
      doc.setTextColor(0)
      y += 5
    }
    y += 4

    const sellerHead = [['#', 'Product', 'Units', 'Revenue']]
    const sellerBody = (rows: ProductMovement[]) =>
      rows.map((r, i) => [String(i + 1), r.name, String(r.units_sold), fmtR(r.revenue)])
    const sellerColumnStyles = {
      0: { cellWidth: 10, halign: 'right' as const },
      1: { cellWidth: 110 },
      2: { cellWidth: 24, halign: 'right' as const },
      3: { cellWidth: 38, halign: 'right' as const },
    }
    const headStyles = { fillColor: [26, 188, 156] as [number, number, number], textColor: 255, fontStyle: 'bold' as const }
    const baseStyles = { fontSize: 9, cellPadding: 1.5, overflow: 'linebreak' as const }
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
      y += 8
    }

    function emptyLine(text: string) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120)
      doc.text(text, 14, y)
      doc.setTextColor(0)
      y += 8
    }

    // ── Top sellers ──
    y = drawSectionHeading(doc, y, 'Top sellers (by units sold)')
    if (stats.top_sellers.length === 0) emptyLine('No sales in this period.')
    else drawTable(sellerHead, sellerBody(stats.top_sellers), sellerColumnStyles)

    // ── Lowest sellers ──
    y = drawSectionHeading(doc, y, 'Lowest sellers (sold at least once)')
    if (stats.lowest_sellers.length === 0) emptyLine('No sales in this period.')
    else drawTable(sellerHead, sellerBody(stats.lowest_sellers), sellerColumnStyles)

    // ── Most profitable (only when profit tracking is on) ──
    if (profitOn) {
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
    y = drawSectionHeading(doc, y, 'Non-movers (in stock, sold nothing)')
    if (stats.non_movers.length === 0) {
      emptyLine('Every product with stock sold at least once. Nice.')
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
