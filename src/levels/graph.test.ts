import { describe, expect, it } from 'vitest'
import type { FactoryModel } from '../engine/model.ts'
import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import {
  bufferScore,
  feedbackFor,
  feedbackForRun,
  flowHolds,
  gainPer1000,
  levelState,
  maxStars,
  barsScore,
  profitScore,
  profitSoFar,
  readBar,
  rushOnTime,
  starsFor,
  validateLevels,
} from './graph.ts'
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

describe('flow stars', () => {
  // Paint ships 11 in the hour; the first robot takes 7 minutes and each one after waits longer.
  const day = simulate(model, 1)
  const goal: Extract<Goal, { kind: 'flow' }> = { kind: 'flow', target: 11, maxLeadTime: 1000, freshDays: 2, prompt: 'Lots?' }

  it('needs the target for one star, a short enough lead time for two, and both on every fresh day for three', () => {
    expect(starsFor(goal, day, [day, day])).toBe(3)
    expect(starsFor(goal, day, [day])).toBe(2)
    expect(starsFor({ ...goal, maxLeadTime: 5 }, day, [day, day])).toBe(1)
    expect(starsFor({ ...goal, target: 12 }, day, [day, day])).toBe(0)
    expect(flowHolds(goal, day)).toBe(true)
    expect(maxStars(planLevel({ goal }))).toBe(3)
  })
})

describe('elevate stars', () => {
  // Paint ships one robot every 5 minutes: 11 in the hour, and its pile passes 5 at minute 20.
  const day = simulate(model, 1)
  const goal: Extract<Goal, { kind: 'elevate' }> = {
    kind: 'elevate',
    target: 11,
    pileLimit: 100,
    minSteady: 0.9,
    minGainPer1000: 2,
    freshDays: 2,
    prompt: 'What will you change?',
  }
  const free = { spend: 0, baseline: 5 }

  it('needs the target on every day for one star, steady days for two, and money well spent for three', () => {
    expect(starsFor(goal, day, [day, day], free)).toBe(3)
    expect(starsFor(goal, day, [day], free)).toBe(0)
    expect(starsFor({ ...goal, target: 12 }, day, [day, day], free)).toBe(0)
    expect(starsFor({ ...goal, pileLimit: 5 }, day, [day, day], free)).toBe(1)
    expect(starsFor(goal, day, [day, day], { spend: 3000, baseline: 5 })).toBe(3)
    expect(starsFor(goal, day, [day, day], { spend: 4000, baseline: 5 })).toBe(2)
  })

  it('counts output gained per $1,000, and a free plan as always worth it', () => {
    expect(gainPer1000(day, { spend: 3000, baseline: 5 })).toBe(2)
    expect(gainPer1000(day, free)).toBe(Infinity)
  })
})

describe('profit stars', () => {
  // A widget ($10, $4 of materials) then a gadget ($3, $1) comes in every 10 minutes, and Paint takes
  // 5: six ship in the hour, and the seventh comes in as the shift ends.
  const shop: FactoryModel = {
    products: [
      { id: 'widget', name: 'Widget' },
      { id: 'gadget', name: 'Gadget' },
    ],
    mix: ['widget', 'gadget'],
    stations: [{ id: 'paint', name: 'Paint', cycleTime: { kind: 'fixed', value: 5 } }],
    release: { kind: 'interval', every: { kind: 'fixed', value: 10 } },
    horizon: 60,
  }
  const day = simulate(shop, 1)
  const goal: Extract<Goal, { kind: 'profit' }> = {
    kind: 'profit',
    economics: { widget: { price: 10, materials: 4 }, gadget: { price: 3, materials: 1 } },
    expense: 20,
    target: 4,
    minShipped: 6,
    maxInventory: 1.25,
    freshDays: 2,
    prompt: 'What first?',
  }

  it('earns throughput only for what ships, and values inventory at material cost while it is on the floor', () => {
    // Three widgets at $6 and three gadgets at $2; each spends 5 of the 60 minutes on the floor.
    expect(profitScore(goal, day)).toEqual({ throughput: 24, profit: 4, shipped: 6, inventory: (3 * 4 * 5 + 3 * 1 * 5) / 60 })
  })

  it('keeps a live tally that ends at the day\'s score', () => {
    // Halfway: a widget, a gadget, and a widget shipped, a gadget on the floor, and half the expense spent.
    expect(profitSoFar(goal, day, snapshotAt(day, 30))).toEqual({ throughput: 14, profit: 4, inventory: 1, expense: 10 })
    // At the end, the widget that just came in is all that's left on the floor.
    const end = profitSoFar(goal, day, snapshotAt(day, 60))
    expect(end).toEqual({ throughput: 24, profit: profitScore(goal, day).profit, inventory: 4, expense: 20 })
  })

  it('needs the profit on every day for one star, enough shipped for two, and little inventory for three', () => {
    expect(starsFor(goal, day, [day, day])).toBe(3)
    expect(starsFor(goal, day, [day])).toBe(0)
    expect(starsFor({ ...goal, target: 5 }, day, [day, day])).toBe(0)
    expect(starsFor({ ...goal, minShipped: 7 }, day, [day, day])).toBe(1)
    expect(starsFor({ ...goal, maxInventory: 1.2 }, day, [day, day])).toBe(2)
    expect(maxStars(planLevel({ goal }))).toBe(3)
  })
})

describe('bars stars', () => {
  // Paint ships one robot every 5 minutes after the first at 7: 11 in the hour.
  const day = simulate(model, 1)
  const goal: Extract<Goal, { kind: 'bars' }> = {
    kind: 'bars',
    bars: [
      { metric: 'shipped', min: 11 },
      { metric: 'wip', max: 100 },
      { metric: 'spend', max: 1000 },
    ],
    freshDays: 2,
    prompt: 'What will you change?',
  }

  it('needs the next bar met on every day for each star', () => {
    expect(starsFor(goal, day, [day, day], { spend: 500, baseline: 0 })).toBe(3)
    expect(starsFor(goal, day, [day, day], { spend: 2000, baseline: 0 })).toBe(2)
    expect(starsFor({ ...goal, bars: [goal.bars[0], { metric: 'wip', max: 1 }, goal.bars[2]] }, day, [day, day])).toBe(1)
    expect(starsFor({ ...goal, bars: [{ metric: 'shipped', min: 12 }, ...goal.bars.slice(1)] }, day, [day, day])).toBe(0)
    expect(starsFor(goal, day, [day])).toBe(0)
    expect(barsScore(goal, day, [day, day], 500).days).toHaveLength(3)
    expect(maxStars(planLevel({ goal: { ...goal, bars: goal.bars.slice(0, 2) } }))).toBe(2)
  })

  it('reads each measure off a day', () => {
    expect(readBar({ metric: 'shipped', min: 11 }, day)).toEqual({ value: 11, met: true })
    expect(readBar({ metric: 'leadTime', max: 1 }, day).met).toBe(false)
    expect(readBar({ metric: 'wip', max: 100 }, day)).toEqual({ value: day.avgWip, met: true })
    expect(readBar({ metric: 'stock', max: 0 }, day)).toEqual({ value: 0, met: true })
    expect(readBar({ metric: 'scrapped', max: 0 }, day)).toEqual({ value: 0, met: true })
    expect(readBar({ metric: 'steady', min: 0.5, pileLimit: 5 }, day).met).toBe(false)
    expect(readBar({ metric: 'spend', max: 10 }, day, 20)).toEqual({ value: 20, met: false })
  })

  it('counts rush orders shipped by their due time', () => {
    // Cut has already started a normal robot when the rush comes in; the rush robots ship at 12 and 17.
    const rushed = simulate({ ...model, rush: [{ at: 0, count: 2 }], stations: model.stations.map((s) => ({ ...s, expedite: true })) }, 1)
    expect(rushed.rush).toHaveLength(2)
    expect([6, 12, 17].map((due) => rushOnTime(rushed, due))).toEqual([0, 1, 2])
    expect(readBar({ metric: 'rushOnTime', due: 12 }, rushed).met).toBe(false)
    expect(readBar({ metric: 'rushOnTime', due: 17 }, rushed).met).toBe(true)
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

  it('catches broken profit goals and product mix levers', () => {
    const goal: Extract<Goal, { kind: 'profit' }> = {
      kind: 'profit',
      economics: { pie: { price: 5, materials: -1 } },
      expense: -1,
      target: 10,
      minShipped: 1,
      maxInventory: 0,
      freshDays: 0,
      prompt: 'What first?',
    }
    const popups: Level['popups'] = [
      { trigger: { kind: 'ran', met: true }, title: 'Met', body: '' },
      { trigger: { kind: 'ran', met: false }, title: 'Missed', body: '' },
    ]
    const problems = validateLevels([
      planLevel({
        model: { ...model, products: [{ id: 'cake', name: 'Cake' }], mix: ['cake'] },
        goal,
        levers: [
          { id: 'first', kind: 'priority', label: 'First', station: 'oven', options: [{ id: 'pies', label: 'Pies', order: ['pie'] }] },
          { id: 'menu', kind: 'menu', label: 'Sell', options: [{ id: 'nothing', label: 'Nothing', mix: [], every: 0 }] },
        ],
        popups,
      }),
      { ...planLevel({ goal: { ...goal, economics: {}, expense: 0, maxInventory: 1, freshDays: 1 }, levers: [{ id: 'menu', kind: 'menu', label: 'Sell', options: [] }], popups }), id: 'plain' },
    ])
    expect(problems).toEqual([
      'level "plan": lever "first" orders an unknown station "oven"',
      'level "plan": lever "first" names unknown product "pie"',
      'level "plan": lever "menu" option "nothing" needs orders and a pace',
      'level "plan": no price for product "cake"',
      'level "plan": price for unknown product "pie"',
      'level "plan": "pie" needs a price and ingredient cost of at least 0',
      'level "plan": a profit goal needs an operating expense of at least 0',
      'level "plan": a profit goal needs a positive maxInventory',
      'level "plan": a profit goal needs at least one fresh day',
      'level "plain": lever "menu" needs options',
      'level "plain": a profit goal needs a line that makes products',
    ])
  })

  it('catches broken bars goals, option levers, and comparisons', () => {
    const popups: Level['popups'] = [
      { trigger: { kind: 'ran', met: true }, title: 'Met', body: '' },
      { trigger: { kind: 'ran', met: false }, title: 'Missed', body: '' },
    ]
    const problems = validateLevels([
      planLevel({
        goal: { kind: 'bars', bars: [{ metric: 'shipped', min: 0 }, { metric: 'steady', min: 2, pileLimit: 0 }, { metric: 'rushOnTime', due: 0 }], freshDays: 1.5, prompt: '' },
        levers: [
          {
            id: 'fix',
            kind: 'option',
            label: 'Fix',
            options: [
              { id: 'a', label: 'A', stations: { glue: { servers: 2 } }, price: -1 },
              { id: 'a', label: 'A again' },
            ],
          },
        ],
        popups,
      }),
      {
        ...level('demo'),
        goal: {
          kind: 'predict',
          prompt: '',
          options: [
            { id: 'x', label: 'X' },
            { id: 'y', label: 'Y' },
          ],
          answer: 'x',
          compare: { first: 'A normal day', second: 'The breakdown day', change: { stations: { glue: {} } } },
        },
        popups: [
          { trigger: { kind: 'predicted', option: 'x' }, title: 'X', body: '' },
          { trigger: { kind: 'predicted', option: 'y' }, title: 'Y', body: '' },
        ],
      },
    ])
    expect(problems).toEqual([
      'level "plan": lever "fix" repeats an option',
      'level "plan": lever "fix" option "a" changes an unknown station "glue"',
      'level "plan": lever "fix" option "a" needs a price of at least 0',
      'level "plan": a bars goal needs a whole number of fresh days',
      'level "plan": bar "shipped": needs a positive minimum',
      'level "plan": bar "steady": needs 0 < min <= 1 and pileLimit >= 1',
      'level "plan": bar "rushOnTime": needs a positive due time',
      'level "demo": the comparison changes an unknown station "glue"',
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
