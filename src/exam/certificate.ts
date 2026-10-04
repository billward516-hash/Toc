import { EXAM } from './config.ts'
import { NAME_MAX, type CertificateRecord } from './record.ts'
import { percentOf } from './rules.ts'

// Letters and digits that cannot be mistaken for one another when read out or copied: no 0, 1, I, L, O, or U.
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

// A small, well-spread 53-bit hash of some text (cyrb53). Nothing secret rests on it.
function hash53(text: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

// A name as typed, tidied: extra spaces gone, and no longer than the certificate has room for.
export const cleanName = (text: string): string => text.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX).trim()

// A short code for a certificate, like TOCF-7K3Q-9XPA, from the moment, the score, and the exam's random
// seed. It identifies the exam result, not the name on it, so correcting a typo in the name keeps it. It
// tells certificates apart and gives something to quote. It is not a security feature: nothing checks it
// against a record, and anyone could make one up.
export function certificateId(at: string, correct: number, asked: number, seed: number): string {
  let value = hash53(`${at}|${correct}/${asked}|${seed}`)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[value % ALPHABET.length]
    value = Math.floor(value / ALPHABET.length)
  }
  return `TOCF-${code.slice(0, 4)}-${code.slice(4)}`
}

// The certificate for a pass: who, when, how well, and the code.
export function makeCertificate(name: string, result: { correct: number; asked: number }, seed: number, at: string): CertificateRecord {
  return { name: cleanName(name), at, correct: result.correct, asked: result.asked, id: certificateId(at, result.correct, result.asked, seed) }
}

// The same certificate with a corrected name.
export const renameCertificate = (certificate: CertificateRecord, name: string): CertificateRecord => ({ ...certificate, name: cleanName(name) })

export function formatDate(at: string): string {
  const date = new Date(at)
  return Number.isNaN(date.getTime()) ? at : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Every line printed on a certificate, in words, so the drawing and the tests agree on what it says.
export function certificateText(c: CertificateRecord) {
  return {
    brand: 'TOC FACTORY',
    title: 'Certificate of Completion',
    intro: 'This certifies that',
    name: c.name,
    body: ['has successfully completed the TOC Factory training', 'on the Theory of Constraints by passing the final exam.'],
    score: `Final exam score: ${percentOf(c.correct, c.asked)}% (${c.correct} of ${c.asked} correct)`,
    passMark: `Pass mark: ${EXAM.passPercent}%`,
    date: `Awarded ${formatDate(c.at)}`,
    id: `Certificate ID ${c.id}`,
    fine: 'TOC Factory is an independent training game. This is not an official certification from any Theory of Constraints organization.',
  }
}

// A name for the saved file, such as TOC-Factory-certificate-sam-rivera.
export function certificateFileName(name: string): string {
  const slug = cleanName(name)
    .toLowerCase()
    .normalize('NFKD')
    // An accent comes out of NFKD as its own mark after the letter; drop it, so ü becomes u.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `TOC-Factory-certificate${slug ? `-${slug}` : ''}`
}
