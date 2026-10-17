// Draws every frame of scene.html in a browser: node frames.mjs <work dir> [seconds,seconds,...]
// The work dir holds timeline.json and curve.json, and gets a frames/ folder. Give a few times to
// draw only those, as test frames. Needs Playwright (PLAYWRIGHT_DIR) and Chromium (CHROMIUM_PATH).
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const work = process.argv[2]
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null
const { chromium } = await import(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR}/playwright/index.mjs` : 'playwright')
const timeline = JSON.parse(readFileSync(`${work}/timeline.json`, 'utf8'))
const curve = JSON.parse(readFileSync(`${work}/curve.json`, 'utf8'))
mkdirSync(`${work}/frames`, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`file://${here}/scene.html`)
await page.evaluate(([t, c]) => window.setup(t, c), [timeline, curve])
const times = only ?? Array.from({ length: Math.ceil(timeline.total * timeline.fps) }, (_, k) => k / timeline.fps)
for (const [i, t] of times.entries()) {
  await page.evaluate((t) => window.renderAt(t), t)
  const name = only ? `test-${String(t).replace('.', '_')}` : `f${String(i).padStart(5, '0')}`
  await page.screenshot({ path: `${work}/frames/${name}.jpg`, type: 'jpeg', quality: 92 })
}
console.log('frames', times.length, 'errors', errors)
await browser.close()
