#!/usr/bin/env node
/**
 * Phase 41d — URL liveness checker for tasks/compliance-facts-audit.md section A.
 *
 * Each line in the audit doc's "A. Official URLs the app links to" table is a
 * URL we depend on rendering 200 to owners. Government sites rotate paths and
 * remove PDFs without redirects, so silent drift is a real risk.
 *
 * Usage:
 *   node scripts/check-compliance-urls.mjs
 *   node scripts/check-compliance-urls.mjs --json   # machine-readable output
 *
 * Exit code:
 *   0 — every URL returned 2xx (or 3xx that still resolves to the same host)
 *   1 — at least one URL is broken; fix the row in the audit doc OR the seed/
 *       hardcode that links to it, then re-run
 *
 * SA gov SSL note: Many .gov.za hosts use intermediate certs that aren't in
 * Node's bundled CA store, so the first fetch attempt may fail with "fetch
 * failed" even when curl + a real browser are fine. On that specific error we
 * retry once with TLS chain verification relaxed (matches what an end-user's
 * browser would tolerate). If the retry returns 2xx, we mark the URL as "ok
 * (tls-relax)" — surfaced in the human output so you know the cert chain
 * needs attention but the URL itself is alive.
 *
 * This script is intentionally CI-runnable but not yet wired into CI — the
 * audit doc's "Tooling backlog" section flags that as a follow-up.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Agent, fetch as undiciFetch } from 'undici'

const AUDIT_PATH = join(process.cwd(), 'tasks', 'compliance-facts-audit.md')
const SECTION_RE = /## A\. Official URLs[\s\S]*?(?=\n## )/
const URL_RE = /`(https?:\/\/[^`]+)`/g
const TIMEOUT_MS = 15_000

/**
 * Known-flaky-from-checker-but-verified-alive-for-end-users URLs.
 * Some SA gov sites aggressively block automated requests (sarsefiling WAF
 * returns 403 to non-browser user agents; ufiling + smmesa appear to be
 * behind a DDoS-protection layer that times out on anything that isn't a
 * full browser). The audit doc's "last verified" column is the source of
 * truth for these — re-verify manually in a browser at every 6-month audit.
 * Add to this list only after confirming the URL works in Firefox + Chrome
 * from a SA-resident IP.
 */
const CHECKER_SKIP = new Set([
  'https://www.sarsefiling.co.za',     // WAF 403 on HEAD; live in browser
  'https://www.ufiling.co.za',         // DDoS protection timeout; live in browser
  'https://www.smmesa.gov.za',         // DDoS protection timeout; live in browser
])

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')

// Strict TLS (default) — first attempt.
const strictAgent = new Agent({ headersTimeout: TIMEOUT_MS, bodyTimeout: TIMEOUT_MS })
// Relaxed TLS — only used as a retry when the strict attempt threw "fetch failed".
const relaxedAgent = new Agent({
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
  connect: { rejectUnauthorized: false },
})

const HEADERS = { 'User-Agent': 'Movestock/compliance-url-check (+https://movestock.app)' }

function extractUrls(markdown) {
  const section = markdown.match(SECTION_RE)?.[0]
  if (!section) throw new Error('Could not find Section A in audit doc')
  const urls = new Set()
  for (const match of section.matchAll(URL_RE)) {
    urls.add(match[1])
  }
  return [...urls]
}

async function attempt(url, dispatcher) {
  let res = await undiciFetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    headers: HEADERS,
    dispatcher,
  })
  if (res.status === 405 || res.status === 501) {
    res = await undiciFetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: HEADERS,
      dispatcher,
    })
  }
  return res
}

async function probe(url) {
  if (CHECKER_SKIP.has(url)) {
    return { url, status: 0, ok: true, skipped: true, tlsRelaxed: false }
  }
  let tlsRelaxed = false
  try {
    const res = await attempt(url, strictAgent)
    const finalUrl = new URL(res.url)
    const originalHost = new URL(url).host
    const sameHost = finalUrl.host === originalHost
    return {
      url,
      status: res.status,
      ok: res.ok && sameHost,
      finalUrl: res.url,
      sameHost,
      tlsRelaxed,
    }
  } catch (err) {
    // Only retry on the SA-gov-cert-style failure — not on timeouts/aborts.
    const msg = String(err?.message ?? err)
    if (!msg.includes('fetch failed')) {
      return { url, status: 0, ok: false, error: msg, tlsRelaxed }
    }
    try {
      tlsRelaxed = true
      const res = await attempt(url, relaxedAgent)
      const finalUrl = new URL(res.url)
      const originalHost = new URL(url).host
      const sameHost = finalUrl.host === originalHost
      return {
        url,
        status: res.status,
        ok: res.ok && sameHost,
        finalUrl: res.url,
        sameHost,
        tlsRelaxed,
      }
    } catch (err2) {
      return {
        url,
        status: 0,
        ok: false,
        error: String(err2?.message ?? err2),
        tlsRelaxed,
      }
    }
  }
}

async function main() {
  const markdown = readFileSync(AUDIT_PATH, 'utf8')
  const urls = extractUrls(markdown)
  if (urls.length === 0) {
    console.error('No URLs found in section A — check the audit doc')
    process.exit(1)
  }

  if (!asJson) {
    console.log(`Checking ${urls.length} URLs from ${AUDIT_PATH}\n`)
  }

  const results = []
  const CONCURRENCY = 6
  let inflight = 0
  let i = 0
  await new Promise((resolve) => {
    const next = () => {
      while (inflight < CONCURRENCY && i < urls.length) {
        const idx = i++
        const url = urls[idx]
        inflight++
        probe(url).then((r) => {
          results[idx] = r
          if (!asJson) {
            const icon = r.skipped ? '—' : r.ok ? '✓' : '✗'
            const tlsNote = r.tlsRelaxed && r.ok ? ' (tls-relax)' : r.skipped ? ' (checker-skip, manual verify)' : ''
            const detail = r.ok
              ? ''
              : r.error
                ? `(${r.error})`
                : !r.sameHost
                  ? `(redirected to ${new URL(r.finalUrl).host})`
                  : ''
            console.log(`${icon} ${r.skipped ? 'SKIP' : r.status || 'ERR'}${tlsNote}  ${url}  ${detail}`)
          }
          inflight--
          if (i >= urls.length && inflight === 0) resolve()
          else next()
        })
      }
    }
    next()
  })

  const broken = results.filter((r) => !r.ok)
  const tlsWarn = results.filter((r) => r.ok && r.tlsRelaxed)
  if (asJson) {
    console.log(JSON.stringify({ total: urls.length, broken: broken.length, tlsWarn: tlsWarn.length, results }, null, 2))
  } else {
    console.log(`\n${results.length - broken.length}/${results.length} ok${tlsWarn.length > 0 ? ` (${tlsWarn.length} via TLS-relax retry)` : ''}`)
    if (broken.length > 0) {
      console.log('\nBROKEN:')
      for (const r of broken) {
        console.log(`  ${r.url}`)
        console.log(`    status=${r.status}${r.error ? ` error=${r.error}` : ''}${r.finalUrl && r.finalUrl !== r.url ? ` final=${r.finalUrl}` : ''}`)
      }
    }
  }
  process.exit(broken.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(2)
})
