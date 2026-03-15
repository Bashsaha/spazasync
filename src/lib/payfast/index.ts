/**
 * PayFast integration helpers.
 *
 * PayFast uses form POST redirects for checkout and ITN (Instant Transaction
 * Notification) webhooks for payment confirmations. This module handles
 * signature generation, checkout parameter assembly, and ITN validation.
 *
 * Docs: https://developers.payfast.co.za/docs
 */

import crypto from 'crypto'

// PayFast sandbox vs production
export const PAYFAST_HOST = process.env.PAYFAST_SANDBOX === 'true'
  ? 'https://sandbox.payfast.co.za'
  : 'https://www.payfast.co.za'

// PayFast valid IP ranges (for ITN validation)
const PAYFAST_IP_RANGES = [
  '197.97.145.144/28',
  '41.74.179.192/27',
]

// Sandbox IPs are not restricted
const SANDBOX_MODE = () => process.env.PAYFAST_SANDBOX === 'true'

/**
 * Generate a PayFast signature (MD5 hash of URL-encoded params + passphrase).
 * Per PayFast spec: sort params alphabetically is NOT required — use insertion order.
 * The passphrase is appended as the last parameter if provided.
 */
export function generateSignature(
  params: Record<string, string>,
  passphrase?: string,
): string {
  const entries = Object.entries(params).filter(([, v]) => v !== '')
  const paramString = entries
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim()).replace(/%20/g, '+')}`)
    .join('&')

  const withPassphrase = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
    : paramString

  return crypto.createHash('md5').update(withPassphrase).digest('hex')
}

/**
 * Build the checkout parameters for a PayFast subscription payment.
 * Returns the full parameter object including the signature.
 */
export function buildCheckoutParams(input: {
  shopId: string
  userEmail: string
  userName: string
  appUrl: string
}): Record<string, string> {
  const { shopId, userEmail, userName, appUrl } = input
  const merchantId = process.env.PAYFAST_MERCHANT_ID!
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY!
  const passphrase = process.env.PAYFAST_PASSPHRASE || ''
  const price = process.env.SUBSCRIPTION_PRICE_ZAR || '349.99'

  // PayFast requires params in a specific order for signature
  const params: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${appUrl}/subscribe?status=success`,
    cancel_url: `${appUrl}/subscribe?status=cancelled`,
    notify_url: `${appUrl}/api/subscribe/notify`,
    name_first: userName.split(' ')[0] || userName,
    name_last: userName.split(' ').slice(1).join(' ') || '',
    email_address: userEmail,
    m_payment_id: shopId,
    amount: parseFloat(price).toFixed(2),
    item_name: 'SpazaSync Monthly Plan',
    subscription_type: '1',
    billing_date: new Date().toISOString().split('T')[0],
    recurring_amount: parseFloat(price).toFixed(2),
    frequency: '3', // monthly
    cycles: '0', // infinite
  }

  // Remove empty values before signing
  const cleanParams: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== '') cleanParams[k] = v
  }

  const signature = generateSignature(cleanParams, passphrase)

  return { ...cleanParams, signature }
}

/**
 * Check if an IP address falls within the PayFast valid ranges.
 * In sandbox mode, all IPs are accepted.
 */
export function isPayFastIP(ip: string): boolean {
  if (SANDBOX_MODE()) return true

  for (const range of PAYFAST_IP_RANGES) {
    if (ipInCIDR(ip, range)) return true
  }
  return false
}

/**
 * Validate a PayFast ITN (Instant Transaction Notification) request.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export async function validateITN(
  body: Record<string, string>,
  sourceIp: string,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  // 1. Check source IP
  if (!isPayFastIP(sourceIp)) {
    return { valid: false, reason: `Invalid source IP: ${sourceIp}` }
  }

  // 2. Verify signature
  const passphrase = process.env.PAYFAST_PASSPHRASE || ''
  const receivedSignature = body.signature
  if (!receivedSignature) {
    return { valid: false, reason: 'Missing signature' }
  }

  // Build param string from body (exclude signature)
  const paramsWithoutSig: Record<string, string> = {}
  for (const [k, v] of Object.entries(body)) {
    if (k !== 'signature') paramsWithoutSig[k] = v
  }

  const expectedSignature = generateSignature(paramsWithoutSig, passphrase)
  if (expectedSignature !== receivedSignature) {
    return { valid: false, reason: 'Signature mismatch' }
  }

  // 3. Server confirmation (POST back to PayFast to validate)
  try {
    const confirmUrl = `${PAYFAST_HOST}/eng/query/validate`
    const confirmBody = new URLSearchParams(body).toString()

    const response = await fetch(confirmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: confirmBody,
    })

    const text = await response.text()
    if (text.trim() !== 'VALID') {
      return { valid: false, reason: `Server validation failed: ${text.trim()}` }
    }
  } catch (error) {
    return { valid: false, reason: `Server validation request failed: ${error}` }
  }

  return { valid: true }
}

// ── IP utilities ──────────────────────────────────────────────

function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number)
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function ipInCIDR(ip: string, cidr: string): boolean {
  const [rangeIp, bits] = cidr.split('/')
  const mask = ~(2 ** (32 - parseInt(bits)) - 1) >>> 0
  return (ipToLong(ip) & mask) === (ipToLong(rangeIp) & mask)
}
