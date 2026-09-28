import { describe, expect, it } from 'vitest'
import { mean } from '../engine/distributions.ts'
import { capacity } from '../engine/model.ts'
import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { feedbackForRun, validateLevels } from './graph.ts'
import { allPlans, applyLevers } from './levers.ts'
import { levels } from './index.ts'
import { principleNames } from './principles.ts'
import { fillTemplate } from './template.ts'
import type { Choices, Level } from './types.ts'

const seeds = (level: Level, extra: number) => [level.seed, ...Array.from({ length: extra }, (_, i) => i + 1)]

describe('level content', () => {
  it('is structurally valid', () => {
    expect(validateLevels(levels)).toEqual([])
  })

  it('names every principle it teaches', () => {
    for (const level of levels) {
      for (const p of level.principles) expect(principleNames[p], `${level.id} principle ${p}`).toBeDefined()
    }
  })

  it('makes Cut look like the star in the busy level: far more parts made than robots shipped', () => {
    const busy = levels.find((l) => l.id === 'tier0-busy')!
    for (const seed of seeds(busy, 30)) {
      const result = simulate(busy.model, seed)
      expect(result.stations[0].completed).toBeGreaterThan(2 * result.output)
    }
  })
})

describe.each(levels.filter((l) => l.goal.kind === 'identifyBottleneck'))('spot-the-constraint level $id', (level) => {
  if (level.goal.kind !== 'identifyBottleneck') return
  const { goal } = level
  const answer = level.model.stations.findIndex((s) => s.id === goal.answer)

  it('makes the answer the slowest station on average', () => {
    const pace = level.model.stations.map((s) => mean(s.cycleTime) / (s.servers ?? 1))
    expect(pace.indexOf(Math.max(...pace))).toBe(answer)
  })

  it('grows the biggest pile in front of the answer by the end of the shift, whatever the seed', () => {
    for (const seed of seeds(level, 30)) {
      const end = snapshotAt(simulate(level.model, seed), level.model.horizon)
      expect(end.queues.indexOf(Math.max(...end.queues)), `seed ${seed}`).toBe(answer)
    }
  })

  it('fills every number its pop-ups quote', () => {
    const early = snapshotAt(simulate(level.model, level.seed), goal.watchMinutes)
    for (const popup of level.popups) expect(fillTemplate(popup.body, level.model, early)).not.toMatch(/[{}]/)
  })
})

describe.each(levels.filter((l) => l.goal.kind === 'output'))('plan level $id', (level) => {
  if (level.goal.kind !== 'output') return
  const { target } = level.goal
  const intended = (plan: Choices) =>
    level.popups.some(
      (p) => p.trigger.kind === 'ran' && p.trigger.met && Object.entries(p.trigger.choices ?? {}).every(([k, v]) => plan[k] === v),
    )
  const shipped = (plan: Choices, seed: number) => simulate(applyLevers(level.model, level.levers, plan), seed).output

  it('misses the target before any changes, whatever the seed', () => {
    for (const seed of seeds(level, 20)) expect(simulate(level.model, seed).output, `seed ${seed}`).toBeLessThan(target)
  })

  it('meets the target with the intended plan and only that plan, whatever the seed', () => {
    const plans = allPlans(level.levers)
    expect(plans.some(intended)).toBe(true)
    for (const plan of plans) {
      for (const seed of seeds(level, 20)) {
        expect(shipped(plan, seed) >= target, `${JSON.stringify(plan)} seed ${seed}`).toBe(intended(plan))
      }
    }
  })

  it('grows the biggest pile in front of the constraint for every plan, so reading the factory still works', () => {
    for (const plan of [{}, ...allPlans(level.levers)]) {
      const model = applyLevers(level.model, level.levers, plan)
      const capacities = model.stations.map((s) => capacity(s, model.horizon))
      const constraint = capacities.indexOf(Math.min(...capacities))
      for (const seed of seeds(level, 20)) {
        const piles = snapshotAt(simulate(model, seed), model.horizon).queues
        const where = `${JSON.stringify(plan)} seed ${seed}`
        // When the first station is the constraint, nothing should pile up anywhere.
        if (constraint === 0) expect(Math.max(...piles), where).toBeLessThanOrEqual(5)
        else expect(piles.indexOf(Math.max(...piles)), where).toBe(constraint)
      }
    }
  })

  it('has feedback for every plan, with every number filled in', () => {
    const baseline = simulate(level.model, level.seed)
    const values = { baseline: baseline.output, target }
    expect(fillTemplate(level.briefing, level.model, snapshotAt(baseline, 0), values)).not.toMatch(/[{}]/)
    for (const plan of allPlans(level.levers)) {
      const result = simulate(applyLevers(level.model, level.levers, plan), level.seed)
      const popup = feedbackForRun(level, result.output >= target, plan)
      expect(popup, JSON.stringify(plan)).toBeDefined()
      expect(fillTemplate(popup!.body, level.model, snapshotAt(result, result.horizon), values)).not.toMatch(/[{}]/)
    }
  })
})

describe('fillTemplate', () => {
  const level = levels[0]
  const snap = snapshotAt(simulate(level.model, level.seed), 100)

  it('quotes the run and named values', () => {
    const paint = level.model.stations.findIndex((s) => s.id === 'paint')
    expect(fillTemplate('{shipped}/{target}: {made:cut} cut, {waiting:paint} waiting', level.model, snap, { target: 140 })).toBe(
      `${snap.shipped}/140: ${snap.completed[0]} cut, ${snap.queues[paint]} waiting`,
    )
  })

  it('leaves unknown names visible so content tests catch them', () => {
    expect(fillTemplate('{made:glue} {nope}', level.model, snap)).toBe('{made:glue} {nope}')
  })
})
