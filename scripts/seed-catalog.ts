/**
 * Seed the barcode_catalog table with South African product data.
 *
 * Usage: npx tsx scripts/seed-catalog.ts [path/to/csv]
 *
 * Defaults to data/sa-products.csv if no path is given.
 * Safe to re-run — duplicates are silently skipped (ON CONFLICT DO NOTHING).
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local (or environment variables).
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

config({ path: '.env.local' })

const csvPath = process.argv[2] || 'data/sa-products.csv'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface CsvRow {
  barcode: string
  name: string
  category: string | null
}

function parseCsv(filePath: string): CsvRow[] {
  const fullPath = resolve(filePath)
  const raw = readFileSync(fullPath, 'utf-8')
  const lines = raw.split('\n').filter((line) => line.trim().length > 0)

  // Skip header row
  const header = lines[0].toLowerCase()
  if (!header.includes('barcode') || !header.includes('name')) {
    console.error('CSV must have a header row with "barcode" and "name" columns')
    process.exit(1)
  }

  const rows: CsvRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    const barcode = parts[0]?.trim()
    const name = parts[1]?.trim()
    const category = parts[2]?.trim() || null

    if (!barcode || !name) {
      errors.push(`  Row ${i + 1}: missing barcode or name`)
      continue
    }

    if (barcode.length > 50) {
      errors.push(`  Row ${i + 1}: barcode too long (${barcode.length} chars)`)
      continue
    }

    if (name.length > 200) {
      errors.push(`  Row ${i + 1}: name too long (${name.length} chars)`)
      continue
    }

    rows.push({ barcode, name, category })
  }

  if (errors.length > 0) {
    console.warn(`\nSkipped ${errors.length} invalid row(s):`)
    errors.forEach((e) => console.warn(e))
  }

  return rows
}

async function main() {
  console.log(`Reading CSV: ${csvPath}`)
  const rows = parseCsv(csvPath)
  console.log(`Parsed ${rows.length} valid row(s)\n`)

  if (rows.length === 0) {
    console.log('Nothing to insert.')
    return
  }

  // Batch upsert in chunks of 500
  const CHUNK_SIZE = 500
  let totalInserted = 0
  let totalSkipped = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1
    const totalChunks = Math.ceil(rows.length / CHUNK_SIZE)

    console.log(`Inserting chunk ${chunkNum}/${totalChunks} (${chunk.length} rows)...`)

    const { data, error } = await admin
      .from('barcode_catalog')
      .upsert(
        chunk.map((r) => ({
          barcode: r.barcode,
          name: r.name,
          category: r.category,
        })),
        { onConflict: 'barcode', ignoreDuplicates: true },
      )
      .select('id')

    if (error) {
      console.error(`  Chunk ${chunkNum} failed:`, error.message)
      process.exit(1)
    }

    const inserted = data?.length ?? 0
    const skipped = chunk.length - inserted
    totalInserted += inserted
    totalSkipped += skipped

    console.log(`  ${inserted} inserted, ${skipped} skipped (already in catalog)`)
  }

  console.log(`\nDone! ${totalInserted} inserted, ${totalSkipped} skipped.`)
}

main()
