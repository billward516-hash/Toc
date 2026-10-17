import { DAYS, HORIZON, type LotPlan, type LotResult } from './lots.ts'

// The loading lab's lot round: one group of eight tools, run for two weeks. Which lots to make, how many
// tools to give each, and how many lots to keep in the system decide how much it ships and how long a
// lot takes.
export const LOT_ROUND = {
  title: 'Lots and tools',
  // The day the round is played on, so only the plan changes between runs.
  day: 2,
  mission: { good: 64000, cycleHours: 12 },
  start: { size: 1500, toolsPerLot: 8, depth: 4, order: 'first' } satisfies LotPlan,
}

export const LIMITS = {
  toolsPerLot: { min: 1, max: 8 },
  depth: { min: 1, max: 12 },
}

export interface LotVerdict {
  goodOk: boolean
  cycleOk: boolean
  passed: boolean
}

export function judgeLots(result: LotResult): LotVerdict {
  const goodOk = result.good >= LOT_ROUND.mission.good
  const cycleOk = result.finished > 0 && result.cycleHours <= LOT_ROUND.mission.cycleHours
  return { goodOk, cycleOk, passed: goodOk && cycleOk }
}

// Where the tools' time went, as shares of every tool's two weeks.
export interface TimeSplit {
  // Running loads.
  running: number
  // Tools of a set with a lot committed, standing idle while the others finish it.
  tail: number
  // Sets with no lot to run.
  starved: number
  // Tools no set includes.
  unused: number
}

export function timeSplit(result: LotResult): TimeSplit {
  const tools = result.groups.reduce((n, g) => n + g.length, 0) + result.unused.length
  const total = tools * HORIZON
  let run = 0
  for (const event of result.events) {
    if (event.type === 'run') run += Math.max(0, Math.min(event.end, HORIZON) - event.t)
  }
  let committed = 0
  for (const lot of result.lots) {
    if (lot.start === null || lot.group === null) continue
    committed += (Math.min(lot.end ?? HORIZON, HORIZON) - lot.start) * result.groups[lot.group].length
  }
  const inSets = result.groups.reduce((n, g) => n + g.length, 0) * HORIZON
  return { running: run / total, tail: (committed - run) / total, starved: (inSets - committed) / total, unused: (result.unused.length * HORIZON) / total }
}

// Average hours a finished lot held its tools.
export function holdHours(result: LotResult): number {
  const done = result.lots.filter((l) => l.end !== null && l.start !== null)
  return done.length === 0 ? 0 : done.reduce((sum, l) => sum + ((l.end ?? 0) - (l.start ?? 0)), 0) / done.length / 60
}

export function describePlan(plan: LotPlan): string {
  const sets = Math.floor(8 / plan.toolsPerLot)
  const size = plan.size === 'mixed' ? 'mixed 600 and 2400' : `${plan.size}`
  return `${size}-wafer lots, ${plan.toolsPerLot} ${plan.toolsPerLot === 1 ? 'tool' : 'tools'} each (${sets} at a time), ${plan.depth} in the system`
}

// What to try next.
export function lotAdvice(result: LotResult): string {
  const verdict = judgeLots(result)
  if (verdict.passed) return 'Mission done.'
  const { plan } = result
  const sets = result.groups.length
  const split = timeSplit(result)
  if (!verdict.goodOk) {
    if (split.unused > 0.03) {
      return `${result.unused.length} of the 8 tools are in no set: sets of ${plan.toolsPerLot} use only ${sets * plan.toolsPerLot}. Pick a number of tools per lot that divides 8 (1, 2, 4 or 8).`
    }
    if (split.starved > 0.05) {
      return `Some sets had no lot to run. There are ${sets} sets, so keep at least ${sets} lots in the system, or the tools stand idle.`
    }
    if (split.tail > 0.08) {
      return `Tools finished their loads and stood idle while the others finished the lot (${Math.round(split.tail * 100)}% of their time). A lot fills its tools evenly only when its size is a multiple of 50 times the tools it uses; try another lot size or another number of tools.`
    }
    return 'Not enough good wafers: yield averages about 77%, so the tools have to be running close to full all fortnight.'
  }
  if (plan.depth > sets) {
    return `Lots waited too long: ${plan.depth - sets} of the ${plan.depth} lots were always waiting for a set. Keep only as many lots in the system as there are sets (${sets}); more adds waiting and ships nothing extra.`
  }
  return `Each lot held its tools for about ${Math.round(holdHours(result))} hours. Make lots smaller, or give each more tools so it finishes sooner.`
}

// How the fortnight went, in words.
export function whatHappenedLots(result: LotResult): string {
  const sets = result.groups.length
  const wait = Math.max(0, result.cycleHours - holdHours(result))
  const waiting = Math.max(0, result.plan.depth - sets)
  const parts = [
    `A lot spent ${Math.round(holdHours(result))} hours on the tools and ${Math.round(wait)} hours waiting for a set to come free.`,
    waiting > 0
      ? `With ${sets} ${sets === 1 ? 'set' : 'sets'} and ${result.plan.depth} lots in the system, ${waiting} ${waiting === 1 ? 'lot' : 'lots'} are always waiting. Cycle time is lots in the system divided by lots finished an hour, so the lots beyond what the sets can hold only lengthen the wait.`
      : 'The system holds no more lots than there are sets, so no lot waits for anything but a set to finish.',
  ]
  return parts.join(' ')
}

export interface LotSnapshot {
  t: number
  // Lots waiting for a set, oldest first.
  waiting: number[]
  // The lot each set is running, if any.
  sets: (number | null)[]
  // The load each tool is running now.
  tools: ({ lot: number; wafers: number; start: number; end: number } | null)[]
  finished: number
  wafers: number
  good: number
  // Average hours from joining the queue to finishing, over the lots finished so far.
  cycleHours: number | null
  // The share of the tools' time so far spent running.
  busy: number
}

export function lotSnapshotAt(result: LotResult, t: number, toolCount: number): LotSnapshot {
  const waiting: number[] = []
  const sets: (number | null)[] = result.groups.map(() => null)
  const tools: LotSnapshot['tools'] = Array.from({ length: toolCount }, () => null)
  let finished = 0
  let wafers = 0
  let good = 0
  let cycle = 0
  let run = 0
  for (const event of result.events) {
    if (event.t > t) break
    switch (event.type) {
      case 'release':
        waiting.push(event.lot)
        break
      case 'start':
        waiting.splice(waiting.indexOf(event.lot), 1)
        sets[event.group] = event.lot
        break
      case 'run':
        tools[event.tool] = { lot: event.lot, wafers: event.wafers, start: event.t, end: event.end }
        run += Math.min(event.end, t) - event.t
        break
      case 'done': {
        const lot = result.lots[event.lot]
        sets[lot.group ?? 0] = null
        finished++
        wafers += lot.size
        good += lot.size * lot.yield
        cycle += event.t - lot.release
        break
      }
    }
  }
  return {
    t,
    waiting,
    sets,
    tools: tools.map((run) => (run && t < run.end ? run : null)),
    finished,
    wafers,
    good,
    cycleHours: finished > 0 ? cycle / finished / 60 : null,
    busy: t > 0 ? run / (toolCount * t) : 0,
  }
}

export const DAYS_SHOWN = DAYS
