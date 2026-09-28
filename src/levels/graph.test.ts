import { describe, expect, it } from 'vitest'
import type { FactoryModel } from '../engine/model.ts'
import { simulate } from '../engine/simulate.ts'
import { bufferScore, feedbackFor, feedbackForRun, levelState, maxStars, starsFor, validateLevels } from './graph.ts'
import type { Goal, Level } from './types.ts'

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
  levers: [],
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

const planLevel = (overrides: Partial<Level> = {}): Level =>
  level('plan', [], {
    goal: { kind: 'output', target: 20, prompt: 'Where does the tool go?' },
    levers: [
      { id: 'tool', kind: 'upgrade', label: 'Tool', stations: ['cut', 'paint'], factor: 0.75 },
      { id: 'floater', kind: 'coverBreak', label: 'Floater', stations: ['cut', 'paint'] },
    ],
    popups: [
      { trigger: { kind: 'ran', met: true }, title: 'Met', body: '' },
      { trigger: { kind: 'ran', met: false, choices: { tool: 'cut' } }, title: 'Tool at cut', body: '' },
      { trigger: { kind: 'ran', met: false, choices: { tool: 'cut', floater: 'cut' } }, title: 'All at cut', body: '' },
      { trigger: { kind: 'ran', met: false }, title: 'Missed', body: '' },
    ],
    ...overrides,
  })

describe('feedbackForRun', () => {
  const l = planLevel()

  it('picks the pop-up written for the most specific matching plan', () => {
    expect(feedbackForRun(l, false, { tool: 'cut', floater: 'cut' })?.title).toBe('All at cut')
    expect(feedbackForRun(l, false, { tool: 'cut', floater: 'paint' })?.title).toBe('Tool at cut')
    expect(feedbackForRun(l, false, { tool: 'paint', floater: 'cut' })?.title).toBe('Missed')
    expect(feedbackForRun(l, true, { tool: 'paint', floater: 'paint' })?.title).toBe('Met')
  })
})

const bufferGoal = (changes: Partial<Extract<Goal, { kind: 'buffer' }>> = {}): Extract<Goal, { kind: 'buffer' }> => ({
  kind: 'buffer',
  drum: 'paint',
  low: 0,
  high: 100,
  minHealthy: 0.9,
  maxAvgWip: 100,
  freshDays: 2,
  prompt: 'How long a rope?',
  ...changes,
})

describe('maxStars', () => {
  it('awards no stars for spotting the constraint, one for an output target, and three for a buffer', () => {
    expect(maxStars(level('a'))).toBe(0)
    expect(maxStars(planLevel())).toBe(1)
    expect(maxStars(planLevel({ goal: bufferGoal() }))).toBe(3)
  })
})

describe('buffer stars', () => {
  // Cut feeds Paint every 2 minutes and Paint takes 5, so Paint's pile passes 5 at minute 20 and keeps growing.
  const flood = simulate(model, 1)
  const roped = simulate({ ...model, release: { kind: 'rope', constraint: 'paint', buffer: 3 } }, 1)

  it('measures the pile in front of the drum and the average inventory', () => {
    const score = bufferScore(bufferGoal({ low: 0, high: 5 }), flood)
    expect(score.healthy).toBeCloseTo(20 / 60, 10)
    expect(score.avgWip).toBe(flood.avgWip)
    expect(bufferScore(bufferGoal({ low: 0, high: 5 }), roped).healthy).toBe(1)
  })

  it('gives one star for a healthy buffer, two if inventory stays under the cap, three if both hold on every fresh day', () => {
    const goal = bufferGoal({ high: 5, maxAvgWip: 3 })
    expect(starsFor(goal, flood)).toBe(0)
    expect(starsFor({ ...goal, maxAvgWip: 1 }, roped)).toBe(1)
    expect(starsFor(goal, roped)).toBe(2)
    expect(starsFor(goal, roped, [roped])).toBe(2)
    expect(starsFor(goal, roped, [roped, flood])).toBe(2)
    expect(starsFor(goal, roped, [roped, roped])).toBe(3)
  })

  it('gives one star at most for other goals', () => {
    expect(starsFor({ kind: 'output', target: 5, prompt: '' }, flood, [flood, flood])).toBe(1)
    expect(starsFor({ kind: 'output', target: 50, prompt: '' }, flood)).toBe(0)
  })
})

describe('validateLevels', () => {
  it('accepts a well-formed plan level', () => {
    expect(validateLevels([planLevel()])).toEqual([])
  })

  it('catches levers and plan pop-ups that point at things that do not exist', () => {
    const problems = validateLevels([
      planLevel({
        levers: [{ id: 'tool', kind: 'upgrade', label: 'Tool', stations: ['cut', 'glue'], factor: 0.75 }],
        popups: [{ trigger: { kind: 'ran', met: false, choices: { tool: 'box', floater: 'cut' } }, title: '', body: '' }],
      }),
    ])
    expect(problems).toEqual([
      'level "plan": lever "tool" offers unknown station "glue"',
      `level "plan": popup for tool = "box", which the lever doesn't offer`,
      'level "plan": popup for unknown lever "floater"',
      'level "plan": no popup for meeting the goal',
      'level "plan": no fallback popup for missing the goal',
    ])
  })

  it('accepts well-formed rope levers and buffer goals', () => {
    const roped = planLevel({
      goal: bufferGoal(),
      levers: [
        { id: 'tie', kind: 'ropeTo', label: 'Tie', stations: ['cut', 'paint'], length: 4 },
        { id: 'length', kind: 'ropeLength', label: 'Length', lengths: [2, 6] },
      ],
      popups: [
        { trigger: { kind: 'ran', met: true, choices: { tie: 'paint', length: '6' } }, title: 'Met', body: '' },
        { trigger: { kind: 'ran', met: false }, title: 'Missed', body: '' },
      ],
    })
    expect(validateLevels([roped])).toEqual([])
  })

  it('catches broken buffer goals and rope levers', () => {
    const problems = validateLevels([
      planLevel({
        goal: bufferGoal({ drum: 'glue', low: 5, high: 2, minHealthy: 0, maxAvgWip: 0, freshDays: 0 }),
        levers: [
          { id: 'tie', kind: 'ropeTo', label: 'Tie', stations: ['cut'], length: 0 },
          { id: 'length', kind: 'ropeLength', label: 'Length', lengths: [0, 2.5] },
        ],
      }),
      { ...planLevel({ goal: bufferGoal(), levers: [{ id: 'length', kind: 'ropeLength', label: 'Length', lengths: [4] }] }), id: 'unroped' },
    ])
    expect(problems).toEqual([
      'level "plan": lever "tie" needs a positive whole length',
      'level "plan": lever "length" needs positive whole lengths',
      'level "plan": drum "glue" is not a station',
      'level "plan": a buffer goal needs 0 <= low <= high',
      'level "plan": a buffer goal needs 0 < minHealthy <= 1',
      'level "plan": a buffer goal needs a positive maxAvgWip',
      'level "plan": a buffer goal needs at least one fresh day',
      'level "plan": popup for unknown lever "tool"',
      'level "plan": popup for unknown lever "tool"',
      'level "plan": popup for unknown lever "floater"',
      `level "unroped": lever "length" sizes a rope the line doesn't have`,
      'level "unroped": popup for unknown lever "tool"',
      'level "unroped": popup for unknown lever "tool"',
      'level "unroped": popup for unknown lever "floater"',
    ])
  })

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
