// A one-page PDF holding one JPEG picture that fills the page. The certificate is drawn on a canvas, so
// it looks the same on every device and any name prints, whatever script it is written in. This wraps
// that picture as a PDF to save, share, or print.

export interface PdfOptions {
  // Shown in a PDF viewer's title bar.
  title: string
  // The page size in points (72 to the inch). Letter, landscape, unless said otherwise.
  width?: number
  height?: number
  created?: Date
}

const encoder = new TextEncoder()

// A PDF text string as UTF-16 with a byte order mark, written in hexadecimal, so any name is safe.
function pdfText(text: string): string {
  let out = 'FEFF'
  for (let i = 0; i < text.length; i++) out += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${out}>`
}

const pdfDate = (date: Date): string => `D:${date.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`

export function jpegToPdf(jpeg: Uint8Array, pixelWidth: number, pixelHeight: number, options: PdfOptions): Uint8Array<ArrayBuffer> {
  const width = options.width ?? 792
  const height = options.height ?? 612
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let size = 0
  const add = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    chunks.push(bytes)
    size += bytes.length
  }
  const object = (number: number, ...body: (string | Uint8Array)[]) => {
    offsets[number] = size
    add(`${number} 0 obj\n`)
    for (const part of body) add(part)
    add('endobj\n')
  }

  add('%PDF-1.4\n')
  // A few bytes above 127 tell programs that read the file as text that it holds binary data.
  add(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  object(1, '<< /Type /Catalog /Pages 2 0 R >>\n')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n')
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\n`)
  object(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream\n',
  )
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\n`)
  object(6, `<< /Title ${pdfText(options.title)} /Producer (TOC Factory) /CreationDate (${pdfDate(options.created ?? new Date())}) >>\n`)

  const xref = size
  let table = `xref\n0 7\n0000000000 65535 f \n`
  for (let number = 1; number <= 6; number++) table += `${String(offsets[number]).padStart(10, '0')} 00000 n \n`
  add(`${table}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}
