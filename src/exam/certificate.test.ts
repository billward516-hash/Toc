import { describe, expect, it } from 'vitest'
import { certificateFileName, certificateId, certificateText, cleanName, formatDate, makeCertificate, renameCertificate } from './certificate.ts'
import { jpegToPdf } from './pdf.ts'
import { NAME_MAX } from './record.ts'

const AT = '2026-10-04T12:00:00.000Z'

describe('the certificate', () => {
  it('has a code that is easy to read out and the same every time', () => {
    const id = certificateId(AT, 34, 40, 12345)
    expect(id).toMatch(/^TOCF-[A-HJKMNP-TV-Z2-9]{4}-[A-HJKMNP-TV-Z2-9]{4}$/)
    expect(certificateId(AT, 34, 40, 12345)).toBe(id)
  })

  it('has a different code for a different moment, score, or exam', () => {
    const id = certificateId(AT, 34, 40, 12345)
    expect(certificateId('2026-10-05T12:00:00.000Z', 34, 40, 12345)).not.toBe(id)
    expect(certificateId(AT, 35, 40, 12345)).not.toBe(id)
    expect(certificateId(AT, 34, 41, 12345)).not.toBe(id)
    expect(certificateId(AT, 34, 40, 12346)).not.toBe(id)
  })

  it('does not give two certificates the same code', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 5000; seed++) seen.add(certificateId(AT, 28 + (seed % 13), 40, seed))
    expect(seen.size).toBe(5000)
  })

  it('tidies the name, and keeps the code when the name is corrected', () => {
    expect(cleanName('  Sam   Rivera  ')).toBe('Sam Rivera')
    expect(cleanName('x'.repeat(200))).toHaveLength(NAME_MAX)
    const certificate = makeCertificate('  Sam   Rivera ', { correct: 34, asked: 40 }, 9, AT)
    expect(certificate).toEqual({ name: 'Sam Rivera', at: AT, correct: 34, asked: 40, id: certificateId(AT, 34, 40, 9) })
    expect(renameCertificate(certificate, '  Samuel  Rivera ')).toEqual({ ...certificate, name: 'Samuel Rivera' })
  })

  it('says who passed, when, how well, and the pass mark', () => {
    const words = certificateText(makeCertificate('Sam Rivera', { correct: 34, asked: 40 }, 9, AT))
    expect(words.title).toBe('Certificate of Completion')
    expect(words.name).toBe('Sam Rivera')
    expect(words.score).toBe('Final exam score: 85% (34 of 40 correct)')
    expect(words.passMark).toBe('Pass mark: 70%')
    expect(words.date).toBe('Awarded October 4, 2026')
    expect(words.id).toMatch(/^Certificate ID TOCF-/)
    expect(words.fine).toMatch(/independent/)
    expect(words.fine).toMatch(/not an official certification/)
  })

  it('shows a score after extra questions as the percent of the questions asked, rounded down', () => {
    // 31 of 44 is 70.45%, a pass, shown as 70%. A score never shows as more than it was.
    expect(certificateText(makeCertificate('Sam', { correct: 31, asked: 44 }, 1, AT)).score).toBe('Final exam score: 70% (31 of 44 correct)')
  })

  it('formats a date in words, and shows what it was given if that is not a date', () => {
    expect(formatDate(AT)).toBe('October 4, 2026')
    expect(formatDate('not a date')).toBe('not a date')
  })

  it('names the saved file after the person, in plain letters', () => {
    expect(certificateFileName('Sam Rivera')).toBe('TOC-Factory-certificate-sam-rivera')
    expect(certificateFileName('José Müller-Ng')).toBe('TOC-Factory-certificate-jose-muller-ng')
    expect(certificateFileName('Тоня')).toBe('TOC-Factory-certificate')
    expect(certificateFileName('   ')).toBe('TOC-Factory-certificate')
  })
})

// A PDF is a set of numbered objects and a table of where each one starts, so a mistake of one byte
// anywhere breaks it. These check every number the file says about itself.
describe('the PDF', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, 0x80, 0x81, 0xfe, 0xff, 0xd9])
  const pdf = jpegToPdf(jpeg, 2200, 1700, { title: 'Certificate for Zoë – Sam', created: new Date('2026-10-04T12:30:45.000Z') })
  // One character per byte, so a position in the text is a position in the file.
  const text = Array.from(pdf, (byte) => String.fromCharCode(byte)).join('')

  it('starts and ends the way a PDF does', () => {
    expect(text.startsWith('%PDF-1.4\n')).toBe(true)
    expect(text.endsWith('%%EOF\n')).toBe(true)
  })

  it('says where its table of objects starts, and the table says where each object starts', () => {
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1])
    expect(text.slice(start, start + 7)).toBe('xref\n0 ')
    const table = text.slice(start).split('\n')
    expect(table[1]).toBe('0 7')
    expect(table[2]).toBe('0000000000 65535 f ')
    for (let number = 1; number <= 6; number++) {
      const entry = table[2 + number]
      expect(entry, `entry ${number}`).toMatch(/^\d{10} 00000 n $/)
      const offset = Number(entry.slice(0, 10))
      expect(text.slice(offset, offset + `${number} 0 obj\n`.length), `object ${number}`).toBe(`${number} 0 obj\n`)
    }
    // The table's lines are each exactly 20 bytes long, as the format requires.
    expect(`${table[2]}\n`).toHaveLength(20)
    expect(`${table[3]}\n`).toHaveLength(20)
  })

  it('gives the picture the length it has, and keeps its bytes whole', () => {
    const match = /\/Length (\d+) >>\nstream\n/.exec(text)!
    expect(Number(match[1])).toBe(jpeg.length)
    const from = match.index + match[0].length
    expect(Array.from(pdf.slice(from, from + jpeg.length))).toEqual(Array.from(jpeg))
    expect(text.slice(from + jpeg.length, from + jpeg.length + 10)).toBe('\nendstream')
  })

  it('gives the page contents the length they have', () => {
    const match = /5 0 obj\n<< \/Length (\d+) >>\nstream\n/.exec(text)!
    const from = match.index + match[0].length
    const content = text.slice(from, text.indexOf('endstream', from))
    expect(content).toBe('q\n792 0 0 612 0 0 cm\n/Im0 Do\nQ\n')
    expect(Number(match[1])).toBe(content.length)
  })

  it('fills a letter page with the picture, as a JPEG that the viewer decodes', () => {
    expect(text).toContain('/MediaBox [0 0 792 612]')
    expect(text).toContain('/Width 2200 /Height 1700')
    expect(text).toContain('/Filter /DCTDecode')
    expect(text).toContain('/Size 7')
  })

  it('carries the title and date, whatever letters are in the name', () => {
    // "Certificate for Zoë – Sam" as UTF-16: the ë is 00EB and the dash is 2013.
    expect(text).toContain('<FEFF')
    expect(text).toContain('00EB')
    expect(text).toContain('2013')
    expect(text).toContain('/CreationDate (D:20261004123045Z)')
  })

  it('takes another page size', () => {
    const a4 = Array.from(jpegToPdf(jpeg, 100, 50, { title: 'x', width: 842, height: 595 }), (byte) => String.fromCharCode(byte)).join('')
    expect(a4).toContain('/MediaBox [0 0 842 595]')
    expect(a4).toContain('842 0 0 595 0 0 cm')
  })
})
