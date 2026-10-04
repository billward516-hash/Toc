import { certificateText } from './certificate.ts'
import type { CertificateRecord } from './record.ts'

// Draws a certificate on a canvas. It is laid out on a landscape letter page, 1100 by 850 units, and
// drawn at any scale, so it can be shown on screen, saved as a picture, or wrapped as a PDF. Only the
// device's own fonts are used, so any name prints, in any script.
export const CERTIFICATE_UNITS = { width: 1100, height: 850 } as const
const { width: W, height: H } = CERTIFICATE_UNITS

const INK = '#1f2544'
const PAPER = '#fff7e6'
const BLUE = '#3f63f5'
const MUTED = '#62688a'
const AMBER = '#ffb020'
const GREEN_SOFT = '#e7f6ee'
const GREEN_DEEP = '#13804f'
const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif'
const SANS = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, "DejaVu Sans", sans-serif'

type Context = CanvasRenderingContext2D

function roundedRect(ctx: Context, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Sets the font at the largest size, up to `size`, at which the text fits in `maxWidth`.
function fit(ctx: Context, text: string, maxWidth: number, size: number, font: (px: number) => string): number {
  let px = size
  ctx.font = font(px)
  while (ctx.measureText(text).width > maxWidth && px > 12) {
    px -= 1
    ctx.font = font(px)
  }
  return px
}

function centered(ctx: Context, text: string, y: number, maxWidth: number, size: number, font: (px: number) => string, color: string) {
  fit(ctx, text, maxWidth, size, font)
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.fillText(text, W / 2, y)
}

// Capital letters with space between them, which a canvas has no setting for in every browser.
function spaced(ctx: Context, text: string, y: number, spacing: number, font: string, color: string) {
  ctx.font = font
  ctx.textAlign = 'left'
  ctx.fillStyle = color
  const widths = Array.from(text, (ch) => ctx.measureText(ch).width)
  let x = W / 2 - (widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1)) / 2
  Array.from(text).forEach((ch, i) => {
    ctx.fillText(ch, x, y)
    x += widths[i] + spacing
  })
}

export function drawCertificate(canvas: HTMLCanvasElement, certificate: CertificateRecord, icon: CanvasImageSource | null): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot draw the certificate.')
  const scale = canvas.width / W
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.textBaseline = 'alphabetic'
  const words = certificateText(certificate)

  // The paper, with a heavy frame in the game's style and a thin one inside it.
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  roundedRect(ctx, 24, 24, W - 48, H - 48, 40)
  ctx.lineWidth = 8
  ctx.strokeStyle = INK
  ctx.stroke()
  roundedRect(ctx, 46, 46, W - 92, H - 92, 28)
  ctx.lineWidth = 3
  ctx.strokeStyle = BLUE
  ctx.stroke()
  for (const [x, y] of [
    [72, 72],
    [W - 72, 72],
    [72, H - 72],
    [W - 72, H - 72],
  ]) {
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fillStyle = AMBER
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.stroke()
  }

  // The game's icon, then who this is for and what for.
  if (icon) {
    ctx.save()
    roundedRect(ctx, W / 2 - 52, 62, 104, 104, 24)
    ctx.clip()
    ctx.drawImage(icon, W / 2 - 52, 62, 104, 104)
    ctx.restore()
    roundedRect(ctx, W / 2 - 52, 62, 104, 104, 24)
    ctx.lineWidth = 4
    ctx.strokeStyle = INK
    ctx.stroke()
  }
  spaced(ctx, words.brand, 206, 8, `800 26px ${SANS}`, BLUE)
  centered(ctx, words.title, 284, 900, 70, (px) => `700 ${px}px ${SERIF}`, INK)
  roundedRect(ctx, W / 2 - 60, 304, 120, 8, 4)
  ctx.fillStyle = AMBER
  ctx.fill()
  centered(ctx, words.intro, 360, 700, 28, (px) => `600 ${px}px ${SANS}`, MUTED)
  centered(ctx, words.name, 456, 840, 84, (px) => `italic 700 ${px}px ${SERIF}`, INK)
  ctx.beginPath()
  ctx.moveTo(W / 2 - 380, 478)
  ctx.lineTo(W / 2 + 380, 478)
  ctx.lineWidth = 3
  ctx.strokeStyle = INK
  ctx.stroke()
  centered(ctx, words.body[0], 530, 900, 30, (px) => `600 ${px}px ${SANS}`, INK)
  centered(ctx, words.body[1], 568, 900, 30, (px) => `600 ${px}px ${SANS}`, INK)

  // The score, in a pill.
  fit(ctx, words.score, 760, 30, (px) => `800 ${px}px ${SANS}`)
  const pill = Math.min(840, Math.max(480, ctx.measureText(words.score).width + 72))
  roundedRect(ctx, W / 2 - pill / 2, 596, pill, 62, 31)
  ctx.fillStyle = GREEN_SOFT
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = GREEN_DEEP
  ctx.fillText(words.score, W / 2, 636)
  centered(ctx, words.passMark, 690, 600, 20, (px) => `600 ${px}px ${SANS}`, MUTED)

  // The date and the code, and the small print.
  fit(ctx, words.date, 420, 24, (px) => `700 ${px}px ${SANS}`)
  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  ctx.fillText(words.date, 100, 738)
  fit(ctx, words.id, 420, 24, (px) => `700 ${px}px ${SANS}`)
  ctx.textAlign = 'right'
  ctx.fillText(words.id, W - 100, 738)
  centered(ctx, words.fine, 776, 940, 15, (px) => `600 ${px}px ${SANS}`, MUTED)
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } catch {
    return null
  }
}

// A canvas holding the certificate. `scale` 2 is 2200 by 1700 pixels: sharp on paper and on screen.
export async function renderCertificate(certificate: CertificateRecord, iconUrl: string, scale = 2): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  drawCertificate(canvas, certificate, await loadImage(iconUrl))
  return canvas
}

export const canvasBlob = (canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The certificate could not be saved as a picture.'))), type, quality))
