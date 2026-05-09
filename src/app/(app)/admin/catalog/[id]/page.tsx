'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Skeleton } from '@/components/Skeleton'
import type { BarcodeCatalogEntry } from '@/types'

export default function AdminCatalogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { addToast } = useToast()

  const [entry, setEntry] = useState<BarcodeCatalogEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete state
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchEntry = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/catalog/${id}`)
      if (res.status === 404) {
        setError('Entry not found')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError('Failed to load entry')
        setLoading(false)
        return
      }
      const data: BarcodeCatalogEntry = await res.json()
      setEntry(data)
      setName(data.name)
      setCategory(data.category ?? '')
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchEntry()
  }, [fetchEntry])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch(`/api/admin/catalog/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category: category.trim() || undefined }),
      })

      if (res.ok) {
        addToast('Entry updated')
        setEntry((prev) => prev ? { ...prev, name: name.trim(), category: category.trim() || null } : prev)
      } else {
        addToast('Failed to update', 'error')
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/catalog/${id}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('Entry deleted')
        router.push('/admin/catalog')
      } else {
        addToast('Failed to delete', 'error')
        setDeleting(false)
      }
    } catch {
      addToast('Network error', 'error')
      setDeleting(false)
    }
    setShowDelete(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-red-500 mb-4">{error || 'Entry not found'}</p>
        <button
          onClick={() => router.push('/admin/catalog')}
          className="text-sm font-medium text-brand hover:underline"
        >
          Back to catalog
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Catalog Entry</h1>

      {/* Read-only barcode */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
        <p className="font-mono text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-600">
          {entry.barcode}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Product Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={100}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold bg-brand text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/catalog')}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Delete section */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={() => setShowDelete(true)}
          disabled={deleting}
          className="text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
        >
          {deleting ? 'Deleting...' : 'Delete this entry'}
        </button>
      </div>

      {showDelete && (
        <ConfirmModal
          message={`Delete "${entry.name}" (${entry.barcode}) from the shared catalog? Shops that already added this product won't be affected.`}
          confirmLabel="Delete"
          isDestructive
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
