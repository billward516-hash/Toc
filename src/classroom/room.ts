import type { Choices } from '../levels/types.ts'

// A class, as it's kept online while it runs:
//
//   classes/<code>                  host (the host device's private ID), createdAt
//   classes/<code>/meta             since, focus, focusAt: what every student in the class may read
//   classes/<code>/players/<id>     name, joinedAt, online, now, progress, events: one student's entry,
//                                   which only that student's device may write and only the host reads
//   opened/<code>                   when the class began, so a class nobody ended gets cleared away
//
// See firebase/database.rules.json for who may do what.

// One result as the class sees it, sent from a student's device as it happens. `at` is the device's
// clock in milliseconds.
export type ClassEvent =
  | { type: 'answered'; levelId: string; at: number; answer: string; correct: boolean }
  | { type: 'predicted'; levelId: string; at: number; option: string; correct: boolean }
  | { type: 'ran'; levelId: string; at: number; choices: Choices; shipped: number; met: boolean; stars: number }

export interface ClassPlayer {
  // The device's private ID from Firebase; nobody sees it.
  id: string
  name: string
  joinedAt: number
  online: boolean
  // The level open on the student's screen, if any.
  now: string | null
  // Every level the student has finished on this device, before the class too, with its best stars.
  progress: Record<string, number>
  // Results during the class, oldest first.
  events: ClassEvent[]
}

// What every student in a class may read: when it began, and the level the instructor sent everyone
// to, if any, and when.
export interface ClassMeta {
  since: number
  focus: string | null
  focusAt: number
}

export interface ClassRoom {
  code: string
  host: string
  createdAt: number
  meta: ClassMeta
  // In the order they joined.
  players: ClassPlayer[]
}

// Everything below reads data a device wrote, so it takes nothing on trust: anything malformed is
// dropped rather than shown.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isFlag = (value: unknown): value is boolean => typeof value === 'boolean'

export function readMeta(raw: unknown): ClassMeta | null {
  if (!isRecord(raw)) return null
  return {
    since: isNumber(raw.since) ? raw.since : 0,
    focus: isText(raw.focus) ? raw.focus : null,
    focusAt: isNumber(raw.focusAt) ? raw.focusAt : 0,
  }
}

export function readEvent(raw: unknown): ClassEvent | null {
  if (!isRecord(raw) || !isText(raw.levelId) || !isNumber(raw.at)) return null
  const { levelId, at } = raw
  switch (raw.type) {
    case 'answered':
      return isText(raw.answer) && isFlag(raw.correct) ? { type: 'answered', levelId, at, answer: raw.answer, correct: raw.correct } : null
    case 'predicted':
      return isText(raw.option) && isFlag(raw.correct) ? { type: 'predicted', levelId, at, option: raw.option, correct: raw.correct } : null
    case 'ran': {
      if (!isRecord(raw.choices) || !isNumber(raw.shipped) || !isFlag(raw.met) || !isNumber(raw.stars)) return null
      const choices = Object.fromEntries(Object.entries(raw.choices).filter((entry): entry is [string, string] => isText(entry[1])))
      return { type: 'ran', levelId, at, choices, shipped: raw.shipped, met: raw.met, stars: raw.stars }
    }
    default:
      return null
  }
}

export function readPlayer(id: string, raw: unknown): ClassPlayer | null {
  if (!isRecord(raw) || !isText(raw.name) || !isNumber(raw.joinedAt)) return null
  const progress = isRecord(raw.progress)
    ? Object.fromEntries(Object.entries(raw.progress).filter((entry): entry is [string, number] => isNumber(entry[1])))
    : {}
  const events = isRecord(raw.events)
    ? Object.values(raw.events)
        .map(readEvent)
        .filter((event): event is ClassEvent => event !== null)
        .sort((a, b) => a.at - b.at)
    : []
  return {
    id,
    name: raw.name,
    joinedAt: raw.joinedAt,
    online: raw.online === true,
    now: isText(raw.now) ? raw.now : null,
    progress,
    events,
  }
}

export function readRoom(code: string, raw: unknown): ClassRoom | null {
  if (!isRecord(raw) || !isText(raw.host)) return null
  const createdAt = isNumber(raw.createdAt) ? raw.createdAt : 0
  const players = isRecord(raw.players)
    ? Object.entries(raw.players)
        .map(([id, player]) => readPlayer(id, player))
        .filter((player): player is ClassPlayer => player !== null)
        .sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1))
    : []
  return { code, host: raw.host, createdAt, meta: readMeta(raw.meta) ?? { since: createdAt, focus: null, focusAt: 0 }, players }
}
