import { EXAM } from './config.ts'
import type { Plan } from './draw.ts'

// What the exam keeps about one player, on their own device only: which questions they have seen, how
// each exam went, the exam in progress, and the details on their certificate. Nothing here is sent
// anywhere, class mode included.

export interface Attempt {
  at: string
  correct: number
  asked: number
  passed: boolean
}

// An exam in progress. The plan and the answers so far are enough to rebuild it exactly, so a tab that
// reloads, as an iPad's will, carries on where the player left off.
export interface Current extends Plan {
  answers: number[]
}

export interface CertificateRecord {
  name: string
  id: string
  at: string
  correct: number
  asked: number
}

export interface ExamRecord {
  // How many times each question has been asked, so a retake favors questions not yet met.
  seen: Record<string, number>
  // Finished exams, oldest first.
  attempts: Attempt[]
  current: Current | null
  certificate: CertificateRecord | null
  // The name last typed for a certificate.
  name: string
}

export const NAME_MAX = 60
const KEEP_ATTEMPTS = 20

export const emptyRecord = (): ExamRecord => ({ seen: {}, attempts: [], current: null, certificate: null, name: '' })

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
const textList = (value: unknown): string[] | null => (Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : null)

function cleanCurrent(value: unknown): Current | null {
  if (!isObject(value)) return null
  const main = textList(value.main)
  const reserve = textList(value.reserve)
  const answers = Array.isArray(value.answers) ? value.answers : null
  if (!isCount(value.seed) || !main || !reserve || !answers) return null
  if (main.length !== EXAM.length || reserve.length > EXAM.maxExtra) return null
  if (answers.length > main.length + reserve.length || !answers.every((a) => isCount(a) && a < 4)) return null
  return { seed: value.seed, main, reserve, answers: answers as number[] }
}

function cleanCertificate(value: unknown): CertificateRecord | null {
  if (!isObject(value)) return null
  const { name, id, at, correct, asked } = value
  if (typeof name !== 'string' || typeof id !== 'string' || typeof at !== 'string' || !isCount(correct) || !isCount(asked) || correct > asked) return null
  return { name: name.slice(0, NAME_MAX), id, at, correct, asked }
}

// Whatever was stored, as a record the exam can trust. Anything wrong with it is left out, never thrown.
export function cleanRecord(raw: unknown): ExamRecord {
  if (!isObject(raw)) return emptyRecord()
  const seen: Record<string, number> = {}
  if (isObject(raw.seen)) for (const [id, count] of Object.entries(raw.seen)) if (isCount(count)) seen[id] = count
  const attempts: Attempt[] = []
  if (Array.isArray(raw.attempts)) {
    for (const entry of raw.attempts) {
      if (isObject(entry) && typeof entry.at === 'string' && isCount(entry.correct) && isCount(entry.asked) && entry.correct <= entry.asked && typeof entry.passed === 'boolean') {
        attempts.push({ at: entry.at, correct: entry.correct, asked: entry.asked, passed: entry.passed })
      }
    }
  }
  return {
    seen,
    attempts: attempts.slice(-KEEP_ATTEMPTS),
    current: cleanCurrent(raw.current),
    certificate: cleanCertificate(raw.certificate),
    name: typeof raw.name === 'string' ? raw.name.slice(0, NAME_MAX) : '',
  }
}

export const begin = (record: ExamRecord, plan: Plan): ExamRecord => ({ ...record, current: { ...plan, answers: [] } })

// An answer to the question with this id, and that question counted as seen.
export function recordAnswer(record: ExamRecord, id: string, choice: number): ExamRecord {
  if (!record.current) return record
  return {
    ...record,
    current: { ...record.current, answers: [...record.current.answers, choice] },
    seen: { ...record.seen, [id]: (record.seen[id] ?? 0) + 1 },
  }
}

export function finish(record: ExamRecord, result: { correct: number; asked: number; passed: boolean }, at: string): ExamRecord {
  return { ...record, attempts: [...record.attempts, { at, ...result }].slice(-KEEP_ATTEMPTS), current: null }
}

export const abandon = (record: ExamRecord): ExamRecord => ({ ...record, current: null })

export const withCertificate = (record: ExamRecord, certificate: CertificateRecord): ExamRecord => ({ ...record, certificate, name: certificate.name })

export const withName = (record: ExamRecord, name: string): ExamRecord => ({ ...record, name: name.slice(0, NAME_MAX) })
