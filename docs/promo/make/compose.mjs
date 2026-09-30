// Lays the captured game frames out as a 960x540 animation and writes the GIF.
//
//   npm install --no-save gifenc pngjs
//   node docs/promo/make/compose.mjs [work folder] [output file]
//
// The story: a title card, the factory with the upgrade on the wrong station (a pile grows and nothing
// ships more), the same factory with the upgrade on the right station, and a closing card. The numbers
// in the result cards are the ones the game itself reported. Nothing here is faked.
import { createRequire } from 'node:module'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import gifenc from 'gifenc'
import pngjs from 'pngjs'

const require = createRequire(process.env.PLAYWRIGHT_DIR ?? '/opt/node22/lib/node_modules/')
const { chromium } = require('playwright')
const { PNG } = pngjs
const { GIFEncoder, quantize, applyPalette } = gifenc

const HERE = dirname(fileURLToPath(import.meta.url))
const WORK = process.argv[2] ?? join(tmpdir(), 'toc-gif')
const OUT = process.argv[3] ?? resolve(HERE, '..', 'toc-factory.gif')
const STILLS = process.env.STILLS ? `${WORK}/stills` : null
const SCALE = Number(process.env.SCALE ?? 1.2)
const W = Math.round(800 * SCALE)
const H = Math.round(450 * SCALE)
const FRAME = Number(process.env.FRAME ?? 40)
const meta = JSON.parse(readFileSync(`${WORK}/frames/meta.json`, 'utf8'))

// The layout page sits next to the frames so it can load them, and the app icon beside it.
mkdirSync(`${WORK}/assets`, { recursive: true })
copyFileSync(`${HERE}/template.html`, `${WORK}/template.html`)
copyFileSync(resolve(HERE, '../../../public/icon-512.png'), `${WORK}/assets/icon.png`)

// ---- the story -----------------------------------------------------------------------------------
const timeline = []
timeline.push({ kind: 'title', delay: 1400, name: 'title' })

function scene(name, caption, ring) {
  const sc = meta.scenes[name]
  const all = [...sc.frames.map((f) => ({ src: f.file, minute: f.minute, pile: f.waiting[3] })), { src: sc.final, minute: 480, pile: sc.finalWaiting[3], last: true }]
  all.forEach((f, i) => {
    const r = ring(f)
    timeline.push({ kind: 'floor', src: f.src, minute: f.minute, caption, ring: r && { ...r, pulse: Math.floor(i / 3) % 2 === 1 }, delay: f.last ? 500 : FRAME, name: `${name}-${f.minute}` })
  })
}
function reveal(name, caption, delay) {
  const sc = meta.scenes[name]
  const t = sc.dialogText
  timeline.push({ kind: 'reveal', src: sc.final, caption, delay, name: `${name}-reveal`,
    card: { ok: t[0] === 'GOAL MET', badge: t[0], title: t[1], stats: [[t[2], t[3]], [t[4], t[5]], [t[6], t[7]]] } })
}

scene('wrong', { big: 'Give <span class="blue">Cut</span> a 25% speed-up…' },
  (f) => (f.pile >= 8 ? { tone: 'bad', label: `${f.pile} parts stuck` } : null))
reveal('wrong', { big: '…and <span class="red">nothing changes.</span>', sub: `${meta.scenes.wrong.dialogText[3]} robots a day, before and after.` }, 1500)
scene('right', { big: 'Now boost <span class="cyan">Assemble</span>…', sub: 'the station where the pile formed' },
  (f) => (f.minute >= 60 ? { tone: 'good', label: 'No pile' } : null))
reveal('right', { big: `<span class="green">+${Number(meta.scenes.right.dialogText[3]) - Number(meta.scenes.right.dialogText[5])} robots a day.</span>`, sub: 'Same upgrade. Right station.' }, 1800)
timeline.push({ kind: 'end', delay: 2200, name: 'end' })

// ---- render every frame ---------------------------------------------------------------------------
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 }, deviceScaleFactor: SCALE * 2 })).newPage()
await page.goto(`file://${WORK}/template.html`)
if (STILLS) mkdirSync(STILLS, { recursive: true })

// The page is drawn at twice the output size, then each 2x2 block is averaged: clean, smooth edges.
function halve(png) {
  const out = new Uint8Array(W * H * 4)
  const src = png.data
  const sw = png.width
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let c = 0; c < 3; c++) {
        const i = ((2 * y) * sw + 2 * x) * 4 + c
        out[(y * W + x) * 4 + c] = (src[i] + src[i + 4] + src[i + sw * 4] + src[i + sw * 4 + 4] + 2) >> 2
      }
      out[(y * W + x) * 4 + 3] = 255
    }
  }
  return out
}

const frames = []
const stillNames = new Set(['title', 'wrong-150', 'wrong-480', 'wrong-reveal', 'right-240', 'right-480', 'right-reveal', 'end'])
for (const d of timeline) {
  await page.evaluate((x) => window.render(x), d)
  const png = PNG.sync.read(await page.screenshot({ type: 'png' }))
  const rgba = halve(png)
  frames.push({ rgba, delay: d.delay, name: d.name })
  if (STILLS && stillNames.has(d.name)) {
    const p = new PNG({ width: W, height: H })
    p.data = Buffer.from(rgba)
    writeFileSync(`${STILLS}/${d.name}.png`, PNG.sync.write(p))
  }
}
await browser.close()
console.log('rendered', frames.length, 'frames;', (frames.reduce((s, f) => s + f.delay, 0) / 1000).toFixed(1), 'seconds')

// ---- one shared palette, then only what changes between frames ------------------------------------
const pick = frames.filter((f, i) => !f.name.includes('-') || f.name.endsWith('reveal') || i % 3 === 0)
const sample = new Uint8Array(pick.length * W * H * 4)
pick.forEach((f, i) => sample.set(f.rgba, i * W * H * 4))
const colors = quantize(sample, 255, { format: 'rgb565' })
const palette = [...colors, [0, 0, 0]]
const TRANSPARENT = palette.length - 1
while (palette.length < 256) palette.push([0, 0, 0])
const gif = GIFEncoder()
let prev = null
frames.forEach((f, i) => {
  const index = applyPalette(f.rgba, colors, 'rgb565')
  let out = index
  if (prev) {
    // Pixels that did not change from the last frame are left transparent, which shrinks the file a lot.
    out = new Uint8Array(index.length)
    for (let j = 0; j < index.length; j++) out[j] = index[j] === prev[j] ? TRANSPARENT : index[j]
  }
  gif.writeFrame(out, W, H, { palette: i === 0 ? palette : undefined, delay: f.delay, transparent: !!prev, transparentIndex: TRANSPARENT, dispose: 1, repeat: 0 })
  prev = index
})
gif.finish()
const bytes = gif.bytes()
writeFileSync(OUT, bytes)
console.log('wrote', OUT, (bytes.length / 1e6).toFixed(2), 'MB,', colors.length, 'colors')
