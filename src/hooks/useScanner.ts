'use client'

import { useRef, useCallback, useState } from 'react'
import type { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'

interface UseScannerOptions {
  onScan: (barcode: string) => void
  onError?: (err: Error) => void
}

interface UseScannerReturn {
  startScanning: (videoEl: HTMLVideoElement) => Promise<void>
  stopScanning: () => void
  isScanning: boolean
}

export function useScanner({ onScan, onError }: UseScannerOptions): UseScannerReturn {
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const hasScanned = useRef(false)
  const [isScanning, setIsScanning] = useState(false)

  const stopScanning = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setIsScanning(false)
  }, [])

  const startScanning = useCallback(
    async (videoEl: HTMLVideoElement) => {
      hasScanned.current = false

      if (!readerRef.current) {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        readerRef.current = new BrowserMultiFormatReader()
      }

      try {
        // Default decodeFromVideoDevice opens the rear camera at low resolution
        // with no focus constraint — small/dense barcodes (EAN-13 on sweets etc.)
        // blur out below the decoder's pixel-density threshold. decodeFromConstraints
        // lets us request HD + continuous autofocus while letting ZXing own
        // stream attachment (decodeFromStream double-attaches and hangs on the
        // second loadedmetadata event that never fires).
        const controls = await readerRef.current.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              // @ts-expect-error — focusMode is a valid MediaTrackConstraint on Chrome Android
              focusMode: 'continuous',
            },
            audio: false,
          },
          videoEl,
          (result, error) => {
            // NotFoundException fires every frame when nothing is detected — ignore it
            if (error && error.name !== 'NotFoundException') {
              onError?.(error as Error)
            }
            if (result && !hasScanned.current) {
              hasScanned.current = true
              controlsRef.current?.stop()
              controlsRef.current = null
              setIsScanning(false)
              onScan(result.getText())
            }
          },
        )

        // Once the stream is live, try to upgrade the track to continuous AF.
        // Feature-detected because Safari throws on unsupported constraint names.
        const stream = videoEl.srcObject as MediaStream | null
        const track = stream?.getVideoTracks?.()[0]
        if (track) {
          const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
            focusMode?: string[]
          }
          if (caps.focusMode?.includes('continuous')) {
            await track
              .applyConstraints({
                // @ts-expect-error — advanced focusMode constraint
                advanced: [{ focusMode: 'continuous' }],
              })
              .catch(() => {})
          }
        }

        controlsRef.current = controls
        setIsScanning(true)
      } catch (err) {
        setIsScanning(false)
        onError?.(err as Error)
      }
    },
    [onScan, onError],
  )

  return { startScanning, stopScanning, isScanning }
}
