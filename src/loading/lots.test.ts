import { describe, expect, it } from 'vitest'
import { HOT_ROUND, hotAdvice, hotLotsPerDay, judgeHot, judgeLots, LOT_ROUND, lotAdvice, lotSnapshotAt, timeSplit } from './lotRound.ts'
import { HORIZON, LOAD, MIN_LOAD, nextLoad, runLots, SPEEDS, toolSets, type LotPlan } from './lots.ts'

const SEEDS = Array.from({ length: 12 }, (_, s) => s + 1)
const plan = (p: Partial<LotPlan>): LotPlan => ({ size: 1200, toolsPerLot: 4, depth: 2, order: 'first', ...p })
const mean = (plan: LotPlan, pick: (r: ReturnType<typeof runLots>) => number) => SEEDS.reduce((sum, s) => sum + pick(runLots(plan, s)), 0) / SEEDS.length
const wins = (p: LotPlan) => SEEDS.filter((s) => judgeLots(runLots(p, s)).passed).length / SEEDS.length

describe('tool sets', () => {
  it('deal tools out fastest first and leave the slowest over', () => {
    const { groups, unused } = toolSets(SPEEDS, 3)
    expect(groups).toHaveLength(2)
    expect(unused).toHaveLength(2)
    expect(unused.every((tool) => SPEEDS[tool] === 25)).toBe(true)
    expect(toolSets(SPEEDS, 8).groups).toEqual([[2, 3, 4, 5, 6, 7, 0, 1]])
    expect(toolSets(SPEEDS, 1).groups).toHaveLength(8)
  })

  it('never ask for a run below the minimum load', () => {
    for (let remaining = 1; remaining <= 400; remaining++) {
      const load = nextLoad(remaining)
      expect(load).toBeLessThanOrEqual(LOAD)
      if (remaining >= MIN_LOAD) expect(load).toBeGreaterThanOrEqual(MIN_LOAD)
      if (remaining > LOAD) expect(remaining - load === 0 || remaining - load >= MIN_LOAD).toBe(true)
    }
  })
})

describe('the lot simulation', () => {
  it('is deterministic and keeps the books', () => {
    const a = runLots(plan({}), 3)
    expect(runLots(plan({}), 3)).toEqual(a)
    const split = timeSplit(a)
    expect(split.running + split.tail + split.starved + split.unused).toBeCloseTo(1, 6)
    expect(a.busy).toBeCloseTo(split.running, 6)
    // Lots in the system never differ from the depth.
    const waiting = a.lots.filter((l) => l.start === null).length
    const running = a.lots.filter((l) => l.start !== null && l.end === null).length
    expect(waiting + running).toBe(2)
  })

  it('processes whole lots, a lot at a time on its own tools', () => {
    const r = runLots(plan({ size: 600, toolsPerLot: 2, depth: 4 }), 1)
    const runs = r.events.filter((e) => e.type === 'run')
    for (const lot of r.lots.filter((l) => l.end !== null)) {
      const own = runs.filter((e) => e.lot === lot.id)
      expect(own.reduce((sum, e) => sum + e.wafers, 0)).toBe(lot.size)
      const tools = new Set(own.map((e) => e.tool))
      expect([...tools].every((tool) => r.groups[lot.group ?? 0].includes(tool))).toBe(true)
    }
    // No two lots on one tool at once.
    for (let tool = 0; tool < 8; tool++) {
      const own = runs.filter((e) => e.tool === tool).sort((a, b) => a.t - b.t)
      for (let i = 1; i < own.length; i++) expect(own[i].t).toBeGreaterThanOrEqual(own[i - 1].end - 1e-9)
    }
  })

  it('matches the snapshot to the log', () => {
    const r = runLots(plan({ size: 600, toolsPerLot: 2, depth: 4 }), 2)
    const end = lotSnapshotAt(r, HORIZON, 8)
    expect(end.finished).toBe(r.finished)
    expect(end.wafers).toBe(r.wafers)
    expect(end.busy).toBeCloseTo(r.busy, 6)
    const mid = lotSnapshotAt(r, HORIZON / 2, 8)
    expect(mid.waiting.length + mid.sets.filter((s) => s !== null).length).toBe(4)
  })
})

describe('what the lab teaches about lots', () => {
  it('has cycle time follow the lots in the system, not the output', () => {
    const lean = plan({ depth: 2 })
    const heavy = plan({ depth: 8 })
    expect(mean(heavy, (r) => r.cycleHours)).toBeGreaterThan(mean(lean, (r) => r.cycleHours) * 3)
    expect(Math.abs(mean(heavy, (r) => r.good) - mean(lean, (r) => r.good)) / mean(lean, (r) => r.good)).toBeLessThan(0.03)
  })

  it('starves the tools when fewer lots than sets are in the system', () => {
    const r = runLots(plan({ toolsPerLot: 2, depth: 2 }), 1)
    expect(timeSplit(r).starved).toBeGreaterThan(0.4)
    expect(mean(plan({ toolsPerLot: 2, depth: 2 }), (x) => x.busy)).toBeLessThan(0.55)
  })

  it('loses a quarter of the output to leftover tools with sets of three', () => {
    const three = mean(plan({ toolsPerLot: 3, depth: 2 }), (r) => r.busy)
    const four = mean(plan({ toolsPerLot: 4, depth: 2 }), (r) => r.busy)
    expect(three).toBeLessThan(four - 0.15)
    expect(timeSplit(runLots(plan({ toolsPerLot: 3, depth: 2 }), 1)).unused).toBe(0.25)
  })

  it('wastes capacity at the tail of a lot that does not fill its tools in whole rounds', () => {
    const even = { ...plan({ size: 600, toolsPerLot: 8, depth: 1 }) }
    const speeds = SPEEDS.map(() => 25)
    // 600 wafers on eight tools is 1.5 rounds of full loads: two rounds' time for 75% of the work.
    expect(runLots(even, 1, speeds).busy).toBeGreaterThan(0.7)
    expect(runLots(even, 1, speeds).busy).toBeLessThan(0.8)
    expect(runLots({ ...even, size: 800 }, 1, speeds).busy).toBeGreaterThan(0.9)
  })

  it('moves the wait to the big lots, not away, when the shortest go first', () => {
    const first = plan({ size: 'mixed', toolsPerLot: 4, depth: 4, order: 'first' })
    const shortest = { ...first, order: 'shortest' as const }
    const sum = (p: LotPlan, size: number) => mean(p, (r) => r.cycleBySize[size] ?? 0)
    expect(sum(shortest, 600)).toBeLessThan(sum(first, 600) * 0.6)
    expect(sum(shortest, 2400)).toBeGreaterThan(sum(first, 2400) * 1.1)
    expect(Math.abs(mean(shortest, (r) => r.cycleHours) - mean(first, (r) => r.cycleHours)) / mean(first, (r) => r.cycleHours)).toBeLessThan(0.1)
  })
})

describe('the mission', () => {
  it('is won by small lots, several tools to a lot, and only as many lots as there are sets', () => {
    expect(wins(plan({ size: 1200, toolsPerLot: 4, depth: 2 }))).toBeGreaterThanOrEqual(0.8)
    expect(wins(plan({ size: 600, toolsPerLot: 2, depth: 4 }))).toBeGreaterThanOrEqual(0.8)
    expect(wins(plan({ size: 1500, toolsPerLot: 4, depth: 2 }))).toBeGreaterThanOrEqual(0.5)
  })

  it('is lost by crowding the system, by big lots, and by sets that waste tools', () => {
    expect(wins(plan({ size: 1200, toolsPerLot: 4, depth: 6 }))).toBe(0)
    expect(wins(plan({ size: 2400, toolsPerLot: 4, depth: 2 }))).toBe(0)
    expect(wins(plan({ size: 1200, toolsPerLot: 3, depth: 2 }))).toBe(0)
    expect(wins(plan({ size: 1200, toolsPerLot: 8, depth: 1 }))).toBe(0)
    expect(wins(plan({ size: 600, toolsPerLot: 2, depth: 2 }))).toBe(0)
    expect(wins(LOT_ROUND.start)).toBe(0)
  })

  it('gives advice that names the cause', () => {
    const advise = (p: LotPlan) => lotAdvice(runLots(p, LOT_ROUND.day))
    expect(advise(plan({ toolsPerLot: 3 }))).toMatch(/in no set/)
    expect(advise(plan({ toolsPerLot: 2, depth: 2 }))).toMatch(/no lot to run/)
    expect(advise(plan({ size: 600, toolsPerLot: 8, depth: 1 }))).toMatch(/multiple of 50/)
    expect(advise(plan({ depth: 6 }))).toMatch(/Keep only as many lots/)
    expect(advise(plan({ size: 2400 }))).toMatch(/smaller/)
    expect(advise(plan({ size: 1200 }))).toBe('Mission done.')
  })
})

describe('hot lots', () => {
  const hot = (p: Partial<LotPlan>): LotPlan => ({ size: 600, toolsPerLot: 2, depth: 6, order: 'hot', hot: 0.25, reserve: false, ...p })
  const hotWins = (p: LotPlan) => SEEDS.filter((s) => judgeHot(runLots(p, s)).passed).length / SEEDS.length
  const stat = (p: LotPlan, pick: (r: ReturnType<typeof runLots>) => number) => mean(p, pick)

  it('arrive on top of the lots kept in the system, at about the share of capacity asked for', () => {
    const r = runLots(hot({}), 3)
    const hotLots = r.lots.filter((l) => l.hot)
    expect(hotLots.length / 14).toBeGreaterThan(hotLotsPerDay(hot({})) * 0.7)
    expect(hotLots.length / 14).toBeLessThan(hotLotsPerDay(hot({})) * 1.3)
    // Lots in the system stay at the depth: finished hot lots are not replaced.
    const regular = r.lots.filter((l) => !l.hot)
    expect(regular.filter((l) => l.end === null).length).toBe(6)
    expect(runLots(hot({ hot: 0 }), 3).lots.some((l) => l.hot)).toBe(false)
  })

  it('miss their promise with no priority, and keep it when they go first', () => {
    const first = hot({ order: 'first' })
    expect(stat(first, (r) => r.promises.hot.onTime)).toBeLessThan(0.3)
    expect(stat(hot({}), (r) => r.promises.hot.onTime)).toBeGreaterThan(0.85)
    expect(stat(hot({}), (r) => r.promises.hot.cycleHours)).toBeLessThan(stat(first, (r) => r.promises.hot.cycleHours) * 0.8)
  })

  it('are sped up by going first, at a small cost to the other lots', () => {
    const first = hot({ order: 'first', hot: 0.4 })
    const priority = hot({ hot: 0.4 })
    expect(stat(priority, (r) => r.promises.normal.cycleHours)).toBeGreaterThanOrEqual(stat(first, (r) => r.promises.normal.cycleHours))
    expect(stat(priority, (r) => r.promises.normal.cycleHours)).toBeLessThan(stat(first, (r) => r.promises.normal.cycleHours) * 1.15)
    expect(stat(priority, (r) => r.promises.hot.cycleHours)).toBeLessThan(stat(first, (r) => r.promises.hot.cycleHours) * 0.6)
  })

  it('cannot interrupt a lot being run out, so big lots break the promise even first in line', () => {
    expect(stat(hot({ size: 2400, toolsPerLot: 4, depth: 4 }), (r) => r.promises.hot.onTime)).toBeLessThan(0.1)
    expect(stat(hot({ size: 1200, toolsPerLot: 4, depth: 4 }), (r) => r.promises.hot.onTime)).toBeLessThan(0.9)
    expect(stat(hot({ size: 600, toolsPerLot: 4, depth: 4 }), (r) => r.promises.hot.onTime)).toBeGreaterThan(0.95)
  })

  it('are made quick by a reserved set, at the cost of the capacity it leaves idle', () => {
    const big = hot({ size: 1200, toolsPerLot: 4, depth: 4, hot: 0.1 })
    const reserved = { ...big, reserve: true }
    expect(stat(reserved, (r) => r.promises.hot.onTime)).toBeGreaterThan(stat(big, (r) => r.promises.hot.onTime) + 0.2)
    expect(stat(reserved, (r) => r.busy)).toBeLessThan(stat(big, (r) => r.busy) - 0.2)
    expect(timeSplit(runLots(reserved, 1)).starved).toBeGreaterThan(0.2)
  })

  it('make the mission winnable with small lots and priority, and not otherwise', () => {
    expect(hotWins(hot({}))).toBeGreaterThanOrEqual(0.6)
    expect(hotWins(hot({ toolsPerLot: 4, depth: 4 }))).toBeGreaterThanOrEqual(0.6)
    expect(hotWins(hot({ order: 'first' }))).toBe(0)
    expect(hotWins(hot({ size: 2400, toolsPerLot: 4, depth: 4 }))).toBe(0)
    expect(hotWins(hot({ size: 1200, toolsPerLot: 4, depth: 4, reserve: true, hot: 0.25 }))).toBe(0)
    expect(hotWins(HOT_ROUND.start)).toBe(0)
    expect(hotWins(hot({ hot: 0 }))).toBe(0)
  })

  it('gives advice that names the cause', () => {
    const advise = (p: LotPlan) => hotAdvice(runLots(p, HOT_ROUND.day))
    expect(advise(hot({ order: 'first' }))).toMatch(/waited their turn/)
    expect(advise(hot({ size: 2400, toolsPerLot: 4, depth: 4 }))).toMatch(/interrupt/)
    expect(advise(hot({ hot: 0 }))).toMatch(/Hardly any hot lots/)
    expect(advise(hot({}))).toBe('Mission done.')
  })
})
