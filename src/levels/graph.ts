import { validateModel } from '../engine/model.ts'
import type { Level, Popup } from './types.ts'

export type LevelState = 'locked' | 'unlocked' | 'completed'

export function levelState(level: Level, completed: ReadonlySet<string>): LevelState {
  if (completed.has(level.id)) return 'completed'
  return level.requires.every((id) => completed.has(id)) ? 'unlocked' : 'locked'
}

export function feedbackFor(level: Level, answer: string): Popup | undefined {
  if (answer === level.goal.answer) {
    return level.popups.find((p) => p.trigger.correct)
  }
  return (
    level.popups.find((p) => !p.trigger.correct && p.trigger.station === answer) ??
    level.popups.find((p) => !p.trigger.correct && p.trigger.station === undefined)
  )
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
    for (const problem of validateModel(level.model)) problems.push(`${where}: ${problem}`)
    const stationIds = new Set(level.model.stations.map((s) => s.id))
    if (!stationIds.has(level.goal.answer)) problems.push(`${where}: answer "${level.goal.answer}" is not a station`)
    for (const popup of level.popups) {
      const station = popup.trigger.correct ? undefined : popup.trigger.station
      if (station !== undefined && !stationIds.has(station)) problems.push(`${where}: popup for unknown station "${station}"`)
    }
    if (!level.popups.some((p) => p.trigger.correct)) problems.push(`${where}: no popup for a correct answer`)
    if (!level.popups.some((p) => !p.trigger.correct && p.trigger.station === undefined)) {
      problems.push(`${where}: no fallback popup for a wrong answer`)
    }
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
