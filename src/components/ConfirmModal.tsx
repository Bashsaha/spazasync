'use client'

interface ConfirmModalProps {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  isDestructive?: boolean
}

/**
 * Bottom-sheet style confirmation dialog.
 * Replaces browser confirm() for a consistent mobile-friendly experience.
 */
export function ConfirmModal({
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 shadow-xl">
        <p className="text-gray-900 font-semibold text-base mb-6">{message}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            autoFocus
            className={`w-full py-3 rounded-xl font-semibold text-white ${
              isDestructive
                ? 'bg-red-500 active:bg-red-600'
                : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 active:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
