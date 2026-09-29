import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { secondDays } from './graph.ts'
import { applyChange, steadyTwin } from './levers.ts'
import { fillTemplate } from './template.ts'
import type { Level } from './types.ts'
import { goalValues } from './values.ts'

// A level's question, and the wording of each answer it offers, with the numbers filled in just as
// the level shows them to the player.
export function levelWording(level: Level): { question: string; labels: Map<string, string> } {
  const { goal, model, seed } = level
  if (goal.kind === 'identifyBottleneck') {
    return { question: goal.prompt, labels: new Map(model.stations.map((station) => [station.id, station.name])) }
  }
  if (goal.kind === 'predict') {
    const { compare } = goal
    const twin = simulate(compare ? model : steadyTwin(model), seed)
    const real = compare ? applyChange(model, compare.change) : model
    const seconds = secondDays(seed, compare).map((day) => simulate(real, day))
    const values = goalValues(goal, twin, seconds[0], seconds)
    const fill = (text: string) => fillTemplate(text, real, snapshotAt(seconds[0], model.horizon), values)
    return { question: fill(goal.prompt), labels: new Map(goal.options.map((option) => [option.id, fill(option.label)])) }
  }
  const baseline = simulate(model, seed)
  return { question: fillTemplate(goal.prompt, model, snapshotAt(baseline, 0), goalValues(goal, baseline)), labels: new Map() }
}
