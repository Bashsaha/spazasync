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
        // Request the rear camera at high resolution with continuous autofocus.
        // Default ZXing constraints don't ask for autofocus, so small/dense
        // barcodes (EAN-13 on small SA products) blur out before they decode.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // @ts-expect-error — focusMode is a valid MediaTrackConstraint on Chrome Android
            focusMode: 'continuous',
          },
          audio: false,
        })

        // Best-effort: explicitly enable continuous autofocus via advanced
        // constraints (Chrome Android supports this; iOS Safari ignores it).
        const [track] = stream.getVideoTracks()
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

        videoEl.srcObject = stream
        await videoEl.play().catch(() => {})

        const controls = await readerRef.current.decodeFromStream(
          stream,
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
              stream.getTracks().forEach((t) => t.stop())
              setIsScanning(false)
              onScan(result.getText())
            }
          },
        )
        // Wrap controls so stop() also tears down the stream we own
        controlsRef.current = {
          stop: () => {
            controls.stop()
            stream.getTracks().forEach((t) => t.stop())
          },
        }
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
