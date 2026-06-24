'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [zoom, setZoomLevel] = useState(2)
  const [flash, setFlash] = useState(false)

  function handleScan(barcode: string) {
    // Positive "got it" confirmation: a short buzz + a green flash so the teller
    // trusts the scan landed before the camera disappears (a silent close makes
    // people second-guess and re-scan). vibrate is Android-only — guarded.
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(60)
    }
    setFlash(true)
    window.setTimeout(() => {
      onScan(barcode)
      onClose()
    }, 160)
  }

  const { startScanning, stopScanning, setZoom, zoomCapability, focusAt } = useScanner({
    onScan: handleScan,
  })

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

  function handleZoom(delta: number) {
    if (!zoomCapability) return
    const next = Math.min(Math.max(zoom + delta, zoomCapability.min), zoomCapability.max)
    setZoomLevel(next)
    setZoom(next)
  }

  function handleTapFocus(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    focusAt(x, y)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* success flash — brief green wash over the whole scanner on a good scan */}
      {flash && (
        <div
          className="absolute inset-0 z-[60] bg-green-400/40 pointer-events-none flex items-center justify-center"
          aria-hidden
        >
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}

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
      <div className="flex-1 relative overflow-hidden" onClick={handleTapFocus}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <ScannerOverlay />

        {/* zoom controls — only render when the device exposes hardware zoom */}
        {zoomCapability && zoomCapability.max > zoomCapability.min && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-2 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleZoom(-1)}
              aria-label="Zoom out"
              className="w-10 h-10 text-white text-2xl active:opacity-60"
            >
              −
            </button>
            <span className="text-white text-sm font-medium min-w-[3ch] text-center">
              {zoom.toFixed(1)}×
            </span>
            <button
              type="button"
              onClick={() => handleZoom(1)}
              aria-label="Zoom in"
              className="w-10 h-10 text-white text-2xl active:opacity-60"
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* hint */}
      <p className="text-white/70 text-sm text-center py-4 px-4">
        Hold ~15 cm away · tap to focus · use + to zoom in on small barcodes
      </p>
    </div>
  )
}
