import { describe, expect, it } from 'vitest'
import { levels } from '../levels/index.ts'
import type { ProgressEvent, StoredEvent } from '../progress/store.ts'
import { boardTiers, levelAnswers, progressBoard, studentLabels } from './board.ts'
import { cleanCode, codeInLink, formatCode, joinLink, newClassCode } from './code.ts'
import { readFirebaseSettings } from './config.ts'
import { eventKey, eventsSince, progressSummary, toClassEvent } from './events.ts'
import { readRoom, type ClassEvent, type ClassPlayer, type ClassRoom } from './room.ts'

const level = (id: string) => levels.find((l) => l.id === id)!
const pileup = level('tier0-pileup')
const dice = level('tier2-dice')
const upgrade = level('tier1-one-upgrade')

describe('class codes', () => {
  it('are six digits, drawn from the random source', () => {
    const draws = [0, 0.15, 0.99, 0.5, 0.25, 0.999999]
    expect(newClassCode(() => draws.shift()!)).toBe('019529')
    expect(newClassCode()).toMatch(/^\d{6}$/)
  })

  it('read from anything a student types with six digits in it', () => {
    expect(cleanCode('482915')).toBe('482915')
    expect(cleanCode(' 482 915 ')).toBe('482915')
    expect(cleanCode('482-915')).toBe('482915')
    expect(cleanCode('48291')).toBeNull()
    expect(cleanCode('4829150')).toBeNull()
    expect(formatCode('482915')).toBe('482 915')
  })

  it('go into the joining link, replacing anything already in its address, and come back out of it', () => {
    const link = joinLink('https://example.github.io/Toc/?class=111111#tier-3', '482915')
    expect(link).toBe('https://example.github.io/Toc/?class=482915')
    expect(codeInLink(new URL(link).search)).toBe('482915')
    expect(codeInLink('?other=1')).toBeNull()
    expect(codeInLink('')).toBeNull()
  })
})

describe('Firebase settings', () => {
  const snippet = `// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaFakeKeyForTests_123",
  authDomain: "toc-factory-class.firebaseapp.com",
  databaseURL: "https://toc-factory-class-default-rtdb.firebaseio.com",
  projectId: "toc-factory-class",
  storageBucket: "toc-factory-class.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);`

  it("read the console's snippet as pasted, whole", () => {
    expect(readFirebaseSettings(snippet)).toEqual({
      apiKey: 'AIzaFakeKeyForTests_123',
      authDomain: 'toc-factory-class.firebaseapp.com',
      databaseURL: 'https://toc-factory-class-default-rtdb.firebaseio.com',
      projectId: 'toc-factory-class',
      appId: '1:1234567890:web:abcdef',
    })
  })

  it('read JSON too, and work out the addresses a snippet leaves out', () => {
    expect(readFirebaseSettings('{"apiKey": "key", "projectId": "proj"}')).toEqual({
      apiKey: 'key',
      authDomain: 'proj.firebaseapp.com',
      databaseURL: 'https://proj-default-rtdb.firebaseio.com',
      projectId: 'proj',
      appId: undefined,
    })
  })

  it('leave class mode off without a key and a project', () => {
    expect(readFirebaseSettings(undefined)).toBeNull()
    expect(readFirebaseSettings('')).toBeNull()
    expect(readFirebaseSettings('apiKey: "key"')).toBeNull()
    expect(readFirebaseSettings('projectId: "proj"')).toBeNull()
  })
})

const stamp = (event: ProgressEvent, at: number): StoredEvent => ({ ...event, learnerId: 'sam', at: new Date(at).toISOString() })

describe("what a student's device sends", () => {
  const history: StoredEvent[] = [
    stamp({ type: 'started', levelId: pileup.id }, 1000),
    stamp({ type: 'answered', levelId: pileup.id, answer: 'cut', correct: false }, 2000),
    stamp({ type: 'answered', levelId: pileup.id, answer: 'paint', correct: true }, 3000),
    stamp({ type: 'completed', levelId: pileup.id }, 3000),
    stamp({ type: 'ran', levelId: upgrade.id, choices: { tool: 'paint' }, shipped: 120, met: true, stars: 1 }, 4000),
    stamp({ type: 'completed', levelId: upgrade.id }, 4000),
    stamp({ type: 'predicted', levelId: dice.id, option: 'same', correct: false }, 5000),
    stamp({ type: 'completed', levelId: dice.id }, 5000),
  ]

  it('is each answer, prediction, and run, but not opening or finishing a level', () => {
    expect(history.map(toClassEvent).filter(Boolean).map((event) => event!.type)).toEqual(['answered', 'answered', 'ran', 'predicted'])
    expect(toClassEvent(history[4])).toEqual({ type: 'ran', levelId: upgrade.id, at: 4000, choices: { tool: 'paint' }, shipped: 120, met: true, stars: 1 })
    expect(toClassEvent({ ...history[1], at: 'not a time' })).toBeNull()
  })

  it('starts from when the student joined, and keys each result the same way every time', () => {
    const sent = eventsSince(history, 3000)
    expect(Object.keys(sent)).toEqual(['3000_answered', '4000_ran', '5000_predicted'])
    expect(eventsSince(history, 3000)).toEqual(sent)
    expect(eventKey(sent['4000_ran'])).toBe('4000_ran')
  })

  it('sums up every finished level with its best stars', () => {
    expect(progressSummary(history)).toEqual({ [pileup.id]: 0, [upgrade.id]: 1, [dice.id]: 0 })
    expect(progressSummary([])).toEqual({})
  })
})

const answered = (levelId: string, answer: string, correct: boolean, at: number): ClassEvent => ({ type: 'answered', levelId, at, answer, correct })
const predicted = (levelId: string, option: string, correct: boolean, at: number): ClassEvent => ({ type: 'predicted', levelId, at, option, correct })
const ran = (levelId: string, choices: Record<string, string>, stars: number, at: number): ClassEvent => ({
  type: 'ran',
  levelId,
  at,
  choices,
  shipped: 100,
  met: stars > 0,
  stars,
})

function player(id: string, name: string, joinedAt: number, more: Partial<ClassPlayer> = {}): ClassPlayer {
  return { id, name, joinedAt, online: true, now: null, progress: {}, events: [], ...more }
}

function room(players: ClassPlayer[], focus: string | null = null): ClassRoom {
  return { code: '482915', host: 'teacher', createdAt: 0, meta: { since: 0, focus, focusAt: focus ? 10 : 0 }, players }
}

describe('reading a class from the database', () => {
  it('orders students by when they joined and their results by time', () => {
    const read = readRoom('482915', {
      host: 'teacher',
      createdAt: 5,
      meta: { since: 5, focus: pileup.id, focusAt: 9 },
      players: {
        zed: { name: 'Zed', joinedAt: 20, online: false },
        amy: {
          name: 'Amy',
          joinedAt: 10,
          online: true,
          now: pileup.id,
          progress: { [upgrade.id]: 1 },
          events: { '30_answered': answered(pileup.id, 'paint', true, 30), '25_answered': answered(pileup.id, 'cut', false, 25) },
        },
      },
    })
    expect(read?.players.map((p) => p.name)).toEqual(['Amy', 'Zed'])
    expect(read?.players[0].events.map((e) => e.at)).toEqual([25, 30])
    expect(read?.players[0]).toMatchObject({ online: true, now: pileup.id, progress: { [upgrade.id]: 1 } })
    expect(read?.players[1]).toMatchObject({ online: false, now: null, progress: {}, events: [] })
    expect(read?.meta).toEqual({ since: 5, focus: pileup.id, focusAt: 9 })
  })

  it('drops anything malformed instead of showing it', () => {
    const read = readRoom('482915', {
      host: 'teacher',
      players: {
        amy: {
          name: 'Amy',
          joinedAt: 10,
          progress: { [upgrade.id]: 1, broken: 'lots' },
          events: { a: { type: 'answered', levelId: pileup.id, at: 1 }, b: { type: 'hacked', levelId: pileup.id, at: 2 }, c: 'nonsense' },
        },
        nameless: { joinedAt: 10 },
        junk: 7,
      },
    })
    expect(read?.players).toEqual([player('amy', 'Amy', 10, { online: false, progress: { [upgrade.id]: 1 } })])
    expect(read?.meta).toEqual({ since: 0, focus: null, focusAt: 0 })
    expect(readRoom('482915', null)).toBeNull()
    expect(readRoom('482915', { players: {} })).toBeNull()
  })
})

describe("the instructor's board", () => {
  const amy = player('amy', 'Amy', 1, { now: upgrade.id, progress: { [pileup.id]: 0 }, events: [answered(pileup.id, 'paint', true, 5)] })
  const ben = player('ben', 'Ben', 2, { online: false, events: [answered(pileup.id, 'cut', false, 6)] })
  const cleo = player('cleo', 'Cleo', 3)

  it('shows names, or numbers in the order students joined', () => {
    expect([...studentLabels(room([amy, ben, cleo]), true).values()]).toEqual(['Amy', 'Ben', 'Cleo'])
    expect([...studentLabels(room([amy, ben, cleo]), false).values()]).toEqual(['Student 1', 'Student 2', 'Student 3'])
  })

  it("marks what each student finished, tried, and has open, with totals", () => {
    const [a, b, c] = progressBoard(room([amy, ben, cleo]), levels, true)
    expect(a).toMatchObject({ label: 'Amy', online: true, done: 1, stars: 0 })
    expect(a.now?.id).toBe(upgrade.id)
    expect(a.cells.get(pileup.id)).toEqual({ done: true, stars: 0, tried: false, here: false })
    expect(a.cells.get(upgrade.id)).toEqual({ done: false, stars: 0, tried: false, here: true })
    expect(b).toMatchObject({ label: 'Ben', online: false, done: 0, now: null })
    expect(b.cells.get(pileup.id)).toEqual({ done: false, stars: 0, tried: true, here: false })
    expect(c.done).toBe(0)
  })

  it('counts stars only for levels the game still has', () => {
    const [row] = progressBoard(room([player('dee', 'Dee', 1, { progress: { [upgrade.id]: 1, 'retired-level': 3 } })]), levels, true)
    expect(row).toMatchObject({ done: 1, stars: 1 })
  })

  it('gives columns to the tiers the class has reached, and the one it was sent to', () => {
    expect(boardTiers(room([]), levels)).toEqual([0])
    expect(boardTiers(room([amy, ben, cleo]), levels)).toEqual([0, 1])
    expect(boardTiers(room([cleo], dice.id), levels)).toEqual([2])
  })
})

describe('answers on a level with a right answer', () => {
  it("tallies each student's first answer and counts the tries it took to get it right", () => {
    const students = [
      player('amy', 'Amy', 1, { now: pileup.id, events: [answered(pileup.id, 'cut', false, 5), answered(pileup.id, 'paint', true, 6)] }),
      player('ben', 'Ben', 2, { events: [answered(pileup.id, 'paint', true, 7)] }),
      player('cleo', 'Cleo', 3, { events: [answered(pileup.id, 'oven', false, 7), answered(pileup.id, 'box', false, 8), answered(upgrade.id, 'nonsense', false, 9)] }),
      player('dee', 'Dee', 4),
    ]
    const answers = levelAnswers(pileup, room(students), true)
    expect(answers).toMatchObject({ kind: 'pick', answered: 3, total: 4, here: 1 })
    if (answers.kind !== 'pick') throw new Error('expected picks')
    expect(answers.choices).toEqual([
      { id: 'cut', label: 'Cut', count: 1, right: false },
      { id: 'paint', label: 'Paint', count: 1, right: true },
      { id: 'assemble', label: 'Assemble', count: 0, right: false },
      { id: 'box', label: 'Box', count: 1, right: false },
    ])
    expect(answers.picks).toEqual([
      { id: 'amy', label: 'Amy', first: 'cut', tries: 2, solved: true },
      { id: 'ben', label: 'Ben', first: 'paint', tries: 1, solved: true },
      { id: 'cleo', label: 'Cleo', first: 'box', tries: 1, solved: false },
    ])
  })

  it('reads predictions the same way, with names hidden', () => {
    const students = [player('amy', 'Amy', 1, { events: [predicted(dice.id, 'fewer', true, 5)] }), player('ben', 'Ben', 2, { events: [predicted(dice.id, 'same', false, 6)] })]
    const answers = levelAnswers(dice, room(students), false)
    if (answers.kind !== 'pick') throw new Error('expected picks')
    expect(answers.choices.map((c) => [c.id, c.count, c.right])).toEqual([
      ['more', 0, false],
      ['same', 1, false],
      ['fewer', 1, true],
    ])
    expect(answers.picks.map((p) => p.label)).toEqual(['Student 1', 'Student 2'])
  })
})

describe('answers on a planning level', () => {
  it('lists each plan the class ran once, best first, with who ran it', () => {
    const students = [
      player('amy', 'Amy', 1, { events: [ran(upgrade.id, { tool: 'cut' }, 0, 5), ran(upgrade.id, { tool: 'paint' }, 1, 6)] }),
      player('ben', 'Ben', 2, { events: [ran(upgrade.id, { tool: 'cut' }, 0, 7), ran(upgrade.id, { tool: 'cut' }, 0, 8)] }),
      player('cleo', 'Cleo', 3, { events: [ran(upgrade.id, { tool: 'oven' }, 1, 9)] }),
    ]
    const answers = levelAnswers(upgrade, room(students), true)
    expect(answers).toMatchObject({ kind: 'plans', answered: 3, total: 3, here: 0 })
    if (answers.kind !== 'plans') throw new Error('expected plans')
    expect(answers.plans).toEqual([
      { plan: { tool: 'paint' }, tries: 1, stars: 1, met: true, students: ['Amy'] },
      { plan: { tool: 'cut' }, tries: 3, stars: 0, met: false, students: ['Amy', 'Ben'] },
    ])
  })
})
