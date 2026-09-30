// Plays level 1.1 ("Spend the upgrade wisely") in the real game twice, with the new tool on the wrong
// station and then the right one, and saves a picture of the factory every few minutes of the shift.
// Time is stepped with the shift clock's arrow keys, so every frame is exactly that moment.
//
//   npm run build && npx vite preview --port 4173      (in another terminal)
//   node docs/promo/make/capture.mjs [work folder]
import { createRequire } from 'node:module'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Playwright comes with the Claude Code cloud sessions; elsewhere, set PLAYWRIGHT_DIR to its node_modules.
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? '/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/'
const OUT = process.argv[2] ?? join(tmpdir(), 'toc-gif')
const STEP = Number(process.env.STEP ?? 10)
// The part of the page that goes in the GIF: the header and the factory floor, in CSS pixels.
const CLIP = { x: 16, y: 40, width: 1148, height: 534 }
rmSync(`${OUT}/frames`, { recursive: true, force: true })
mkdirSync(`${OUT}/frames`, { recursive: true })

const browser = await chromium.launch()
const done = ['tier0-pileup', 'tier0-busy', 'tier0-weakest-link']
const seed = `localStorage.setItem('toc-factory:learner', JSON.stringify({ id: 'promo', nickname: 'Promo' }));
  localStorage.setItem('toc-factory:learners', JSON.stringify([{ id: 'promo', nickname: 'Promo' }]));
  localStorage.setItem('toc-factory:progress:promo', JSON.stringify(${JSON.stringify(done)}.map((levelId) => ({ type: 'completed', levelId, learnerId: 'promo', at: '2026-09-28T00:00:00Z' }))));`
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 })
await context.addInitScript({ content: `if (!sessionStorage.getItem('seeded')) { ${seed} sessionStorage.setItem('seeded', '1') }` })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE)
await page.getByRole('button', { name: /Spend the upgrade wisely/ }).click()
await page.getByRole('dialog').getByRole('button', { name: /Watch the factory/ }).click()
await page.waitForTimeout(600)

const clockText = () => page.locator('.clock span').first().innerText()
const waiting = () => page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^\d+ waiting$/.test((e.textContent || '').trim())).map((e) => Number((e.textContent || '').replace(/\D/g, ''))))
const meta = { step: STEP, clip: CLIP, scenes: {} }

async function scene(name, tool) {
  await page.locator('fieldset', { hasText: 'New tool' }).getByRole('button', { name: tool, exact: true }).click()
  await page.getByRole('button', { name: /Run the shift with my plan/ }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const scrub = page.getByRole('slider', { name: 'Shift clock' })
  await scrub.focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(150)
  if (!meta.geom) {
    // Where the piles sit, so the GIF can point at them.
    meta.geom = await page.evaluate(([cx, cy]) => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: +(b.x - cx).toFixed(1), y: +(b.y - cy).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) } }
      return { queues: [...document.querySelectorAll('rect.waiting-area')].map(r) }
    }, [CLIP.x, CLIP.y])
  }
  const frames = []
  for (let minute = 0; minute < 480; minute += STEP) {
    if (minute > 0) for (let k = 0; k < STEP / 5; k++) await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(90)
    const file = `frames/${name}-${String(frames.length).padStart(3, '0')}.png`
    await page.screenshot({ path: `${OUT}/${file}`, clip: CLIP })
    frames.push({ file, minute, clock: await clockText(), waiting: await waiting() })
  }
  // The last step reaches the end of the shift, which opens the result.
  for (let k = 0; k < STEP / 5; k++) await page.keyboard.press('ArrowRight')
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.waitForTimeout(400)
  const title = await dialog.locator('h2').textContent()
  const dialogText = (await dialog.innerText()).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10)
  await dialog.getByRole('button', { name: /Look at the factory/ }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/frames/${name}-final.png`, clip: CLIP })
  meta.scenes[name] = { tool, frames, final: `frames/${name}-final.png`, title, dialogText, finalWaiting: await waiting() }
  console.log(name, tool, '| frames', frames.length, '| result:', title, '| waiting at the end:', meta.scenes[name].finalWaiting.join(','))
}

await scene('wrong', 'Cut')
await page.getByRole('button', { name: 'Change my plan' }).first().click()
await page.waitForTimeout(400)
await scene('right', 'Assemble')
writeFileSync(`${OUT}/frames/meta.json`, JSON.stringify(meta, null, 1))
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
