import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getStockLoss } from '@/lib/db/stock-loss'
import { drawHeader, drawFooter, pdfFilename, pdfResponse } from '@/lib/pdf/shared'
import { formatSAST } from '@/lib/utils/date'
import type { jsPDF } from 'jspdf'

function sastDayToUtc(ymd: string, end: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) throw new Error('bad date')
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  const utc = end
    ? Date.UTC(y, mo - 1, d, 21, 59, 59, 999)
    : Date.UTC(y, mo - 1, d, -2, 0, 0, 0)
  return new Date(utc).toISOString()
}

function fmtR(n: number): string {
  return `R${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function fmtDate(iso: string): string {
  return formatSAST(iso, 'dd MMM yyyy')
}

/**
 * GET /api/reports/stock-loss-pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Owner-only PDF of stock removed without being sold over the date range.
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
    return NextResponse.json(
      { error: 'from and to are required (YYYY-MM-DD)' },
      { status: 400 },
    )
  }
  if (from > to) {
    return NextResponse.json({ error: 'from must be <= to' }, { status: 400 })
  }

  try {
    const { data: shop } = await auth.supabase
      .from('shops')
      .select('name, code')
      .eq('id', auth.shopId)
      .single()

    const report = await getStockLoss(
      auth.supabase,
      auth.shopId,
      sastDayToUtc(from, false),
      sastDayToUtc(to, true),
    )

    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const shopName = (shop?.name as string | undefined) ?? 'Shop'
    const shopCode = (shop?.code as string | undefined) ?? ''

    let y = drawHeader(doc, {
      title: 'Movestock — Stock Loss Report',
      subtitle: shopName,
      meta: [
        `Period: ${fmtDate(from + 'T00:00:00Z')} – ${fmtDate(to + 'T00:00:00Z')}`,
        shopCode ? `Shop code: ${shopCode}` : '',
      ].filter(Boolean),
    })

    // ── Summary block ──
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', 14, y)
    y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Items removed (not sold): ${report.totals.total_items}`, 14, y)
    y += 5
    doc.text(`Value lost (at cost): ${fmtR(report.totals.total_value)}`, 14, y)
    y += 5
    if (report.totals.rows_missing_cost > 0) {
      doc.setTextColor(180, 100, 30)
      doc.text(
        `Note: ${report.totals.rows_missing_cost} of ${report.totals.rows_count} entries have no cost price set — those rows show R0.00.`,
        14,
        y,
      )
      doc.setTextColor(0)
      y += 5
    }
    y += 3

    if (report.rows.length === 0) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120)
      doc.text('No stock loss in this period.', 14, y)
      doc.setTextColor(0)
    } else {
      const head = [['Date', 'Product', 'Qty', 'Cost each', 'Value lost', 'Source', 'Reason']]
      const body = report.rows.map((r) => [
        formatSAST(r.occurred_at, 'dd MMM'),
        r.product_name,
        String(r.qty_removed),
        r.cost_price !== null ? fmtR(r.cost_price) : '—',
        fmtR(r.value_lost),
        r.source === 'adjustment' ? 'Adjustment' : 'Stock-take',
        r.reason ?? '—',
      ])

      autoTable(doc, {
        startY: y,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { fillColor: [26, 188, 156], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 48 },
          2: { cellWidth: 12, halign: 'right' },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 22 },
          6: { cellWidth: 40 },
        },
      })
      type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } }
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
      y += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120)
      const note = 'Excludes stock removed through completed sales.'
      doc.text(note, pageWidth / 2, y, { align: 'center' })
      doc.setTextColor(0)
    }

    drawFooter(doc, new Date())

    return pdfResponse(doc.output('arraybuffer'), pdfFilename('movestock-stock-loss', new Date()))
  } catch (err) {
    console.error('Stock loss PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
