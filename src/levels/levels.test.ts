import { describe, expect, it } from 'vitest'
import { mean } from '../engine/distributions.ts'
import { capacity } from '../engine/model.ts'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { bufferScore, feedbackForPrediction, feedbackForRun, flowHolds, goalMet, starsFor, validateLevels } from './graph.ts'
import { allPlans, applyLevers, overBudget, planCost, steadyTwin } from './levers.ts'
import { goalValues } from './values.ts'
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

describe.each(levels.filter((l) => l.goal.kind === 'output' || l.goal.kind === 'steady'))('plan level $id', (level) => {
  const { goal, model, levers } = level
  const intended = (plan: Choices) =>
    level.popups.some(
      (p) => p.trigger.kind === 'ran' && p.trigger.met && Object.entries(p.trigger.choices ?? {}).every(([k, v]) => plan[k] === v),
    )
  const run = (plan: Choices, seed: number) => simulate(applyLevers(model, levers, plan), seed)
  const plans = allPlans(levers)
  // Output levels must work on any day. Steady levels are about variation itself, so only the
  // level's own day is exact, and the intended plan must hold on nearly every other day.
  const exact = goal.kind === 'output'

  it('misses the goal before any changes', () => {
    for (const seed of exact ? seeds(level, 20) : [level.seed]) {
      expect(goalMet(goal, simulate(model, seed)), `seed ${seed}`).toBe(false)
    }
  })

  it('meets the goal on its own day with the intended plan and only that plan', () => {
    expect(plans.some(intended)).toBe(true)
    for (const plan of plans) expect(goalMet(goal, run(plan, level.seed)), JSON.stringify(plan)).toBe(intended(plan))
  })

  it('keeps the intended plan working on other days', () => {
    for (const plan of plans.filter(intended)) {
      const wins = Array.from({ length: 100 }, (_, i) => i + 1).filter((seed) => goalMet(goal, run(plan, seed))).length
      expect(wins).toBeGreaterThanOrEqual(exact ? 100 : 95)
    }
  })

  it.runIf(exact)('never lets another plan meet the goal, whatever the day', () => {
    for (const plan of plans.filter((p) => !intended(p))) {
      for (const seed of seeds(level, 20)) expect(goalMet(goal, run(plan, seed)), `${JSON.stringify(plan)} seed ${seed}`).toBe(false)
    }
  })

  it.runIf(exact)('grows the biggest pile in front of the constraint for every plan, so reading the factory still works', () => {
    for (const plan of [{}, ...plans]) {
      const planModel = applyLevers(model, levers, plan)
      const capacities = planModel.stations.map((s) => capacity(s, planModel.horizon))
      const constraint = capacities.indexOf(Math.min(...capacities))
      for (const seed of seeds(level, 20)) {
        const piles = snapshotAt(simulate(planModel, seed), planModel.horizon).queues
        const where = `${JSON.stringify(plan)} seed ${seed}`
        // When the first station is the constraint, nothing should pile up anywhere.
        if (constraint === 0) expect(Math.max(...piles), where).toBeLessThanOrEqual(5)
        else expect(piles.indexOf(Math.max(...piles)), where).toBe(constraint)
      }
    }
  })

  it('has feedback for every plan, with every number filled in', () => {
    const baseline = simulate(model, level.seed)
    expect(fillTemplate(level.briefing, model, snapshotAt(baseline, 0), goalValues(goal, baseline))).not.toMatch(/[{}]/)
    for (const plan of plans) {
      const result = run(plan, level.seed)
      const popup = feedbackForRun(level, goalMet(goal, result), plan)
      expect(popup, JSON.stringify(plan)).toBeDefined()
      const text = fillTemplate(popup!.body, model, snapshotAt(result, result.horizon), goalValues(goal, baseline, result))
      expect(text).not.toMatch(/[{}]/)
    }
  })
})

// Buffer and flow levels grade the level's own day for the first two stars and fresh days for the
// third, so the lesson must hold on nearly every day, not just the one the player watches.
describe.each(levels.filter((l) => l.goal.kind === 'buffer' || l.goal.kind === 'flow'))('$goal.kind level $id', (level) => {
  const { goal, model, levers } = level
  const days = Array.from({ length: 100 }, (_, i) => i + 1)
  const run = (plan: Choices, seed: number) => simulate(applyLevers(model, levers, plan), seed)
  const plans = allPlans(levers)
  const bothBars = (result: SimResult) =>
    goal.kind === 'buffer' ? bufferScore(goal, result).both : goal.kind === 'flow' ? flowHolds(goal, result) : false
  const twoStars = (plan: Choices, seed: number) => bothBars(run(plan, seed))
  const best = plans.filter((plan) => twoStars(plan, level.seed))

  it('misses the first star before any changes, on its own day and nearly every other', () => {
    expect(goalMet(goal, simulate(model, level.seed))).toBe(false)
    expect(days.filter((seed) => goalMet(goal, simulate(model, seed))).length).toBeLessThanOrEqual(5)
  })

  it('gives exactly one plan two stars on its own day', () => {
    expect(best).toHaveLength(1)
  })

  it('keeps that plan clearing both bars on nearly every other day, so the third star is fair', () => {
    expect(days.filter((seed) => twoStars(best[0], seed)).length).toBeGreaterThanOrEqual(99)
  })

  it('keeps every other plan from two stars, and plans that miss the first star from it, on nearly every day', () => {
    for (const plan of plans.filter((p) => p !== best[0])) {
      const where = JSON.stringify(plan)
      expect(days.filter((seed) => twoStars(plan, seed)).length, where).toBeLessThanOrEqual(5)
      if (!goalMet(goal, run(plan, level.seed))) {
        expect(days.filter((seed) => goalMet(goal, run(plan, seed))).length, where).toBeLessThanOrEqual(5)
      }
    }
  })

  it('fires every pop-up written for a plan when that plan runs', () => {
    for (const { trigger, title } of level.popups) {
      if (trigger.kind !== 'ran' || !trigger.choices) continue
      for (const plan of plans.filter((p) => Object.entries(trigger.choices!).every(([k, v]) => p[k] === v))) {
        expect(goalMet(goal, run(plan, level.seed)), `${title}: ${JSON.stringify(plan)}`).toBe(trigger.met)
      }
    }
  })

  it('has feedback for every plan, with every number filled in', () => {
    const baseline = simulate(model, level.seed)
    const values = (result = baseline) => goalValues(goal, baseline, result)
    expect(fillTemplate(level.briefing, model, snapshotAt(baseline, 0), values())).not.toMatch(/[{}]/)
    if ('prompt' in goal) expect(fillTemplate(goal.prompt, model, snapshotAt(baseline, 0), values())).not.toMatch(/[{}]/)
    for (const plan of plans) {
      const result = run(plan, level.seed)
      const popup = feedbackForRun(level, goalMet(goal, result), plan)
      expect(popup, JSON.stringify(plan)).toBeDefined()
      expect(fillTemplate(popup!.body, model, snapshotAt(result, result.horizon), values(result))).not.toMatch(/[{}]/)
    }
  })
})

// Elevate and profit levels judge every star across the level's own day and fresh days, so each plan
// is scored over 30 stand-in weeks of fresh days, and the lesson must come out the same in every one.
describe.each(levels.filter((l) => l.goal.kind === 'elevate' || l.goal.kind === 'profit'))('$goal.kind level $id', (level) => {
  if (level.goal.kind !== 'elevate' && level.goal.kind !== 'profit') return
  const { goal, model, levers } = level
  // A plan over the level's budget can't run.
  const plans = allPlans(levers).filter((plan) => overBudget(levers, plan, goal.kind === 'elevate' ? goal.budget : undefined) === 0)
  const run = (plan: Choices, seed: number) => simulate(applyLevers(model, levers, plan), seed)
  const baseline = simulate(model, level.seed)
  const weeks = Array.from({ length: 30 }, (_, w) => Array.from({ length: goal.freshDays }, (_, d) => 1000 + w * goal.freshDays + d))
  const starsIn = (plan: Choices, week: number[]) =>
    starsFor(
      goal,
      run(plan, level.seed),
      week.map((seed) => run(plan, seed)),
      { spend: planCost(levers, plan), baseline: baseline.output },
    )
  const record = new Map(plans.map((plan) => [plan, weeks.map((week) => starsIn(plan, week))]))

  it('earns no star before any changes', () => {
    for (const week of weeks) {
      const fresh = week.map((seed) => simulate(model, seed))
      expect(starsFor(goal, baseline, fresh, { spend: 0, baseline: baseline.output })).toBe(0)
    }
  })

  it('gives exactly one plan three stars, and it earns them every week', () => {
    const best = plans.filter((plan) => record.get(plan)!.every((stars) => stars === 3))
    expect(best).toHaveLength(1)
    for (const plan of plans.filter((p) => p !== best[0])) {
      expect(Math.max(...record.get(plan)!), JSON.stringify(plan)).toBeLessThan(3)
    }
  })

  it('gives every plan the same stars every week, and fires the pop-ups written for it', () => {
    for (const plan of plans) {
      const stars = record.get(plan)!
      expect(new Set(stars).size, JSON.stringify(plan)).toBe(1)
    }
    for (const { trigger, title } of level.popups) {
      if (trigger.kind !== 'ran' || !trigger.choices) continue
      for (const plan of plans.filter((p) => Object.entries(trigger.choices!).every(([k, v]) => p[k] === v))) {
        expect(record.get(plan)![0] > 0, `${title}: ${JSON.stringify(plan)}`).toBe(trigger.met)
      }
    }
  })

  it('has feedback for every plan, with every number filled in', () => {
    const values = (result = baseline) => goalValues(goal, baseline, result)
    expect(fillTemplate(level.briefing, model, snapshotAt(baseline, 0), values())).not.toMatch(/[{}]/)
    expect(fillTemplate(goal.prompt, model, snapshotAt(baseline, 0), values())).not.toMatch(/[{}]/)
    for (const plan of plans) {
      const result = run(plan, level.seed)
      const popup = feedbackForRun(level, record.get(plan)![0] > 0, plan)
      expect(popup, JSON.stringify(plan)).toBeDefined()
      expect(fillTemplate(popup!.body, model, snapshotAt(result, result.horizon), values(result))).not.toMatch(/[{}]/)
    }
  })
})

describe.each(levels.filter((l) => l.goal.kind === 'predict'))('prediction level $id', (level) => {
  if (level.goal.kind !== 'predict') return
  const { goal } = level
  const twin = simulate(steadyTwin(level.model), level.seed)
  const real = simulate(level.model, level.seed)

  it('has feedback for every option, with every number filled in', () => {
    const values = goalValues(goal, twin, real)
    for (const option of goal.options) {
      expect(fillTemplate(option.label, level.model, snapshotAt(real, 0), values)).not.toMatch(/[{}]/)
      const popup = feedbackForPrediction(level, option.id)
      expect(popup, option.id).toBeDefined()
      expect(fillTemplate(popup!.body, level.model, snapshotAt(real, real.horizon), values)).not.toMatch(/[{}]/)
    }
  })

  it.runIf(level.id === 'tier2-dice')('ships fewer than its perfect-day twin on every day, and clearly fewer on its own day', () => {
    for (let seed = 1; seed <= 100; seed++) expect(simulate(level.model, seed).output, `seed ${seed}`).toBeLessThan(twin.output)
    expect(twin.output - real.output).toBeGreaterThanOrEqual(8)
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
