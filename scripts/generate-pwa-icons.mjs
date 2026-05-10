// Rasterizes the brand SVGs in public/icons/ into the PNG sizes Chrome and iOS
// require to install the app as a true standalone PWA.
//
// Run: node scripts/generate-pwa-icons.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ICONS = path.join(ROOT, 'public', 'icons')
const PUBLIC = path.join(ROOT, 'public')

async function render(svgPath, outPath, size) {
  const svg = await readFile(svgPath)
  const buf = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 26, g: 188, b: 156, alpha: 1 } })
    .png()
    .toBuffer()
  await writeFile(outPath, buf)
  console.log('wrote', path.relative(ROOT, outPath), `(${size}x${size})`)
}

async function main() {
  const any = path.join(ICONS, 'icon.svg')
  const maskable = path.join(ICONS, 'icon-maskable.svg')

  await render(any, path.join(ICONS, 'icon-192.png'), 192)
  await render(any, path.join(ICONS, 'icon-512.png'), 512)
  await render(maskable, path.join(ICONS, 'icon-maskable-512.png'), 512)
  // apple-touch-icon lives at /apple-touch-icon.png (Safari looks here by default)
  await render(any, path.join(PUBLIC, 'apple-touch-icon.png'), 180)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
