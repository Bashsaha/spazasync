'use client'

/**
 * Phase 37e — Application Pack download button.
 * Phase 50 — ported to Card / Button / Callout / LinkButton primitives.
 *
 * Disabled until all NON-CIPC required docs are ok (CIPC alone caps the tier
 * but doesn't block the application). Hits the existing Phase 37d endpoint
 * /api/reports/fund-application-pack which already gates server-side on
 * SA citizen + fund_interest.
 */

import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { Card, Button, Callout, LinkButton } from '@/components/ui'
import { PdfDownloadButton } from '@/components/PdfDownloadButton'

interface Props {
  /** Number of NON-conditional required docs that are not ok. */
  missingDocCount: number
}

export function GenerateApplicationPackButton({ missingDocCount }: Props) {
  const { t } = useTranslation('compliance-fund')
  const disabled = missingDocCount > 0

  return (
    <Card padding="lg" className="mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-1">{t('pack_header')}</p>
      <p className="text-xs text-gray-500 mb-3">{t('pack_desc')}</p>

      {disabled ? (
        <>
          <Button variant="primary" size="lg" fullWidth disabled>
            {t('pack_button')}
          </Button>
          <Callout tone="warning" icon={AlertTriangle} className="mt-3">
            {t('pack_missing_hint', { count: missingDocCount })}
          </Callout>
          <LinkButton href="/compliance/journey" variant="ghost" size="sm" className="mt-2">
            {t('pack_open_journey')} →
          </LinkButton>
        </>
      ) : (
        <PdfDownloadButton
          href="/api/reports/fund-application-pack"
          fallbackFilename="fund-application-pack.pdf"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold text-base px-5 py-3.5 min-h-[48px] bg-brand text-white active:bg-brand-hover disabled:opacity-70 disabled:cursor-wait"
        >
          {t('pack_button')}
        </PdfDownloadButton>
      )}
    </Card>
  )
}
