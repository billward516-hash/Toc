import { describe, expect, it } from 'vitest'
import type { FactoryModel } from '../engine/model.ts'
import { feedbackFor, levelState, validateLevels } from './graph.ts'
import type { Level } from './types.ts'

const model: FactoryModel = {
  stations: [
    { id: 'cut', name: 'Cut', cycleTime: { kind: 'fixed', value: 2 } },
    { id: 'paint', name: 'Paint', cycleTime: { kind: 'fixed', value: 5 } },
  ],
  release: { kind: 'saturate' },
  horizon: 60,
}

const level = (id: string, requires: string[] = [], overrides: Partial<Level> = {}): Level => ({
  id,
  tier: 0,
  title: id,
  principles: [1],
  requires,
  briefing: '',
  model,
  seed: 1,
  goal: { kind: 'identifyBottleneck', answer: 'paint', prompt: 'Which station?', watchMinutes: 0 },
  popups: [
    { trigger: { kind: 'answered', correct: true }, title: 'Yes', body: '' },
    { trigger: { kind: 'answered', correct: false, station: 'cut' }, title: 'Cut is waiting', body: '' },
    { trigger: { kind: 'answered', correct: false }, title: 'Not quite', body: '' },
  ],
  ...overrides,
})

describe('levelState', () => {
  const a = level('a')
  const b = level('b', ['a'])
  const c = level('c', ['a', 'b'])

  it('unlocks a level only when all its prerequisites are complete', () => {
    const states = (done: string[]) => [a, b, c].map((l) => levelState(l, new Set(done)))
    expect(states([])).toEqual(['unlocked', 'locked', 'locked'])
    expect(states(['a'])).toEqual(['completed', 'unlocked', 'locked'])
    expect(states(['a', 'b'])).toEqual(['completed', 'completed', 'unlocked'])
  })
})

describe('feedbackFor', () => {
  const l = level('a')

  it('explains a correct answer', () => {
    expect(feedbackFor(l, 'paint')?.title).toBe('Yes')
  })

  it('prefers feedback written for the station the learner picked', () => {
    expect(feedbackFor(l, 'cut')?.title).toBe('Cut is waiting')
  })

  it('falls back to general feedback', () => {
    const noSpecific = level('a', [], { popups: l.popups.filter((p) => p.title !== 'Cut is waiting') })
    expect(feedbackFor(noSpecific, 'cut')?.title).toBe('Not quite')
  })
})

describe('validateLevels', () => {
  it('accepts a well-formed set', () => {
    expect(validateLevels([level('a'), level('b', ['a'])])).toEqual([])
  })

  it('catches duplicates and unknown prerequisites', () => {
    const problems = validateLevels([level('a'), level('a'), level('d', ['ghost'])])
    expect(problems).toEqual(['duplicate level id "a"', 'level "d" requires unknown level "ghost"'])
  })

  it('catches prerequisite cycles', () => {
    const problems = validateLevels([level('a', ['c']), level('b', ['a']), level('c', ['b'])])
    expect(problems).toEqual(['prerequisite cycle: a -> c -> b -> a'])
  })

  it('catches answers and popups that point at missing stations', () => {
    const problems = validateLevels([
      level('a', [], {
        goal: { kind: 'identifyBottleneck', answer: 'glue', prompt: 'Which station?', watchMinutes: 0 },
        popups: [{ trigger: { kind: 'answered', correct: false, station: 'glue' }, title: '', body: '' }],
      }),
    ])
    expect(problems).toEqual([
      'level "a": answer "glue" is not a station',
      'level "a": popup for unknown station "glue"',
      'level "a": no popup for a correct answer',
      'level "a": no fallback popup for a wrong answer',
    ])
  })
})
