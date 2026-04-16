'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { useTranslation } from '@/components/LanguageProvider'

export function BarcodeScanButton() {
  const { t } = useTranslation('products')
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  async function handleScan(barcode: string) {
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`)
      if (res.ok) {
        const json = await res.json()
        const products = json.products ?? []
        if (products.length > 0) {
          router.push(`/products/${products[0].id}`)
          return
        }
        const params = new URLSearchParams({ barcode })
        if (json.catalog_suggestion?.name) {
          params.set('name', json.catalog_suggestion.name)
        }
        router.push(`/products/new?${params.toString()}`)
        return
      }
    } catch {
      // Network error — fall through to navigate with barcode only
    }
    router.push(`/products/new?barcode=${encodeURIComponent(barcode)}`)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 border border-blue-300 px-3 py-2 rounded-xl active:bg-blue-50"
        aria-label={t('btn_scan_aria')}
      >
        {t('btn_scan')}
      </button>

      {isOpen && (
        <BarcodeScanner onScan={handleScan} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}
