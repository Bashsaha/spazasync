/**
 * Phase 51b — keeps the admin section from ever bloating the owner/teller app.
 *
 * App Router code-splits per route, so admin code only ships to a client bundle
 * if a NON-admin module imports it. The one realistic regression is someone
 * importing an admin CLIENT component (`@/components/admin/*`) — or an admin
 * page under `@/app/(app)/admin/*` — from shared chrome or an owner page, which
 * would pull admin JS into a chunk real users download.
 *
 * This test fails the build if that happens. Server-only data modules
 * (`@/lib/db/admin*`, `@/lib/db/field-sales`) are already fenced by
 * `import 'server-only'` so they can't reach a client bundle; this guard covers
 * the client-component vector that `server-only` does NOT catch.
 *
 * Allowed importers: anything already inside the admin section.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SRC = join(process.cwd(), 'src')

// Importer locations that are allowed to reference admin client code.
const ALLOWED_PREFIXES = [
  join('app', '(app)', 'admin'),
  join('app', 'api', 'admin'),
  join('components', 'admin'),
].map((p) => p + sep)

// Import specifiers that pull admin client code into a bundle.
const RESTRICTED = /from\s+['"]@\/(components\/admin|app\/\(app\)\/admin)/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('admin isolation — owner/teller bundles must not import admin client code', () => {
  it('no non-admin source file imports @/components/admin or admin pages', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      const rel = relative(SRC, file)
      if (ALLOWED_PREFIXES.some((p) => rel.startsWith(p))) continue
      if (RESTRICTED.test(readFileSync(file, 'utf8'))) {
        offenders.push(rel.split(sep).join('/'))
      }
    }
    expect(offenders, `These non-admin files import admin client code (would bloat the user app):\n${offenders.join('\n')}`).toEqual([])
  })
})
