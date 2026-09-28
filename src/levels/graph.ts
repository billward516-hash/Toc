import { validateModel } from '../engine/model.ts'
import type { SimResult } from '../engine/simulate.ts'
import { steadyShare } from '../engine/timeline.ts'
import { leverValues } from './levers.ts'
import type { Choices, Goal, Level, Popup } from './types.ts'

export type LevelState = 'locked' | 'unlocked' | 'completed'

export function levelState(level: Level, completed: ReadonlySet<string>): LevelState {
  if (completed.has(level.id)) return 'completed'
  return level.requires.every((id) => completed.has(id)) ? 'unlocked' : 'locked'
}

// Tiers 1 and 2 score one metric each, so one star is the most a scored level awards.
export function maxStars(level: Level): number {
  return level.goal.kind === 'output' || level.goal.kind === 'steady' ? 1 : 0
}

export function goalMet(goal: Goal, result: SimResult): boolean {
  switch (goal.kind) {
    case 'output':
      return result.output >= goal.target
    case 'steady':
      return result.output >= goal.minShipped && steadyShare(result, goal.pileLimit) >= goal.minSteady
    default:
      return false
  }
}

export function feedbackFor(level: Level, answer: string): Popup | undefined {
  if (level.goal.kind !== 'identifyBottleneck') return undefined
  if (answer === level.goal.answer) return level.popups.find((p) => p.trigger.kind === 'answered' && p.trigger.correct)
  const wrong = (station: string | undefined) => (p: Popup) =>
    p.trigger.kind === 'answered' && !p.trigger.correct && p.trigger.station === station
  return level.popups.find(wrong(answer)) ?? level.popups.find(wrong(undefined))
}

// The most specific pop-up wins: one written for the player's exact plan beats a general one.
export function feedbackForRun(level: Level, met: boolean, choices: Choices): Popup | undefined {
  let best: Popup | undefined
  let bestSpecificity = -1
  for (const popup of level.popups) {
    const { trigger } = popup
    if (trigger.kind !== 'ran' || trigger.met !== met) continue
    const wanted = Object.entries(trigger.choices ?? {})
    if (wanted.every(([lever, value]) => choices[lever] === value) && wanted.length > bestSpecificity) {
      best = popup
      bestSpecificity = wanted.length
    }
  }
  return best
}

export function feedbackForPrediction(level: Level, option: string): Popup | undefined {
  return level.popups.find((p) => p.trigger.kind === 'predicted' && p.trigger.option === option)
}

export function validateLevels(levels: Level[]): string[] {
  const problems: string[] = []
  const byId = new Map<string, Level>()
  for (const level of levels) {
    if (byId.has(level.id)) problems.push(`duplicate level id "${level.id}"`)
    byId.set(level.id, level)
  }

  for (const level of levels) {
    const where = `level "${level.id}"`
    for (const id of level.requires) {
      if (!byId.has(id)) problems.push(`${where} requires unknown level "${id}"`)
    }
    for (const problem of [...validateModel(level.model), ...goalProblems(level)]) problems.push(`${where}: ${problem}`)
  }

  const visiting = new Set<string>()
  const done = new Set<string>()
  const visit = (id: string, path: string[]) => {
    if (done.has(id) || !byId.has(id)) return
    if (visiting.has(id)) {
      problems.push(`prerequisite cycle: ${[...path, id].join(' -> ')}`)
      return
    }
    visiting.add(id)
    for (const next of byId.get(id)!.requires) visit(next, [...path, id])
    visiting.delete(id)
    done.add(id)
  }
  for (const level of levels) visit(level.id, [])

  return problems
}

function goalProblems({ goal, levers, popups, model }: Level): string[] {
  const problems: string[] = []
  const stationIds = new Set(model.stations.map((s) => s.id))
  const leverIds = new Set<string>()
  for (const lever of levers) {
    if (leverIds.has(lever.id)) problems.push(`duplicate lever "${lever.id}"`)
    leverIds.add(lever.id)
    if (lever.kind === 'releasePace') {
      if (!lever.every.every((minutes) => minutes > 0)) problems.push(`lever "${lever.id}" needs positive intervals`)
    } else {
      for (const s of lever.stations) {
        if (!stationIds.has(s)) problems.push(`lever "${lever.id}" offers unknown station "${s}"`)
      }
    }
  }

  switch (goal.kind) {
    case 'identifyBottleneck': {
      if (!stationIds.has(goal.answer)) problems.push(`answer "${goal.answer}" is not a station`)
      for (const { trigger } of popups) {
        if (trigger.kind === 'answered' && !trigger.correct && trigger.station !== undefined && !stationIds.has(trigger.station)) {
          problems.push(`popup for unknown station "${trigger.station}"`)
        }
      }
      if (!popups.some((p) => p.trigger.kind === 'answered' && p.trigger.correct)) problems.push('no popup for a correct answer')
      if (!popups.some((p) => p.trigger.kind === 'answered' && !p.trigger.correct && p.trigger.station === undefined)) {
        problems.push('no fallback popup for a wrong answer')
      }
      break
    }
    case 'predict': {
      if (goal.options.length < 2) problems.push('a prediction needs at least two options')
      if (!goal.options.some((o) => o.id === goal.answer)) problems.push(`answer "${goal.answer}" is not an option`)
      for (const option of goal.options) {
        if (!popups.some((p) => p.trigger.kind === 'predicted' && p.trigger.option === option.id)) {
          problems.push(`no popup for prediction "${option.id}"`)
        }
      }
      break
    }
    case 'output':
    case 'steady': {
      if (goal.kind === 'steady' && !(goal.minSteady > 0 && goal.minSteady <= 1 && goal.pileLimit >= 1)) {
        problems.push('a steady goal needs 0 < minSteady <= 1 and pileLimit >= 1')
      }
      if (levers.length === 0) problems.push('a plan goal needs at least one lever')
      for (const { trigger } of popups) {
        if (trigger.kind !== 'ran') continue
        for (const [leverId, value] of Object.entries(trigger.choices ?? {})) {
          const lever = levers.find((l) => l.id === leverId)
          if (!lever) problems.push(`popup for unknown lever "${leverId}"`)
          else if (!leverValues(lever).includes(value)) problems.push(`popup for ${leverId} = "${value}", which the lever doesn't offer`)
        }
      }
      if (!popups.some((p) => p.trigger.kind === 'ran' && p.trigger.met)) problems.push('no popup for meeting the goal')
      if (!popups.some((p) => p.trigger.kind === 'ran' && !p.trigger.met && !p.trigger.choices)) {
        problems.push('no fallback popup for missing the goal')
      }
      break
    }
  }
  return problems
}
