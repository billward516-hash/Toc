import { capacityPerHour, DAYS, DUE, HORIZON, MIXED, type LotPlan, type LotResult } from './lots.ts'

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

// The hot-lot round: the same group, with some lots promised much sooner.
export const HOT_ROUND = {
  title: 'Hot lots',
  day: 2,
  // Every lot should meet its promise, and the group still has to ship.
  mission: { onTime: 0.9, good: 60000 },
  // A hot lot needs at least this many finished to count.
  fewest: 3,
  start: { size: 1200, toolsPerLot: 4, depth: 4, order: 'first', hot: 0.25, reserve: false } satisfies LotPlan,
}

export const LIMITS = {
  toolsPerLot: { min: 1, max: 8 },
  depth: { min: 1, max: 12 },
  // Hot lots as a share of the group's capacity.
  hot: { min: 0, max: 0.5, step: 0.05 },
}

// Hot lots a day on average, for a plan.
export function hotLotsPerDay(plan: LotPlan): number {
  const size = plan.size === 'mixed' ? (MIXED[0] + MIXED[1]) / 2 : plan.size
  return ((plan.hot ?? 0) * capacityPerHour() * 24) / size
}

export interface HotVerdict {
  hotOk: boolean
  normalOk: boolean
  goodOk: boolean
  passed: boolean
}

export function judgeHot(result: LotResult): HotVerdict {
  const { mission, fewest } = HOT_ROUND
  const hotOk = result.promises.hot.finished >= fewest && result.promises.hot.onTime >= mission.onTime
  const normalOk = result.promises.normal.finished > 0 && result.promises.normal.onTime >= mission.onTime
  const goodOk = result.good >= mission.good
  return { hotOk, normalOk, goodOk, passed: hotOk && normalOk && goodOk }
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
  const hot = (plan.hot ?? 0) > 0 ? `; ${Math.round((plan.hot ?? 0) * 100)}% hot lots, ${plan.order === 'hot' ? 'hot first' : 'no priority'}${plan.reserve ? ', one set reserved' : ''}` : ''
  return `${size}-wafer lots, ${plan.toolsPerLot} ${plan.toolsPerLot === 1 ? 'tool' : 'tools'} each (${sets} at a time), ${plan.depth} in the system${hot}`
}

// Hours a hot lot held its tools, on average.
export function hotHoldHours(result: LotResult): number {
  const hot = result.lots.filter((l) => l.hot && l.end !== null && l.start !== null)
  return hot.length === 0 ? 0 : hot.reduce((sum, l) => sum + ((l.end ?? 0) - (l.start ?? 0)), 0) / hot.length / 60
}

// What to try next after a run of the hot-lot round.
export function hotAdvice(result: LotResult): string {
  const verdict = judgeHot(result)
  if (verdict.passed) return 'Mission done.'
  const { plan, promises } = result
  const split = timeSplit(result)
  if ((plan.hot ?? 0) === 0 || promises.hot.finished < HOT_ROUND.fewest) {
    return 'Hardly any hot lots came through, so there was nothing to test the promise on. Send some hot lots in.'
  }
  if (!verdict.hotOk) {
    const took = Math.round(promises.hot.cycleHours)
    if (plan.order !== 'hot') {
      return `Hot lots are promised ${DUE.hot} hours but waited their turn like any other: ${took} hours on average, ${Math.round(promises.hot.onTime * 100)}% on time. A promise is kept by running hot lots first.`
    }
    const hold = Math.round(hotHoldHours(result))
    if (!plan.reserve && hold > DUE.hot / 2) {
      return `Even first in line, a hot lot can't interrupt the lot being run out. It waits for one to finish, then runs ${hold} hours itself: ${took} hours in all. Smaller lots shorten both the wait and the run.`
    }
    if (!plan.reserve) {
      return `Hot lots go first, but each still waits for a running lot to finish (${took} hours in all, ${Math.round(promises.hot.onTime * 100)}% on time). Smaller lots shorten that wait, or reserve a set so there is always one free for a hot lot.`
    }
    return `Even with a set reserved, hot lots took ${took} hours: they queue behind each other, or each runs too long. Lots that are smaller or spread over more tools run sooner.`
  }
  if (!verdict.normalOk) {
    return `Hot lots took the front of the queue and the other lots paid: they averaged ${Math.round(promises.normal.cycleHours)} hours against a ${DUE.normal}-hour promise (${Math.round(promises.normal.onTime * 100)}% on time). Send fewer hot lots, keep fewer lots in the system, or don't hold a set idle for them.`
  }
  if (plan.reserve && split.starved > 0.05) {
    return `The reserved set stood idle ${Math.round(split.starved * 100)}% of the time. That is what a lane kept free for hot lots costs: shipping fell short. Reserve nothing, or send enough hot lots to use it.`
  }
  return lotAdvice(result)
}

// How the fortnight went with hot lots, in words.
export function whatHappenedHot(result: LotResult): string {
  const { promises, plan } = result
  const hot = Math.round(promises.hot.cycleHours)
  const normal = Math.round(promises.normal.cycleHours)
  return `${promises.hot.finished} hot lots took ${hot} hours on average against ${DUE.hot} promised; the other ${promises.normal.finished} took ${normal} against ${DUE.normal}. ${
    plan.order === 'hot'
      ? 'Going first costs the other lots little, since a hot lot only jumps the queue, but it cannot interrupt a lot that is running out: it still waits for one to finish.'
      : 'With no priority, a hot lot waits in line like any other lot.'
  }`
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
