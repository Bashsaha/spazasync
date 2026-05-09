'use client'

import { useState } from 'react'
import { formatZAR } from '@/lib/utils/currency'
import { useTranslation } from '@/components/LanguageProvider'

interface PaymentMethodSheetProps {
  total: number
  onConfirm: (method: 'card' | 'cash') => void
  onDismiss: () => void
}

/**
 * Bottom-sheet shown after the user taps "Complete Sale". Lets them pick
 * Card (instant confirm) or Cash (input amount given → see change).
 * The picked method is not yet persisted to the sales table; the calculated
 * change is purely a helper for the teller.
 */
export function PaymentMethodSheet({ total, onConfirm, onDismiss }: PaymentMethodSheetProps) {
  const { t } = useTranslation('sale')
  const [step, setStep] = useState<'method' | 'cash'>('method')
  const [cashGiven, setCashGiven] = useState('')

  const cashGivenNum = parseFloat(cashGiven)
  const validCash = !isNaN(cashGivenNum) && cashGivenNum >= total
  const change = validCash ? cashGivenNum - total : 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ zIndex: 80 }}
      className="fixed inset-0 bg-black/50 flex items-end justify-center"
      onClick={onDismiss}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-[max(24px,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'method' && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{t('payment_title')}</h2>
            <p className="text-sm text-gray-500 mb-5">{formatZAR(total)}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => onConfirm('card')}
                className="flex flex-col items-center justify-center gap-2 bg-brand text-white font-semibold py-6 rounded-full active:bg-brand-hover"
              >
                <span className="text-3xl" aria-hidden>
                  💳
                </span>
                <span className="text-base">{t('btn_card')}</span>
              </button>
              <button
                type="button"
                onClick={() => setStep('cash')}
                className="flex flex-col items-center justify-center gap-2 bg-brand text-white font-semibold py-6 rounded-full active:bg-brand-hover"
              >
                <span className="text-3xl" aria-hidden>
                  💵
                </span>
                <span className="text-base">{t('btn_cash')}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full text-gray-500 text-sm py-3 active:text-gray-700"
            >
              {t('btn_back')}
            </button>
          </>
        )}

        {step === 'cash' && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{t('cash_input_title')}</h2>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('cash_total_label')}</span>
              <span className="text-lg font-bold text-gray-900">{formatZAR(total)}</span>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('cash_amount_given_label')}
            </label>
            <div className="relative mb-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">
                R
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={total}
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                autoFocus
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-4 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            {cashGiven !== '' && !validCash && (
              <p className="text-xs text-red-500 mb-2">
                {t('cash_amount_short', { amount: formatZAR(total) })}
              </p>
            )}

            <div className="bg-brand-light border border-brand-light rounded-xl p-4 mb-5">
              <p className="text-xs text-brand-hover mb-1">{t('cash_change_label')}</p>
              <p className="text-3xl font-bold text-brand-hover">{formatZAR(change)}</p>
            </div>

            <button
              type="button"
              onClick={() => onConfirm('cash')}
              disabled={!validCash}
              className="w-full bg-brand text-white font-bold py-4 rounded-full active:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed mb-2"
            >
              {t('btn_confirm_payment')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('method')
                setCashGiven('')
              }}
              className="w-full text-gray-500 text-sm py-3 active:text-gray-700"
            >
              {t('btn_back')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
