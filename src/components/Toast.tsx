'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  addToast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const bg =
    toast.type === 'success'
      ? 'bg-green-600'
      : toast.type === 'error'
      ? 'bg-red-600'
      : 'bg-gray-800'

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`${bg} text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between gap-4 max-w-sm`}
    >
      <span>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="text-white/70 hover:text-white text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-0 right-0 flex flex-col items-center gap-2 z-50 px-4 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto w-full max-w-sm">
              <ToastItem toast={t} onDismiss={removeToast} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
