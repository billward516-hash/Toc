import { outcomeOf, runDay, type Outcome } from './curve.ts'
import { bottlenecks, capacityPerHour, noUpgrades } from './lines.ts'

// The loading lab's three rounds. Each is the same question, asked of a different line: how many orders
// can you send in before the cycle time stops being acceptable?
export interface Round {
  id: 'one' | 'two' | 'many'
  title: string
  // Minutes each station takes per robot, in line order.
  minutes: number[]
  // The day the round is played on: every run of the round has the same luck, so the load is all that
  // changes between them.
  day: number
  mission: Mission
  // How many stations the player may speed up.
  upgrades: number
  // Where the dial starts, in orders an hour.
  start: number
  // The rate the player is asked to guess the cycle time of, before running anything.
  predictAt?: number
}

export interface Mission {
  // Average minutes from order to shipping must be no more than this...
  cycle: number
  // ...while shipping at least this many robots in the day.
  shipped: number
}

export const ROUND_ONE: Round = {
  id: 'one',
  title: 'Find the sweet spot',
  minutes: [2, 1.5, 3, 2, 1.5],
  day: 2,
  mission: { cycle: 25, shipped: 420 },
  upgrades: 0,
  start: 12,
}

export const ROUND_TWO: Round = {
  id: 'two',
  title: 'Two bottlenecks',
  minutes: [2, 1.5, 3, 3, 1.5],
  day: 2,
  mission: { cycle: 25, shipped: 395 },
  upgrades: 0,
  start: 12,
  predictAt: 19,
}

export const ROUND_MANY: Round = {
  id: 'many',
  title: 'Everything is a bottleneck',
  minutes: [3, 3, 3, 3, 3],
  day: 2,
  mission: { cycle: 25, shipped: 420 },
  upgrades: 4,
  start: 12,
}

export const ROUNDS: Round[] = [ROUND_ONE, ROUND_TWO, ROUND_MANY]

export interface Verdict {
  cycleOk: boolean
  shippedOk: boolean
  passed: boolean
}

export function judge(round: Round, outcome: Outcome): Verdict {
  const cycleOk = outcome.cycle <= round.mission.cycle
  const shippedOk = outcome.shipped >= round.mission.shipped
  return { cycleOk, shippedOk, passed: cycleOk && shippedOk }
}

// A guess at how much longer the second line's cycle time will be than the first's at the same load.
export interface Guess {
  id: string
  text: string
  // The ratio of the two cycle times, from (included) to (not included).
  from: number
  to: number
}

export const GUESSES: Guess[] = [
  { id: 'same', text: 'About the same', from: 0, to: 1.1 },
  { id: 'little', text: 'A little longer (10–25%)', from: 1.1, to: 1.25 },
  { id: 'lot', text: 'A lot longer (25–100%)', from: 1.25, to: 2 },
  { id: 'double', text: 'More than double', from: 2, to: Infinity },
]

export function rightGuess(ratio: number): Guess {
  return GUESSES.find((g) => ratio >= g.from && ratio < g.to) ?? GUESSES[GUESSES.length - 1]
}

// What a run shows, in words, from how hard the line was loaded.
export function whatHappened(round: Round, upgraded: readonly boolean[], outcome: Outcome): string {
  const stuck = Math.round(outcome.inside)
  const many = bottlenecks(round.minutes, upgraded).length
  const share = Math.round((100 * outcome.waiting) / Math.max(1, outcome.cycle))
  if (outcome.load > 1.005) {
    return `Orders came in faster than the bottleneck can make robots (${Math.round(outcome.load * 100)}% of what it can do). The extra has nowhere to go: it piles up, ${stuck} orders were still inside at the end, and the pile, and the wait, would keep growing every hour.`
  }
  if (outcome.load >= 0.92) {
    return `Right at the limit. The bottleneck was almost never idle, so every bit of bad luck (a slow robot, orders arriving together) left a queue that it had no spare time to clear. ${share}% of each robot's time in the factory was spent waiting.`
  }
  if (outcome.load >= 0.7) {
    return `Queues are starting to build. The bottleneck has little spare time to catch up after a slow robot or a crowd of orders${many > 1 ? `, and with ${many} stations about as slow, each of them does the same` : ''}. ${share}% of each robot's time was spent waiting.`
  }
  return `Plenty of spare time. After a slow robot or a crowd of orders, the stations catch up before the next one arrives, so robots rarely wait (${share}% of their time in the factory). But the line also shipped less than it could.`
}

// The load at which `round`'s line would be exactly full, in orders an hour.
export const fullRate = (round: Round, upgraded = noUpgrades(round.minutes)) => capacityPerHour(round.minutes, upgraded)

// What the first line did at the rate a round asks for a guess about, on the round's day.
export function referenceOutcome(round: Round): Outcome | null {
  if (round.predictAt === undefined) return null
  const { minutes } = ROUND_ONE
  const upgraded = noUpgrades(minutes)
  return outcomeOf(minutes, upgraded, round.predictAt, runDay(minutes, upgraded, round.predictAt, round.day))
}

// What to try next after a run that missed the mission.
export function advice(round: Round, upgraded: readonly boolean[], outcome: Outcome): string {
  const { cycleOk, shippedOk } = judge(round, outcome)
  const necks = bottlenecks(round.minutes, upgraded)
  if (cycleOk && shippedOk) return 'Mission done.'
  if (!cycleOk && !shippedOk) {
    return 'Both missed: the line is too crowded to be quick and still not shipping enough. Something about the line itself, not only the load, is wrong.'
  }
  if (!cycleOk) {
    if (necks.length > 1 && round.upgrades > 0) {
      return `Robots waited too long. ${necks.length} stations are about equally slow, so they wait at every one of them. Speed up all but one, then load the line again.`
    }
    return 'Robots waited too long: too many orders for the bottleneck. Lower the load a little.'
  }
  return 'Robots were quick, but too few shipped: the bottleneck had spare time. Raise the load.'
}
