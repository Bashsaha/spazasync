/**
 * Visual targeting reticle overlaid on the camera feed.
 * No state or props — purely decorative.
 */
export function ScannerOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* dim everything outside the scan window */}
      <div className="absolute inset-0 bg-black/40" />

      {/* scan window */}
      <div className="relative w-64 h-40 z-10">
        {/* corner markers */}
        <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-brand rounded-tl-sm" />
        <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-brand rounded-tr-sm" />
        <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-brand rounded-bl-sm" />
        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-brand rounded-br-sm" />

        {/* scan line animation */}
        <span className="absolute left-0 right-0 h-0.5 bg-brand opacity-80 animate-scan-line" />
      </div>
    </div>
  )
}
