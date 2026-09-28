import { validateModel } from '../engine/model.ts'
import type { SimResult } from '../engine/simulate.ts'
import { bufferShare, steadyShare, type Snapshot } from '../engine/timeline.ts'
import { leverValues } from './levers.ts'
import type { Choices, Goal, Level, Popup } from './types.ts'

type BufferGoal = Extract<Goal, { kind: 'buffer' }>
type ElevateGoal = Extract<Goal, { kind: 'elevate' }>
type FlowGoal = Extract<Goal, { kind: 'flow' }>
type ProfitGoal = Extract<Goal, { kind: 'profit' }>

export type LevelState = 'locked' | 'unlocked' | 'completed'

export function levelState(level: Level, completed: ReadonlySet<string>): LevelState {
  if (completed.has(level.id)) return 'completed'
  return level.requires.every((id) => completed.has(id)) ? 'unlocked' : 'locked'
}

// Tiers 1 and 2 score one metric each, so one star is the most they award. Buffer levels score
// a healthy buffer, then low inventory, then both again on days the player hasn't seen; elevate
// levels score output, then steady flow, then money well spent.
export function maxStars(level: Level): number {
  switch (level.goal.kind) {
    case 'output':
    case 'steady':
      return 1
    case 'buffer':
    case 'elevate':
    case 'flow':
    case 'profit':
      return 3
    default:
      return 0
  }
}

// Whether a run clears the level's first bar on its own day. For an elevate goal the first star also
// needs every fresh day (see starsFor).
export function goalMet(goal: Goal, result: SimResult): boolean {
  switch (goal.kind) {
    case 'output':
    case 'elevate':
    case 'flow':
      return result.output >= goal.target
    case 'steady':
      return result.output >= goal.minShipped && steadyShare(result, goal.pileLimit) >= goal.minSteady
    case 'buffer':
      return bufferScore(goal, result).healthy >= goal.minHealthy
    case 'profit':
      return profitScore(goal, result).profit >= goal.target
    default:
      return false
  }
}

export interface ProfitScore {
  // Sales minus ingredients, for what shipped.
  throughput: number
  profit: number
  shipped: number
  // Average value of the work on the floor over the shift, at ingredient cost.
  inventory: number
}

// Throughput accounting for one day: ingredients are paid for when an order is released, and
// throughput is earned only when it ships.
export function profitScore(goal: ProfitGoal, result: SimResult): ProfitScore {
  const last = result.stations.length - 1
  const materials = (job: number) => goal.economics[result.products?.[job] ?? '']?.materials ?? 0
  let throughput = 0
  let value = 0
  let area = 0
  let before = 0
  for (const event of result.events) {
    area += value * (event.t - before)
    before = event.t
    if (event.type === 'release') value += materials(event.job)
    else if (event.type === 'finish' && event.scrap) value -= materials(event.job)
    else if (event.type === 'finish' && event.station === last) {
      const product = result.products?.[event.job] ?? ''
      const economics = goal.economics[product]
      if (economics) throughput += economics.price - economics.materials
      value -= materials(event.job)
    }
  }
  area += value * (result.horizon - before)
  return { throughput, profit: throughput - goal.expense, shipped: result.output, inventory: area / result.horizon }
}

// The live dashboard at a moment in the shift: throughput earned by what has shipped so far, the
// ingredients tied up in what's on the floor now, and the share of the shift's expense spent so far.
export function profitSoFar(goal: ProfitGoal, result: SimResult, snapshot: Snapshot): Omit<ProfitScore, 'shipped'> & { expense: number } {
  let throughput = 0
  let inventory = 0
  for (let job = 0; job < snapshot.released; job++) inventory += goal.economics[result.products?.[job] ?? '']?.materials ?? 0
  for (const [product, count] of Object.entries(snapshot.shippedBy ?? {})) {
    const economics = goal.economics[product]
    if (!economics) continue
    throughput += count * (economics.price - economics.materials)
    inventory -= count * economics.materials
  }
  const expense = (goal.expense * Math.min(snapshot.t, result.horizon)) / result.horizon
  return { throughput, profit: throughput - expense, inventory, expense }
}

// What a plan spent, and what the untouched factory shipped on the level's own day.
export interface Investment {
  spend: number
  baseline: number
}

// More shipped on the level's own day for every $1,000 spent. Spending nothing always counts as worth it.
export function gainPer1000(result: SimResult, { spend, baseline }: Investment): number {
  return spend === 0 ? Infinity : (result.output - baseline) / (spend / 1000)
}

export interface ElevateScore {
  // Each day, the level's own first: shipped at least the target, and steady enough.
  days: { output: number; hit: boolean; steady: number; calm: boolean }[]
  gain: number
}

export function elevateScore(goal: ElevateGoal, result: SimResult, freshDays: SimResult[], investment: Investment): ElevateScore {
  const days = [result, ...freshDays].map((day) => {
    const steady = steadyShare(day, goal.pileLimit)
    return { output: day.output, hit: day.output >= goal.target, steady, calm: steady >= goal.minSteady }
  })
  return { days, gain: gainPer1000(result, investment) }
}

export interface BufferScore {
  // Share of the shift the pile in front of the drum stayed within the goal's band.
  healthy: number
  avgWip: number
  // Both the healthy share and the inventory cap met.
  both: boolean
}

export function bufferScore(goal: BufferGoal, result: SimResult): BufferScore {
  const drum = result.stations.findIndex((s) => s.id === goal.drum)
  const healthy = bufferShare(result, drum, goal.low, goal.high)
  return { healthy, avgWip: result.avgWip, both: healthy >= goal.minHealthy && result.avgWip <= goal.maxAvgWip }
}

// Stars for a run. The third star on a buffer level needs `goal.freshDays` more days, each meeting
// both bars. An elevate level judges every star across the level's own day and its fresh days.
// A flow day clears both bars: enough shipped, and shipped quickly enough.
export function flowHolds(goal: FlowGoal, day: SimResult): boolean {
  return day.output >= goal.target && (day.avgLeadTime ?? Infinity) <= goal.maxLeadTime
}

export function starsFor(goal: Goal, result: SimResult, freshDays: SimResult[] = [], investment?: Investment): number {
  if (goal.kind === 'profit') {
    if (freshDays.length < goal.freshDays) return 0
    const days = [result, ...freshDays].map((day) => profitScore(goal, day))
    if (!days.every((day) => day.profit >= goal.target)) return 0
    if (!days.every((day) => day.shipped >= goal.minShipped)) return 1
    return days.every((day) => day.inventory <= goal.maxInventory) ? 3 : 2
  }
  if (goal.kind === 'flow') {
    if (!goalMet(goal, result)) return 0
    if (!flowHolds(goal, result)) return 1
    return freshDays.length >= goal.freshDays && freshDays.every((day) => flowHolds(goal, day)) ? 3 : 2
  }
  if (goal.kind === 'elevate') {
    if (freshDays.length < goal.freshDays) return 0
    const score = elevateScore(goal, result, freshDays, investment ?? { spend: 0, baseline: 0 })
    if (!score.days.every((day) => day.hit)) return 0
    if (!score.days.every((day) => day.calm)) return 1
    return investment && score.gain >= goal.minGainPer1000 ? 3 : 2
  }
  if (!goalMet(goal, result)) return 0
  if (goal.kind !== 'buffer') return 1
  if (!bufferScore(goal, result).both) return 1
  const holds = freshDays.length >= goal.freshDays && freshDays.every((day) => bufferScore(goal, day).both)
  return holds ? 3 : 2
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
  const productIds = new Set((model.products ?? []).map((p) => p.id))
  const leverIds = new Set<string>()
  for (const lever of levers) {
    if (leverIds.has(lever.id)) problems.push(`duplicate lever "${lever.id}"`)
    leverIds.add(lever.id)
    switch (lever.kind) {
      case 'releasePace':
        if (!lever.every.every((minutes) => minutes > 0)) problems.push(`lever "${lever.id}" needs positive intervals`)
        break
      case 'ropeLength':
        if (!lever.lengths.every((n) => Number.isInteger(n) && n >= 1)) problems.push(`lever "${lever.id}" needs positive whole lengths`)
        if (model.release.kind !== 'rope' && !levers.some((l) => l.kind === 'ropeTo')) {
          problems.push(`lever "${lever.id}" sizes a rope the line doesn't have`)
        }
        break
      case 'machineRule': {
        const station = model.stations.find((s) => s.id === lever.station)
        if (!station?.machines?.some((m) => m.name === lever.machine)) {
          problems.push(`lever "${lever.id}" rules a machine the line doesn't have: ${lever.station}/${lever.machine}`)
        }
        if (lever.options.length === 0) problems.push(`lever "${lever.id}" needs options`)
        for (const option of lever.options) {
          for (const p of option.products ?? []) if (!productIds.has(p)) problems.push(`lever "${lever.id}" names unknown product "${p}"`)
        }
        break
      }
      case 'buy':
        if (lever.options.length === 0) problems.push(`lever "${lever.id}" needs options`)
        for (const purchase of lever.options) {
          if (!model.stations.find((s) => s.id === purchase.station)?.machines) {
            problems.push(`lever "${lever.id}" buys for "${purchase.station}", which has no named machines`)
          }
          if (!(purchase.price > 0)) problems.push(`lever "${lever.id}" needs a positive price`)
          for (const p of purchase.machine.products ?? []) if (!productIds.has(p)) problems.push(`lever "${lever.id}" names unknown product "${p}"`)
        }
        break
      case 'priority': {
        if (!stationIds.has(lever.station)) problems.push(`lever "${lever.id}" orders an unknown station "${lever.station}"`)
        if (lever.options.length === 0) problems.push(`lever "${lever.id}" needs options`)
        for (const option of lever.options) {
          for (const p of option.order ?? []) if (!productIds.has(p)) problems.push(`lever "${lever.id}" names unknown product "${p}"`)
        }
        break
      }
      case 'menu':
        if (lever.options.length === 0) problems.push(`lever "${lever.id}" needs options`)
        for (const option of lever.options) {
          if (option.mix.length === 0 || !(option.every > 0)) problems.push(`lever "${lever.id}" option "${option.id}" needs orders and a pace`)
          for (const p of option.mix) if (!productIds.has(p)) problems.push(`lever "${lever.id}" names unknown product "${p}"`)
        }
        break
      case 'lotSize':
      case 'transferSize':
        if (!lever.sizes.every((n) => Number.isInteger(n) && n >= 1)) problems.push(`lever "${lever.id}" needs positive whole sizes`)
        if (lever.kind === 'lotSize' && model.release.kind !== 'interval') problems.push(`lever "${lever.id}" needs orders on a schedule`)
        break
      default:
        if (lever.kind === 'quickChange') {
          if (!(lever.factor > 0)) problems.push(`lever "${lever.id}" needs a positive factor`)
          for (const s of lever.stations) {
            if (stationIds.has(s) && !model.stations.find((st) => st.id === s)?.changeover) {
              problems.push(`lever "${lever.id}" speeds changeovers at "${s}", which has none`)
            }
          }
        }
        if (lever.kind === 'ropeTo' && !(Number.isInteger(lever.length) && lever.length >= 1)) {
          problems.push(`lever "${lever.id}" needs a positive whole length`)
        }
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
    case 'steady':
    case 'buffer':
    case 'elevate':
    case 'flow':
    case 'profit': {
      if (goal.kind === 'steady' && !(goal.minSteady > 0 && goal.minSteady <= 1 && goal.pileLimit >= 1)) {
        problems.push('a steady goal needs 0 < minSteady <= 1 and pileLimit >= 1')
      }
      if (goal.kind === 'profit') {
        if (productIds.size === 0) problems.push('a profit goal needs a line that makes products')
        for (const p of productIds) if (!goal.economics[p]) problems.push(`no price for product "${p}"`)
        for (const [p, e] of Object.entries(goal.economics)) {
          if (!productIds.has(p)) problems.push(`price for unknown product "${p}"`)
          if (!(e.price >= 0 && e.materials >= 0)) problems.push(`"${p}" needs a price and ingredient cost of at least 0`)
        }
        if (!(goal.expense >= 0)) problems.push('a profit goal needs an operating expense of at least 0')
        if (!(goal.maxInventory > 0)) problems.push('a profit goal needs a positive maxInventory')
        if (!(Number.isInteger(goal.freshDays) && goal.freshDays >= 1)) problems.push('a profit goal needs at least one fresh day')
      }
      if (goal.kind === 'flow') {
        if (!(goal.target > 0)) problems.push('a flow goal needs a positive target')
        if (!(goal.maxLeadTime > 0)) problems.push('a flow goal needs a positive maxLeadTime')
        if (!(Number.isInteger(goal.freshDays) && goal.freshDays >= 1)) problems.push('a flow goal needs at least one fresh day')
      }
      if (goal.kind === 'elevate') {
        if (!(goal.target > 0)) problems.push('an elevate goal needs a positive target')
        if (!(goal.minSteady > 0 && goal.minSteady <= 1 && goal.pileLimit >= 1)) {
          problems.push('an elevate goal needs 0 < minSteady <= 1 and pileLimit >= 1')
        }
        if (!(goal.minGainPer1000 >= 0)) problems.push('an elevate goal needs minGainPer1000 >= 0')
        if (goal.budget !== undefined && !(goal.budget > 0)) problems.push('a budget must be positive')
        if (!(Number.isInteger(goal.freshDays) && goal.freshDays >= 1)) problems.push('an elevate goal needs at least one fresh day')
      }
      if (goal.kind === 'buffer') {
        if (!stationIds.has(goal.drum)) problems.push(`drum "${goal.drum}" is not a station`)
        if (!(goal.low >= 0 && goal.high >= goal.low)) problems.push('a buffer goal needs 0 <= low <= high')
        if (!(goal.minHealthy > 0 && goal.minHealthy <= 1)) problems.push('a buffer goal needs 0 < minHealthy <= 1')
        if (!(goal.maxAvgWip > 0)) problems.push('a buffer goal needs a positive maxAvgWip')
        if (!(Number.isInteger(goal.freshDays) && goal.freshDays >= 1)) problems.push('a buffer goal needs at least one fresh day')
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
