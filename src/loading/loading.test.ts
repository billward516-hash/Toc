import { describe, expect, it } from 'vitest'
import { validateModel } from '../engine/model.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { loadCurve, outcomeOf, runDay } from './curve.ts'
import { bottlenecks, capacityPerHour, labModel, loadShare, noUpgrades, RATES, workTime } from './lines.ts'
import { GUESSES, judge, rightGuess, ROUND_MANY, ROUND_ONE, ROUND_TWO, ROUNDS, whatHappened } from './rounds.ts'
import { queueSeries } from './series.ts'

const DAYS = Array.from({ length: 24 }, (_, d) => d + 1)
const none = noUpgrades([0, 0, 0, 0, 0])
const fixed = [true, true, false, true, true]
const day = (round: (typeof ROUNDS)[number], upgraded: readonly boolean[], rate: number, d = round.day) =>
  outcomeOf(round.minutes, upgraded, rate, runDay(round.minutes, upgraded, rate, d))
const share = (days: number[], test: (d: number) => boolean) => days.filter(test).length / days.length

describe('the lines', () => {
  it('are valid models at every rate the dial offers', () => {
    for (const round of ROUNDS) {
      for (let rate = RATES.min; rate <= RATES.max; rate += RATES.step) expect(validateModel(labModel(round.minutes, none, rate))).toEqual([])
    }
  })

  it('have one, two, and five bottlenecks, and four upgrades leave one', () => {
    expect(bottlenecks(ROUND_ONE.minutes)).toEqual([2])
    expect(bottlenecks(ROUND_TWO.minutes)).toEqual([2, 3])
    expect(bottlenecks(ROUND_MANY.minutes)).toEqual([0, 1, 2, 3, 4])
    expect(bottlenecks(ROUND_MANY.minutes, fixed)).toEqual([2])
    expect(capacityPerHour(ROUND_ONE.minutes)).toBe(20)
    expect(capacityPerHour(ROUND_MANY.minutes, fixed)).toBe(20)
  })

  it('measure load against the bottleneck', () => {
    expect(loadShare(ROUND_ONE.minutes, none, 19)).toBeCloseTo(0.95)
    expect(workTime(ROUND_ONE.minutes)).toBe(10)
  })

  it('are deterministic', () => {
    expect(day(ROUND_ONE, none, 17)).toEqual(day(ROUND_ONE, none, 17))
  })
})

describe('cycle time against load', () => {
  const rates = [10, 14, 17, 19, 20, 22]
  const curve = loadCurve(ROUND_ONE.minutes, none, rates, DAYS.length)

  it('stays near the work time while the line has room, then climbs steeply', () => {
    const at = (rate: number) => curve.find((o) => o.rate === rate)!
    expect(at(10).cycle).toBeLessThan(workTime(ROUND_ONE.minutes) * 1.3)
    expect(at(19).cycle).toBeGreaterThan(at(14).cycle * 1.5)
    expect(at(22).cycle).toBeGreaterThan(at(19).cycle * 2.5)
    for (let i = 1; i < curve.length; i++) expect(curve[i].cycle).toBeGreaterThan(curve[i - 1].cycle)
  })

  it('ships almost nothing more once the bottleneck is full', () => {
    const at = (rate: number) => curve.find((o) => o.rate === rate)!
    expect(at(22).shipped - at(20).shipped).toBeLessThan(25)
    expect(at(20).shipped).toBeGreaterThan(at(14).shipped * 1.3)
  })

  it('piles orders up inside when the load is over the limit', () => {
    expect(curve.find((o) => o.rate === 22)!.inside).toBeGreaterThan(20)
    expect(curve.find((o) => o.rate === 14)!.inside).toBeLessThan(8)
  })
})

describe('more bottlenecks, more waiting', () => {
  it('lengthens the cycle time at the same load, on most days', () => {
    const rate = 19
    const cycle = (round: (typeof ROUNDS)[number], d: number) => day(round, none, rate, d).cycle
    expect(share(DAYS, (d) => cycle(ROUND_TWO, d) > cycle(ROUND_ONE, d))).toBeGreaterThanOrEqual(0.9)
    expect(share(DAYS, (d) => cycle(ROUND_MANY, d) > cycle(ROUND_TWO, d))).toBeGreaterThanOrEqual(0.9)
  })

  it('makes waiting, not working, the difference', () => {
    const one = loadCurve(ROUND_ONE.minutes, none, [18], DAYS.length)[0]
    const many = loadCurve(ROUND_MANY.minutes, none, [18], DAYS.length)[0]
    expect(many.waiting).toBeGreaterThan(one.waiting * 2)
  })

  it('is cured by leaving one bottleneck, with the same capacity', () => {
    const before = loadCurve(ROUND_MANY.minutes, none, [18], DAYS.length)[0]
    const after = loadCurve(ROUND_MANY.minutes, fixed, [18], DAYS.length)[0]
    expect(after.cycle).toBeLessThan(before.cycle * 0.6)
    expect(Math.abs(after.shipped - before.shipped)).toBeLessThan(15)
  })
})

describe('the rounds', () => {
  it('can be won, and only by loading the line well', () => {
    const wins = (round: (typeof ROUNDS)[number], upgraded: readonly boolean[], rate: number, days = DAYS) => share(days, (d) => judge(round, day(round, upgraded, rate, d)).passed)
    // Round 1: the sweet spot is near 90% of what the bottleneck can do.
    expect(judge(ROUND_ONE, day(ROUND_ONE, none, 18)).passed).toBe(true)
    expect(judge(ROUND_ONE, day(ROUND_ONE, none, 19)).passed).toBe(true)
    expect(wins(ROUND_ONE, none, 18)).toBeGreaterThanOrEqual(0.7)
    // Too few orders ships too little; a full line has too long a cycle.
    expect(judge(ROUND_ONE, day(ROUND_ONE, none, 15)).shippedOk).toBe(false)
    expect(judge(ROUND_ONE, day(ROUND_ONE, none, 20)).cycleOk).toBe(false)
    expect(wins(ROUND_ONE, none, 20)).toBeLessThanOrEqual(0.3)
    expect(wins(ROUND_ONE, none, 12)).toBe(0)
  })

  it('makes the second line give up some output for the same cycle time', () => {
    expect(judge(ROUND_TWO, day(ROUND_TWO, none, 17)).passed).toBe(true)
    expect(judge(ROUND_TWO, day(ROUND_TWO, none, 18)).passed).toBe(true)
    // The load that suited the first line is too much for it.
    expect(judge(ROUND_TWO, day(ROUND_TWO, none, 19)).cycleOk).toBe(false)
  })

  it('cannot be won on the balanced line as it stands, but can with four upgrades', () => {
    for (let rate = RATES.min; rate <= RATES.max; rate++) expect(judge(ROUND_MANY, day(ROUND_MANY, none, rate)).passed).toBe(false)
    expect(judge(ROUND_MANY, day(ROUND_MANY, fixed, 18)).passed).toBe(true)
    expect(judge(ROUND_MANY, day(ROUND_MANY, fixed, 19)).passed).toBe(true)
  })

  it("has a prediction question whose answer is that the second line's wait is a lot longer", () => {
    const rate = ROUND_TWO.predictAt!
    const ratio = day(ROUND_TWO, none, rate).cycle / day(ROUND_ONE, none, rate, ROUND_TWO.day).cycle
    expect(rightGuess(ratio).id).toBe('lot')
    expect(GUESSES.map((g) => g.id)).toContain('lot')
  })

  it('gives each guess a band of ratios with no gaps', () => {
    for (let i = 1; i < GUESSES.length; i++) expect(GUESSES[i].from).toBe(GUESSES[i - 1].to)
  })
})

describe('the explanations', () => {
  it('fit the load', () => {
    const text = (rate: number) => whatHappened(ROUND_ONE, none, day(ROUND_ONE, none, rate))
    expect(text(10)).toMatch(/spare time/)
    expect(text(16)).toMatch(/Queues are starting/)
    expect(text(19)).toMatch(/limit/)
    expect(text(22)).toMatch(/faster than the bottleneck/)
    expect(whatHappened(ROUND_TWO, none, day(ROUND_TWO, none, 16))).toMatch(/2 stations about as slow/)
  })
})

describe('the queue strips', () => {
  it('match the shift as the floor shows it', () => {
    const result = runDay(ROUND_TWO.minutes, none, 18, 3)
    const points = 81
    const series = queueSeries(result, points)
    expect(series).toHaveLength(5)
    for (const k of [0, 10, 33, 60, 80]) {
      const snapshot = snapshotAt(result, (k * result.horizon) / (points - 1) - 1e-9)
      expect(series.map((s) => s[k])).toEqual(snapshot.queues)
    }
  })
})
