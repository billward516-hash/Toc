import { planKey, plansTried, type PlanTried } from '../levels/plans.ts'
import type { Level } from '../levels/types.ts'
import { asStored } from './events.ts'
import type { ClassEvent, ClassRoom } from './room.ts'

// What the instructor's screen shows, worked out from the class as it stands.

// How each student appears on the TV: by nickname, or with names hidden, by a number in the order
// they joined.
export function studentLabels(room: ClassRoom, showNames: boolean): Map<string, string> {
  return new Map(room.players.map((player, i) => [player.id, showNames ? player.name : `Student ${i + 1}`]))
}

// One student and one level on the progress board.
export interface Cell {
  // Finished on the student's device, before the class or during it.
  done: boolean
  stars: number
  // Tried during the class, not finished yet.
  tried: boolean
  // Open on the student's screen right now.
  here: boolean
}

export interface BoardRow {
  id: string
  label: string
  online: boolean
  now: Level | null
  done: number
  stars: number
  cells: Map<string, Cell>
}

export function progressBoard(room: ClassRoom, levels: readonly Level[], showNames: boolean): BoardRow[] {
  const labels = studentLabels(room, showNames)
  return room.players.map((player) => {
    const tried = new Set(player.events.map((event) => event.levelId))
    const finished = levels.filter((level) => Object.hasOwn(player.progress, level.id))
    const cells = new Map<string, Cell>(
      levels.map((level) => {
        const done = Object.hasOwn(player.progress, level.id)
        return [level.id, { done, stars: done ? player.progress[level.id] : 0, tried: !done && tried.has(level.id), here: player.now === level.id }]
      }),
    )
    return {
      id: player.id,
      label: labels.get(player.id) ?? player.name,
      online: player.online,
      now: levels.find((level) => level.id === player.now) ?? null,
      done: finished.length,
      stars: finished.reduce((sum, level) => sum + player.progress[level.id], 0),
      cells,
    }
  })
}

// The tiers worth columns on the board: every tier anyone in the class has finished, tried, or has
// open, and the tier of the level the class was sent to. Before anything happens, the first tier.
export function boardTiers(room: ClassRoom, levels: readonly Level[]): number[] {
  const tierOf = new Map(levels.map((level) => [level.id, level.tier]))
  const tiers = new Set<number>()
  const add = (levelId: string | null) => {
    const tier = levelId === null ? undefined : tierOf.get(levelId)
    if (tier !== undefined) tiers.add(tier)
  }
  for (const player of room.players) {
    Object.keys(player.progress).forEach(add)
    add(player.now)
    for (const event of player.events) add(event.levelId)
  }
  add(room.meta.focus)
  if (tiers.size === 0 && levels.length > 0) tiers.add(levels[0].tier)
  return [...tiers].sort((a, b) => a - b)
}

// How many students first picked one answer, and whether it's the right one.
export interface Tally {
  id: string
  label: string
  count: number
  right: boolean
}

// One student's answers on a level with a right answer: the first one they gave, how many it took to
// get it right (or how many they gave, if they haven't), and whether they got there.
export interface Pick {
  id: string
  label: string
  first: string
  tries: number
  solved: boolean
}

// A plan someone in the class ran, with who ran it. `tries` counts every run of it across the class.
export interface ClassPlan extends PlanTried {
  students: string[]
}

interface AnswerCounts {
  // Students with at least one result on this level during the class, out of everyone in it.
  answered: number
  total: number
  // Students with the level open right now.
  here: number
}

export type LevelAnswers = AnswerCounts & ({ kind: 'pick'; choices: Tally[]; picks: Pick[] } | { kind: 'plans'; plans: ClassPlan[] })

// Everyone's results on one level, ready for a discussion: for a level with a right answer, what each
// student first said and a tally of those first answers; for a planning level, every distinct plan the
// class ran, best first, with who ran each.
export function levelAnswers(level: Level, room: ClassRoom, showNames: boolean): LevelAnswers {
  const labels = studentLabels(room, showNames)
  const results = new Map(room.players.map((player) => [player.id, player.events.filter((event) => event.levelId === level.id)]))
  const counts: AnswerCounts = {
    answered: room.players.filter((player) => (results.get(player.id) ?? []).length > 0).length,
    total: room.players.length,
    here: room.players.filter((player) => player.now === level.id).length,
  }
  const { goal } = level
  if (goal.kind === 'identifyBottleneck' || goal.kind === 'predict') {
    const options = goal.kind === 'predict' ? goal.options : level.model.stations.map((station) => ({ id: station.id, label: station.name }))
    const known = new Set(options.map((option) => option.id))
    // Only the level's own answers count; anything else could only come from a tampered device.
    const said = (event: ClassEvent) => {
      const answer = goal.kind === 'predict' ? (event.type === 'predicted' ? event.option : null) : event.type === 'answered' ? event.answer : null
      return answer !== null && known.has(answer) ? answer : null
    }
    const picks: Pick[] = []
    for (const player of room.players) {
      const answers = (results.get(player.id) ?? []).map(said).filter((answer): answer is string => answer !== null)
      if (answers.length === 0) continue
      const right = answers.indexOf(goal.answer)
      picks.push({
        id: player.id,
        label: labels.get(player.id) ?? player.name,
        first: answers[0],
        tries: right >= 0 ? right + 1 : answers.length,
        solved: right >= 0,
      })
    }
    const choices = options.map((option) => ({
      id: option.id,
      label: option.label,
      count: picks.filter((pick) => pick.first === option.id).length,
      right: option.id === goal.answer,
    }))
    return { ...counts, kind: 'pick', choices, picks }
  }
  const plans = new Map<string, ClassPlan>()
  for (const player of room.players) {
    const history = (results.get(player.id) ?? []).map((event) => asStored(event, player.id))
    for (const tried of plansTried(level, history)) {
      const key = planKey(level, tried.plan)
      const seen = plans.get(key)
      plans.set(key, {
        plan: seen?.plan ?? tried.plan,
        tries: (seen?.tries ?? 0) + tried.tries,
        stars: Math.max(seen?.stars ?? 0, tried.stars),
        met: (seen?.met ?? false) || tried.met,
        students: [...(seen?.students ?? []), labels.get(player.id) ?? player.name],
      })
    }
  }
  // Best results first; among equals, the plans more students ran.
  const ranked = [...plans.values()].sort((a, b) => Number(b.met) - Number(a.met) || b.stars - a.stars || b.students.length - a.students.length)
  return { ...counts, kind: 'plans', plans: ranked }
}
