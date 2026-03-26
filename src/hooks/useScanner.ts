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
        const controls = await readerRef.current.decodeFromVideoDevice(
          undefined, // use default (back) camera
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
