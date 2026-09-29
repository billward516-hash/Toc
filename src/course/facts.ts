import { simulate, type SimResult } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { secondDays } from '../levels/graph.ts'
import { applyChange, applyLevers, steadyTwin } from '../levels/levers.ts'
import { fillTemplate } from '../levels/template.ts'
import type { Choices, Level } from '../levels/types.ts'
import { goalValues, tenths } from '../levels/values.ts'

// The script quotes the game's own numbers, written as {baseline}, {shipped}, {waiting:paint}, and
// the rest that a level's own texts use (see levels/template.ts and levels/values.ts), read from the
// level on its own day. A plan level's numbers are its untouched factory ({baseline}) and its answer
// plan's run ({shipped}, {lead}, {wip}, ...); a prediction's are its two days ({first}, {second},
// {gap}). So when a level is retuned, the script follows.
export function levelFiller(level: Level, answer?: Choices): (text: string) => string {
  const { goal, model, seed } = level
  if (goal.kind === 'predict') {
    const { compare } = goal
    const twin = simulate(compare ? model : steadyTwin(model), seed)
    const real = compare ? applyChange(model, compare.change) : model
    const seconds = secondDays(seed, compare).map((day) => simulate(real, day))
    const values = goalValues(goal, twin, seconds[0], seconds)
    return (text) => fillTemplate(text, real, snapshotAt(seconds[0], model.horizon), values)
  }
  const baseline = simulate(model, seed)
  const planned: FactoryRun = answer ? runPlan(level, answer) : { model, result: baseline }
  // Every level can quote the lead time and the work on the floor, whatever its goal.
  const common = {
    baseline: baseline.output,
    best: planned.result.output,
    gain: planned.result.output - baseline.output,
    lead: Math.round(planned.result.avgLeadTime ?? 0),
    leadBefore: Math.round(baseline.avgLeadTime ?? 0),
    wip: tenths(planned.result.avgWip),
    wipBefore: tenths(baseline.avgWip),
  }
  const values = { ...common, ...goalValues(goal, baseline, planned.result) }
  return (text) => fillTemplate(text, planned.model, snapshotAt(planned.result, model.horizon), values)
}

interface FactoryRun {
  model: Level['model']
  result: SimResult
}

function runPlan(level: Level, plan: Choices): FactoryRun {
  const model = applyLevers(level.model, level.levers, plan)
  return { model, result: simulate(model, level.seed) }
}
