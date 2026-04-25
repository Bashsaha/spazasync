import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getMonthlySalesReport } from '@/lib/db/monthly-sales-report'
import { formatSAST } from '@/lib/utils/date'
// jsPDF + autoTable are dynamically imported inside GET() to reduce cold start
import type { jsPDF } from 'jspdf'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function weekdayShort(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00Z')
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
}

function fmtR(n: number): string {
  return `R${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/** Summarise line items for a sale into a short string: "3× Bread, 2× Milk (+1 more)". */
function summariseItems(items: { quantity: number; product_name: string }[]): string {
  if (items.length === 0) return '—'
  const MAX = 3
  const head = items.slice(0, MAX).map((i) => `${i.quantity}× ${i.product_name}`)
  const suffix = items.length > MAX ? ` (+${items.length - MAX} more)` : ''
  return head.join(', ') + suffix
}

/**
 * GET /api/reports/monthly-sales-pdf?year=YYYY&month=MM
 *
 * Generates a monthly sales + profit report PDF for the authenticated owner's shop.
 * Returns application/pdf with Content-Disposition: attachment.
 *
 * Subscription gating is handled at the proxy level (see proxy.ts).
 */
export async function GET(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId, supabase, user } = auth

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '', 10)
  const month = parseInt(searchParams.get('month') ?? '', 10)
  if (!year || year < 2020 || year > 2100 || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 })
  }

  try {
    const report = await getMonthlySalesReport(supabase, shopId, year, month)
    const profitOn = report.shop.profit_tracking_enabled

    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 15

    // ── Header ──
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Movestock — Sales Report', pageWidth / 2, y, { align: 'center' })
    y += 8

    doc.setFontSize(14)
    doc.text(report.shop.name, pageWidth / 2, y, { align: 'center' })
    y += 7

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    const monthLabel = `${MONTH_NAMES[report.month - 1]} ${report.year}`
    doc.text(monthLabel, pageWidth / 2, y, { align: 'center' })
    y += 6

    doc.setFontSize(9)
    doc.text(`Shop code: ${report.shop.code}`, pageWidth / 2, y, { align: 'center' })
    y += 8

    doc.setDrawColor(200)
    doc.line(14, y, pageWidth - 14, y)
    y += 8

    // ── Summary box ──
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text('Summary', 14, y)
    y += 6

    const lastDay = new Date(Date.UTC(report.year, report.month, 0)).getUTCDate()
    const summaryLines = [
      `Total sales: ${report.totals.total_sales}`,
      `Revenue: ${fmtR(report.totals.total_revenue)}`,
    ]
    if (profitOn) {
      summaryLines.push(
        report.totals.total_profit !== null
          ? `Profit: ${fmtR(report.totals.total_profit)}`
          : 'Profit: unavailable (some sales missing cost price)',
      )
    }
    summaryLines.push(`Active days: ${report.totals.days_with_sales} of ${lastDay}`)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const line of summaryLines) {
      doc.text(line, 14, y)
      y += 5
    }
    y += 3

    // Empty-month short-circuit
    if (report.sales.length === 0) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120)
      doc.text('No sales recorded for this month.', 14, y)
      doc.setTextColor(0)
    } else {
      // ── Per-teller table ──
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Sales by teller', 14, y)
      y += 2

      const tellerHead = profitOn
        ? ['Teller', 'Sales', 'Revenue', 'Profit']
        : ['Teller', 'Sales', 'Revenue']
      const tellerBody = report.perTeller.map((t) => {
        const row: (string | number)[] = [t.teller_name, t.sale_count, fmtR(t.revenue)]
        if (profitOn) row.push(t.profit !== null ? fmtR(t.profit) : '—')
        return row
      })

      autoTable(doc, {
        startY: y + 2,
        head: [tellerHead],
        body: tellerBody,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } }
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
      y += 8

      // ── Per-day table ──
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Sales by day', 14, y)
      y += 2

      const dayHead = profitOn
        ? ['Date', 'Day', 'Sales', 'Revenue', 'Profit']
        : ['Date', 'Day', 'Sales', 'Revenue']
      const bestRevenue = Math.max(0, ...report.perDay.map((d) => d.revenue))
      const dayBody = report.perDay.map((d) => {
        const row: (string | number)[] = [d.date, weekdayShort(d.date), d.sale_count, fmtR(d.revenue)]
        if (profitOn) row.push(d.profit !== null ? fmtR(d.profit) : '—')
        return row
      })

      autoTable(doc, {
        startY: y + 2,
        head: [dayHead],
        body: dayBody,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        didParseCell(hook) {
          // Highlight the best revenue day in green
          if (hook.section !== 'body' || hook.column.index !== 3) return
          const date = (hook.row.raw as (string | number)[])[0] as string
          const dayRow = report.perDay.find((r) => r.date === date)
          if (dayRow && dayRow.revenue === bestRevenue && bestRevenue > 0) {
            hook.cell.styles.textColor = [22, 163, 74]
            hook.cell.styles.fontStyle = 'bold'
          }
        },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
      y += 8

      // ── Detailed sales log ──
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('All sales', 14, y)
      y += 2

      const logHead = profitOn
        ? ['Date', 'Time', 'Teller', 'Items', 'Total', 'Profit']
        : ['Date', 'Time', 'Teller', 'Items', 'Total']
      const logBody = report.sales.map((s) => {
        const row: (string | number)[] = [
          formatSAST(s.completed_at, 'dd MMM'),
          formatSAST(s.completed_at, 'HH:mm'),
          s.teller_name ?? 'No teller recorded',
          summariseItems(s.items),
          fmtR(s.total),
        ]
        if (profitOn) row.push(s.profit !== null ? fmtR(s.profit) : '—')
        return row
      })

      autoTable(doc, {
        startY: y + 2,
        head: [logHead],
        body: logBody,
        styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        columnStyles: profitOn
          ? {
              0: { cellWidth: 18 },
              1: { cellWidth: 14 },
              2: { cellWidth: 30 },
              3: { cellWidth: 70 },
              4: { cellWidth: 22 },
              5: { cellWidth: 22 },
            }
          : {
              0: { cellWidth: 20 },
              1: { cellWidth: 16 },
              2: { cellWidth: 36 },
              3: { cellWidth: 90 },
              4: { cellWidth: 20 },
            },
      })
    }

    // ── Footer on every page ──
    const now = new Date()
    const pageCount = doc.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120)
      doc.text(
        `Generated ${formatSAST(now, 'dd MMM yyyy HH:mm')} SAST · Movestock — Small Business Dashboard · Page ${p} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' },
      )
    }

    const pdfBuffer = doc.output('arraybuffer')
    const filename = `movestock-sales-${report.year}-${String(report.month).padStart(2, '0')}.pdf`

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Monthly sales PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
