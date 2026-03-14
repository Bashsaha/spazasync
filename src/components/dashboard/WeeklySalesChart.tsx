'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { WeeklyDataPoint } from '@/types'

interface TooltipPayload {
  value?: number
  payload?: WeeklyDataPoint
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const revenue = payload[0]?.value ?? 0
  const salesCount = payload[0]?.payload?.salesCount ?? 0
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className="text-blue-700">R {Number(revenue).toFixed(2)}</p>
      <p className="text-gray-400">{salesCount} {salesCount === 1 ? 'sale' : 'sales'}</p>
    </div>
  )
}

export function WeeklySalesChart({ data }: { data: WeeklyDataPoint[] }) {
  const hasData = data.some((d) => d.revenue > 0)

  if (!hasData) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-300">
        No sales this week yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `R${(v / 1000).toFixed(0)}k` : `R${v}`)}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#eff6ff' }} />
        <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
