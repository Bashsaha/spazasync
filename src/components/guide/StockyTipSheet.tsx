'use client'

import { createPortal } from 'react-dom'
import { useTranslation } from '@/components/LanguageProvider'
import { RobotBuddy } from './RobotBuddy'
import type { PageTip } from '@/lib/guide/select-tip'
import type { FeatureTip } from '@/lib/guide/types'

/**
 * The "What can I show you here?" sheet (Phase 47). Lists the current page's
 * tips; tapping one hands back to the orchestrator which spotlights the real
 * element. Self-explaining (names Stocky + says it'll point at things) so an
 * owner who never saw the welcome still learns the model. Portaled to body so it
 * sits above the app chrome regardless of stacking context.
 */
export function StockyTipSheet({
  tips,
  firstOpen,
  onPick,
  onHide,
  onClose,
}: {
  tips: PageTip[]
  /** First time this owner has opened the sheet → show the "what is this" line. */
  firstOpen: boolean
  onPick: (tip: FeatureTip) => void
  onHide: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('guide')

  const sheet = (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={t('sheet_title')}
    >
      <button
        type="button"
        aria-label={t('btn_not_now')}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative bg-white rounded-t-3xl shadow-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] max-h-[80vh] overflow-y-auto stocky-sheet-up">
        <div className="flex items-start gap-3 mb-3">
          <RobotBuddy size={36} className="shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-gray-900">{t('sheet_title')}</p>
            <p className="text-sm text-gray-500 mt-0.5">{t('sheet_subtitle')}</p>
          </div>
        </div>

        {firstOpen && (
          <div className="bg-brand-light text-brand-hover text-sm rounded-2xl p-3 mb-3">
            {t('sheet_first_open')}
          </div>
        )}

        <ul className="space-y-2">
          {tips.map((pt) => (
            <li key={pt.tip.id}>
              <button
                type="button"
                onClick={() => onPick(pt.tip)}
                className={`w-full flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left active:bg-gray-50 ${
                  pt.seen ? 'border-gray-100 bg-gray-50' : 'border-line bg-white'
                }`}
              >
                <span
                  className={`min-w-0 font-semibold ${pt.seen ? 'text-gray-500' : 'text-gray-900'}`}
                >
                  {t(pt.tip.titleKey)}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {pt.active && (
                    <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-[#F5A623]" />
                  )}
                  {pt.seen && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">
                      {t('tip_seen_badge')}
                    </span>
                  )}
                  <span className="text-brand font-bold text-lg leading-none">›</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onHide}
          className="mt-3 w-full text-center text-xs text-gray-400 active:text-gray-600 py-1.5"
        >
          {t('btn_hide_helper')}
        </button>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
