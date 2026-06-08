'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/components/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { RobotBuddy } from './RobotBuddy'
import type { TargetRect } from './useTourTarget'

const PAD = 8 // gap around the highlighted element

/**
 * The coachmark (Phase 46): a dimmed screen with a live "punch-out" over the
 * target element + a pulsing brand ring + a speech bubble.
 *
 * The dim is built from four framing panels around the target, leaving a real
 * gap over it — so the element stays TAPPABLE (learn-by-doing) while everything
 * else is dimmed. Tapping a dim panel = "Not now". Rendered through a portal so
 * it sits above the app chrome regardless of stacking context.
 */
export function SpotlightOverlay({
  rect,
  title,
  body,
  onGotIt,
  onClose,
  onDisable,
  gotItOnly = false,
}: {
  rect: TargetRect
  title: string
  body: string
  onGotIt: () => void
  onClose: () => void
  /** Omitted in welcome mode (no "Don't show tips" link there). */
  onDisable?: () => void
  /** Welcome mode: a single full-width "Got it" button, no Not now / Disable. */
  gotItOnly?: boolean
}) {
  const { t } = useTranslation('guide')
  const [vw, setVw] = useState(0)
  const [vh, setVh] = useState(0)

  useEffect(() => {
    const sync = () => {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  if (vw === 0) return null

  const holeTop = Math.max(0, rect.top - PAD)
  const holeLeft = Math.max(0, rect.left - PAD)
  const holeW = rect.width + PAD * 2
  const holeH = rect.height + PAD * 2
  const holeBottom = holeTop + holeH

  // Place the bubble below the target if it sits in the top half, else above.
  const below = rect.top + rect.height / 2 < vh / 2
  const dim = 'fixed bg-black/50'

  const overlay = (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      {/* Four dim panels framing a real gap over the live target. */}
      <button type="button" aria-label={t('btn_not_now')} onClick={onClose}
        className={dim} style={{ top: 0, left: 0, width: vw, height: holeTop }} />
      <button type="button" aria-label={t('btn_not_now')} onClick={onClose}
        className={dim} style={{ top: holeBottom, left: 0, width: vw, height: Math.max(0, vh - holeBottom) }} />
      <button type="button" aria-label={t('btn_not_now')} onClick={onClose}
        className={dim} style={{ top: holeTop, left: 0, width: holeLeft, height: holeH }} />
      <button type="button" aria-label={t('btn_not_now')} onClick={onClose}
        className={dim} style={{ top: holeTop, left: holeLeft + holeW, width: Math.max(0, vw - holeLeft - holeW), height: holeH }} />

      {/* Pulsing brand ring hugging the target (decorative, never blocks taps). */}
      <div
        aria-hidden
        className="fixed rounded-2xl border-2 border-brand stocky-ring pointer-events-none"
        style={{ top: holeTop, left: holeLeft, width: holeW, height: holeH }}
      />

      {/* Speech bubble. */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-[min(92vw,28rem)] px-1"
        style={below ? { top: holeBottom + 14 } : { bottom: Math.max(0, vh - holeTop) + 14 }}
      >
        <div className="bg-white rounded-2xl shadow-xl border border-line p-4">
          <div className="flex items-start gap-3">
            <RobotBuddy size={40} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{title}</p>
              <p className="text-sm text-gray-700 mt-0.5">{body}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button size="md" onClick={onGotIt} className="flex-1">{t('btn_got_it')}</Button>
            {!gotItOnly && (
              <Button size="md" variant="outline" onClick={onClose}>{t('btn_not_now')}</Button>
            )}
          </div>
          {!gotItOnly && onDisable && (
            <button
              type="button"
              onClick={onDisable}
              className="mt-2 w-full text-center text-xs text-gray-400 active:text-gray-600 py-1"
            >
              {t('btn_hide_helper')}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
