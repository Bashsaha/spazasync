import type { ReactNode } from 'react'
import { cx } from './cx'

/** Clamp a value/max pair to an integer 0–100 percentage. Pure — exported
 *  for unit testing. Guards against max<=0 and out-of-range values. */
export function progressPct(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  const pct = (value / max) * 100
  if (pct <= 0) return 0
  if (pct >= 100) return 100
  return Math.round(pct)
}

interface ProgressMeterProps {
  value: number
  max: number
  /** Label shown above the bar, left side (e.g. "Registrations ready"). */
  label?: ReactNode
  /** Value shown above the bar, right side (e.g. "4 of 6"). */
  valueLabel?: ReactNode
  /** Bar fill turns green when complete; otherwise brand. Override here. */
  tone?: 'brand' | 'green' | 'amber'
  className?: string
}

const FILL: Record<'brand' | 'green' | 'amber', string> = {
  brand: 'bg-brand',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
}

/** Horizontal progress bar + optional label row. Replaces the hand-drawn
 *  `<div className="h-2 bg-gray-100 …"><div style={{width}} /></div>` blocks
 *  scattered across the compliance + journey surfaces. */
export function ProgressMeter({
  value,
  max,
  label,
  valueLabel,
  tone,
  className,
}: ProgressMeterProps) {
  const pct = progressPct(value, max)
  const fill = tone ?? (pct >= 100 ? 'green' : 'brand')
  return (
    <div className={className}>
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          {label ? (
            <span className="text-sm font-medium text-gray-700">{label}</span>
          ) : (
            <span />
          )}
          {valueLabel ? (
            <span className="text-sm font-bold text-gray-900">{valueLabel}</span>
          ) : null}
        </div>
      )}
      <div
        className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cx('h-full rounded-full transition-[width]', FILL[fill])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
