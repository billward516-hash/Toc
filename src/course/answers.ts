import { valueLabel } from '../levels/levers.ts'
import { levelWording } from '../levels/wording.ts'
import type { Choices, Level } from '../levels/types.ts'

// The right answer to a level, in words, for the trainer: the station, the prediction, or each
// choice of the plan that earns every star.
export function answerLines(level: Level, answer?: Choices): string[] {
  const { goal, model } = level
  if (goal.kind === 'identifyBottleneck') {
    return [`The constraint is ${model.stations.find((station) => station.id === goal.answer)?.name ?? goal.answer}.`]
  }
  if (goal.kind === 'predict') {
    const label = levelWording(level).labels.get(goal.answer) ?? goal.answer
    return [`The right prediction: ${label}`]
  }
  if (!answer) return []
  return level.levers.map((lever) => `${lever.label}: ${valueLabel(lever, answer[lever.id], model)}`)
}
