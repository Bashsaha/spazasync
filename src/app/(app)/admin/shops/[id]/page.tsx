'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { AdminPayment, SubscriptionStatus } from '@/types'
import { Skeleton } from '@/components/Skeleton'

interface ShopDetail {
  id: string
  name: string
  code: string
  whatsapp_number: string | null
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  subscription_ends_at: string | null
  access_granted: boolean
  admin_notes: string | null
  created_at: string
  owner_email: string | null
  payments: AdminPayment[]
  teller_count: number
  product_count: number
  recent_sales_count: number
}

const statusBadge: Record<SubscriptionStatus, string> = {
  trialing: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-700',
  manual_override: 'bg-amber-100 text-amber-700',
}

export default function AdminShopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [shop, setShop] = useState<ShopDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Notes state
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Payment form state
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'eft' | 'cash' | 'card' | 'other'>('eft')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [payActivate, setPayActivate] = useState(false)
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Access toggle
  const [accessToggling, setAccessToggling] = useState(false)

  // Subscription management state
  const [subStatus, setSubStatus] = useState<SubscriptionStatus>('trialing')
  const [subEndDate, setSubEndDate] = useState('')
  const [subSaving, setSubSaving] = useState(false)
  const [subSaved, setSubSaved] = useState(false)

  const fetchShop = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/shops/${id}`)
      if (res.status === 404) {
        setError('Shop not found')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const data: ShopDetail = await res.json()
      setShop(data)
      setNotes(data.admin_notes ?? '')
      setSubStatus(data.subscription_status)
      // Show the relevant end date based on status
      const endDate = data.subscription_status === 'trialing'
        ? data.trial_ends_at
        : data.subscription_ends_at
      setSubEndDate(endDate ? endDate.slice(0, 10) : '')
    } catch {
      setError('Failed to load shop details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchShop()
  }, [fetchShop])

  async function handleToggleAccess() {
    if (!shop) return
    setAccessToggling(true)
    try {
      const res = await fetch(`/api/admin/shops/${id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_granted: !shop.access_granted }),
      })
      if (res.ok) {
        setShop({ ...shop, access_granted: !shop.access_granted })
      }
    } catch (err) {
      console.error('Failed to toggle access:', err)
    } finally {
      setAccessToggling(false)
    }
  }

  async function handleUpdateSubscription() {
    setSubSaving(true)
    setSubSaved(false)
    try {
      const body: Record<string, unknown> = { subscription_status: subStatus }
      if (subEndDate) {
        const isoDate = new Date(subEndDate + 'T23:59:59.999Z').toISOString()
        if (subStatus === 'trialing') {
          body.trial_ends_at = isoDate
        } else {
          body.subscription_ends_at = isoDate
        }
      }
      const res = await fetch(`/api/admin/shops/${id}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSubSaved(true)
        setTimeout(() => setSubSaved(false), 2000)
        await fetchShop()
      }
    } catch (err) {
      console.error('Failed to update subscription:', err)
    } finally {
      setSubSaving(false)
    }
  }

  async function handleSaveNotes() {
    setNotesSaving(true)
    setNotesSaved(false)
    try {
      const res = await fetch(`/api/admin/shops/${id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: notes }),
      })
      if (res.ok) {
        setNotesSaved(true)
        setTimeout(() => setNotesSaved(false), 2000)
      }
    } catch (err) {
      console.error('Failed to save notes:', err)
    } finally {
      setNotesSaving(false)
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    setPaySubmitting(true)
    try {
      const res = await fetch(`/api/admin/shops/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          method: payMethod,
          reference: payRef || undefined,
          notes: payNotes || undefined,
          activate_subscription: payActivate,
        }),
      })
      if (res.ok) {
        setPayAmount('')
        setPayRef('')
        setPayNotes('')
        setPayActivate(false)
        await fetchShop()
      }
    } catch (err) {
      console.error('Failed to record payment:', err)
    } finally {
      setPaySubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (error || !shop) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">{error || 'Shop not found'}</p>
        <button
          onClick={() => router.push('/admin/shops')}
          className="text-blue-600 text-sm hover:underline"
        >
          Back to shops
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push('/admin/shops')}
        className="text-sm text-gray-400 hover:text-gray-700"
      >
        &larr; Back to shops
      </button>

      {/* Shop Info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h1 className="text-xl font-bold text-gray-900">{shop.name}</h1>
        <div className="mt-2 space-y-1 text-sm text-gray-500">
          <p>Code: <span className="font-mono font-semibold text-blue-600">{shop.code}</span></p>
          {shop.owner_email && <p>Owner: {shop.owner_email}</p>}
          {shop.whatsapp_number && <p>WhatsApp: {shop.whatsapp_number}</p>}
          <p>Created: {new Date(shop.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{shop.product_count}</p>
          <p className="text-xs text-gray-400">Products</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{shop.teller_count}</p>
          <p className="text-xs text-gray-400">Active Tellers</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{shop.recent_sales_count}</p>
          <p className="text-xs text-gray-400">Sales (30d)</p>
        </div>
      </div>

      {/* Subscription & Access */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Subscription &amp; Access</h2>

        {/* Current status badge + access toggle */}
        <div className="flex items-center justify-between mb-4">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              statusBadge[shop.subscription_status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {shop.subscription_status.replace('_', ' ')}
          </span>
          <button
            onClick={handleToggleAccess}
            disabled={accessToggling}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              shop.access_granted
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            } disabled:opacity-50`}
          >
            {accessToggling ? '...' : shop.access_granted ? 'Revoke Access' : 'Grant Access'}
          </button>
        </div>

        {/* Subscription management controls */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sub-status" className="text-xs text-gray-500 mb-1 block">Status</label>
              <select
                id="sub-status"
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value as SubscriptionStatus)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="trialing">Trialing</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="manual_override">Manual Override</option>
              </select>
            </div>
            <div>
              <label htmlFor="sub-end-date" className="text-xs text-gray-500 mb-1 block">
                {subStatus === 'trialing' ? 'Trial ends' : 'Subscription ends'}
              </label>
              <input
                id="sub-end-date"
                type="date"
                value={subEndDate}
                onChange={(e) => setSubEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpdateSubscription}
              disabled={subSaving}
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {subSaving ? 'Updating...' : 'Update Subscription'}
            </button>
            {subSaved && (
              <span className="text-xs text-green-600">Updated</span>
            )}
          </div>
        </div>
      </div>

      {/* Admin Notes */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Admin Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          placeholder="Internal notes about this shop..."
          aria-label="Admin notes"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleSaveNotes}
            disabled={notesSaving}
            className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {notesSaving ? 'Saving...' : 'Save Notes'}
          </button>
          {notesSaved && (
            <span className="text-xs text-green-600">Saved</span>
          )}
        </div>
      </div>

      {/* Record Payment */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Record Payment</h2>
        <form onSubmit={handleRecordPayment} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pay-amount" className="text-xs text-gray-500 mb-1 block">Amount (ZAR)</label>
              <input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="pay-method" className="text-xs text-gray-500 mb-1 block">Method</label>
              <select
                id="pay-method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as 'eft' | 'cash' | 'card' | 'other')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="eft">EFT</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="pay-ref" className="text-xs text-gray-500 mb-1 block">Reference (optional)</label>
            <input
              id="pay-ref"
              type="text"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              maxLength={200}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="pay-notes" className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <input
              id="pay-notes"
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              maxLength={500}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={payActivate}
              onChange={(e) => setPayActivate(e.target.checked)}
              className="rounded border-gray-300"
            />
            Activate subscription (30 days)
          </label>
          <button
            type="submit"
            disabled={paySubmitting || !payAmount}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
          >
            {paySubmitting ? 'Recording...' : 'Record Payment'}
          </button>
        </form>
      </div>

      {/* Payment History */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h2>
        {shop.payments.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded.</p>
        ) : (
          <div className="space-y-2">
            {shop.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    R{p.amount.toFixed(2)}
                    <span className="text-gray-400 font-normal ml-2 text-xs uppercase">{p.method}</span>
                  </p>
                  {p.reference && <p className="text-xs text-gray-400">Ref: {p.reference}</p>}
                  {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                </div>
                <span className="text-xs text-gray-300 shrink-0">
                  {new Date(p.recorded_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
