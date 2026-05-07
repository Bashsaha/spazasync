'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminAlert, AdminAlertAudience, AdminAlertPriority } from '@/types'

export default function EditAdminAlertPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [alert, setAlert] = useState<AdminAlert | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [priority, setPriority] = useState<AdminAlertPriority>('normal')
  const [audience, setAudience] = useState<AdminAlertAudience>('all')
  const [expiresAt, setExpiresAt] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/alerts/${id}`)
      if (!res.ok) {
        setError('Failed to load alert')
        return
      }
      const data = await res.json()
      const a = data.alert as AdminAlert
      setAlert(a)
      setTitle(a.title)
      setMessage(a.message)
      setLinkText(a.link_text ?? '')
      setLinkUrl(a.link_url ?? '')
      setPriority(a.priority)
      setAudience(a.target_audience)
      setExpiresAt(a.expires_at ? a.expires_at.slice(0, 16) : '')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          link_text: linkText || null,
          link_url: linkUrl || null,
          priority,
          target_audience: audience,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Failed to save')
        return
      }
      router.push('/admin/alerts')
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this alert? Shops will stop seeing it immediately.')) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/alerts/${id}`, { method: 'DELETE' })
      if (res.ok) router.push('/admin/alerts')
      else setError('Failed to delete')
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExpireNow() {
    setSubmitting(true)
    try {
      await fetch(`/api/admin/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_at: new Date().toISOString() }),
      })
      router.push('/admin/alerts')
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="bg-gray-100 animate-pulse rounded-xl h-64" />
  }

  if (!alert) {
    return (
      <div>
        <p className="text-sm text-red-500 mb-4">{error || 'Alert not found.'}</p>
        <button onClick={() => router.push('/admin/alerts')} className="text-sm text-blue-600 hover:underline">
          ← Back to alerts
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin/alerts')}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit alert</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CTA label</label>
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CTA URL</label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as AdminAlertPriority)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as AdminAlertAudience)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="all">All</option>
              <option value="sa_citizen">SA citizens</option>
              <option value="foreign_national">Foreign nationals</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={handleExpireNow}
            disabled={submitting}
            className="px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 font-medium rounded-xl hover:bg-amber-100"
          >
            Expire now
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 font-medium rounded-xl hover:bg-red-100 ml-auto"
          >
            Delete
          </button>
        </div>
      </form>
    </div>
  )
}
