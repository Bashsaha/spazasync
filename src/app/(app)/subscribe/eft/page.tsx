'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { Card, Callout, PageHeader, Button, cx } from '@/components/ui'

interface EftConfig {
  bank_name: string
  account_holder: string
  account_number: string
  branch_code: string
  account_type: string
  amount: string
  reference: string
  configured: boolean
}

export default function EftPage() {
  const { t } = useTranslation('settings')
  const [config, setConfig] = useState<EftConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/subscribe/eft-config')
      .then(async (r) => {
        if (!r.ok) {
          setError(true)
          return null
        }
        return r.json()
      })
      .then((data: EftConfig | null) => {
        if (data) setConfig(data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </main>
    )
  }

  if (error || !config) {
    return (
      <main className="min-h-screen p-6 pt-6 pb-32">
        <div className="mx-auto w-full max-w-sm space-y-4">
          <BackButton fallbackHref="/subscribe" />
          <Callout tone="error" title={t('eft_load_error_title')}>
            {t('eft_load_error_body')}
          </Callout>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 pt-6 pb-32">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <BackButton fallbackHref="/subscribe" />

        <PageHeader
          title={t('eft_page_title')}
          subtitle={t('eft_page_subtitle', { amount: config.amount })}
        />

        <Callout tone="error" icon={AlertTriangle} title={t('eft_warning_title')}>
          {t('eft_warning_body')}
        </Callout>

        <Card padding="lg" className="space-y-4">
          <ReferenceRow
            label={t('eft_reference_label')}
            value={config.reference}
            hint={t('eft_reference_hint')}
            copyLabel={t('eft_copy')}
            copiedLabel={t('eft_copied')}
            big
          />
          <div className="h-px bg-line" />
          <ReferenceRow
            label={t('eft_amount_label')}
            value={`R${config.amount}`}
            hint={t('eft_amount_hint')}
            copyLabel={t('eft_copy')}
            copiedLabel={t('eft_copied')}
          />
        </Card>

        <Card padding="lg" className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">{t('eft_bank_details_title')}</h2>
          {!config.configured && (
            <Callout tone="warning">{t('eft_bank_not_configured')}</Callout>
          )}
          <div className="space-y-3">
            <ReferenceRow
              label={t('eft_field_bank')}
              value={config.bank_name}
              copyLabel={t('eft_copy')}
              copiedLabel={t('eft_copied')}
            />
            <ReferenceRow
              label={t('eft_field_holder')}
              value={config.account_holder}
              copyLabel={t('eft_copy')}
              copiedLabel={t('eft_copied')}
            />
            <ReferenceRow
              label={t('eft_field_account_number')}
              value={config.account_number}
              copyLabel={t('eft_copy')}
              copiedLabel={t('eft_copied')}
            />
            <ReferenceRow
              label={t('eft_field_branch_code')}
              value={config.branch_code}
              copyLabel={t('eft_copy')}
              copiedLabel={t('eft_copied')}
            />
            <ReferenceRow
              label={t('eft_field_account_type')}
              value={config.account_type}
              copyLabel={t('eft_copy')}
              copiedLabel={t('eft_copied')}
            />
          </div>
        </Card>

        <Callout tone="info" title={t('eft_after_pay_title')}>
          {t('eft_after_pay_body')}
        </Callout>

        <Button
          variant="outline"
          fullWidth
          size="lg"
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) window.history.back()
            else window.location.assign('/subscribe')
          }}
        >
          {t('eft_back_to_options')}
        </Button>
      </div>
    </main>
  )
}

interface ReferenceRowProps {
  label: string
  value: string
  hint?: string
  copyLabel: string
  copiedLabel: string
  big?: boolean
}

function ReferenceRow({
  label,
  value,
  hint,
  copyLabel,
  copiedLabel,
  big = false,
}: ReferenceRowProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail on http (non-localhost) or in private mode.
      // Fall back to a textarea trick so spaza-shop devices on older browsers
      // still get the copy behaviour.
      const ta = document.createElement('textarea')
      ta.value = value
      ta.setAttribute('readonly', '')
      ta.style.position = 'absolute'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      } catch {
        // user can long-press to copy as a final fallback
      }
      document.body.removeChild(ta)
    }
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide font-medium text-gray-500">{label}</p>
        <p
          className={cx(
            'mt-1 font-semibold text-gray-900 break-all',
            big ? 'text-2xl tracking-wide' : 'text-base',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? `${copiedLabel} ${label}` : `${copyLabel} ${label}`}
        className={cx(
          'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border min-h-[36px]',
          copied
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-white border-line text-brand active:bg-brand-light/40',
        )}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" aria-hidden /> {copiedLabel}
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden /> {copyLabel}
          </>
        )}
      </button>
    </div>
  )
}
