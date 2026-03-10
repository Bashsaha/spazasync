'use client'

import { useEffect, useRef } from 'react'
import { useScanner } from '@/hooks/useScanner'
import { ScannerOverlay } from './ScannerOverlay'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

/**
 * Full-screen camera overlay that decodes barcodes.
 * Closes automatically after the first successful scan.
 */
export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleScan(barcode: string) {
    onScan(barcode)
    onClose()
  }

  const { startScanning, stopScanning } = useScanner({ onScan: handleScan })

  useEffect(() => {
    if (videoRef.current) {
      startScanning(videoRef.current)
    }
    return () => stopScanning()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleClose() {
    stopScanning()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-4 pt-safe-top py-3">
        <span className="text-white font-semibold text-lg">Scan Barcode</span>
        <button
          onClick={handleClose}
          aria-label="Close scanner"
          className="text-white text-3xl leading-none active:opacity-60"
        >
          ×
        </button>
      </div>

      {/* camera feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <ScannerOverlay />
      </div>

      {/* hint */}
      <p className="text-white/70 text-sm text-center py-4">
        Point the camera at a barcode
      </p>
    </div>
  )
}
