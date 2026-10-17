import { describe, expect, it } from 'vitest'
import { HOT_ROUND, hotAdvice, hotOrdersPerDay, judgeHot, judgeLots, LOT_ROUND, lotAdvice, lotSnapshotAt, staggerHours, timeSplit } from './lotRound.ts'
import { HORIZON, LOAD, MIN_LOAD, nextLoad, ORDER_SIZES, runLots, SPEEDS, START_FOR, sublotSizes, toolSets, type LotPlan } from './lots.ts'

const SEEDS = Array.from({ length: 12 }, (_, s) => s + 1)
const plan = (p: Partial<LotPlan>): LotPlan => ({ size: 'demand', toolsPerLot: 4, depth: 2, split: 1, order: 'first', ...p })
const mean = (plan: LotPlan, pick: (r: ReturnType<typeof runLots>) => number) => SEEDS.reduce((sum, s) => sum + pick(runLots(plan, s)), 0) / SEEDS.length
const wins = (p: LotPlan) => SEEDS.filter((s) => judgeLots(runLots(p, s)).passed).length / SEEDS.length
const hotWins = (p: LotPlan) => SEEDS.filter((s) => judgeHot(runLots(p, s)).passed).length / SEEDS.length

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

  it('cut an order into sublots that add up to it', () => {
    for (const size of ORDER_SIZES) {
      for (let split = 1; split <= 4; split++) {
        const parts = sublotSizes(size, split)
        expect(parts).toHaveLength(split)
        expect(parts.reduce((a, b) => a + b, 0)).toBe(size)
        expect(parts.every((p) => p % LOAD === 0)).toBe(true)
      }
    }
  })
})

describe('the order simulation', () => {
  it('is deterministic and keeps the books', () => {
    const a = runLots(plan({}), 3)
    expect(runLots(plan({}), 3)).toEqual(a)
    const split = timeSplit(a)
    expect(split.running + split.tail + split.starved + split.unused).toBeCloseTo(1, 6)
    expect(a.busy).toBeCloseTo(split.running, 6)
    // Orders in the system never differ from the depth.
    expect(a.orders.filter((o) => o.end === null).length).toBe(2)
    expect(a.orders.every((o) => ORDER_SIZES.includes(o.size))).toBe(true)
  })

  it('ships an order only when its last sublot is done, and runs each sublot on its own set', () => {
    const r = runLots(plan({ toolsPerLot: 2, depth: 3, split: 3 }), 1)
    const runs = r.events.filter((e) => e.type === 'run')
    for (const order of r.orders.filter((o) => o.end !== null)) {
      const parts = order.sublots.map((id) => r.lots[id])
      expect(order.end).toBe(Math.max(...parts.map((p) => p.end ?? Infinity)))
      expect(parts.reduce((sum, p) => sum + p.size, 0)).toBe(order.started)
    }
    for (const lot of r.lots.filter((l) => l.end !== null)) {
      const own = runs.filter((e) => e.lot === lot.id)
      expect(own.reduce((sum, e) => sum + e.wafers, 0)).toBe(lot.size)
      expect(own.every((e) => r.groups[lot.group ?? 0].includes(e.tool))).toBe(true)
    }
    for (let tool = 0; tool < 8; tool++) {
      const own = runs.filter((e) => e.tool === tool).sort((a, b) => a.t - b.t)
      for (let i = 1; i < own.length; i++) expect(own[i].t).toBeGreaterThanOrEqual(own[i - 1].end - 1e-9)
    }
  })

  it('matches the snapshot to the log', () => {
    const r = runLots(plan({ toolsPerLot: 2, depth: 4, split: 2 }), 2)
    const end = lotSnapshotAt(r, HORIZON, 8)
    expect(end.finished).toBe(r.finished)
    expect(end.wafers).toBe(r.wafers)
    expect(end.busy).toBeCloseTo(r.busy, 6)
    const held = r.lots.filter((l) => l.end !== null && r.orders[l.order].end === null).reduce((sum, l) => sum + l.size, 0)
    expect(end.held).toBe(held)
    const mid = lotSnapshotAt(r, HORIZON / 2, 8)
    expect(mid.held).toBeGreaterThanOrEqual(0)
  })
})

describe('what the lab teaches about orders', () => {
  it('has cycle time follow the orders in the system, not the output', () => {
    const lean = plan({ depth: 2 })
    const heavy = plan({ depth: 8 })
    expect(mean(heavy, (r) => r.cycleHours)).toBeGreaterThan(mean(lean, (r) => r.cycleHours) * 3)
    expect(Math.abs(mean(heavy, (r) => r.good) - mean(lean, (r) => r.good)) / mean(lean, (r) => r.good)).toBeLessThan(0.03)
  })

  it('starves the tools when fewer orders than sets are in the system', () => {
    const p = plan({ toolsPerLot: 2, depth: 1 })
    expect(timeSplit(runLots(p, 1)).starved).toBeGreaterThan(0.6)
    expect(mean(p, (r) => r.busy)).toBeLessThan(0.3)
  })

  it('loses a quarter of the tools to sets of three', () => {
    const three = mean(plan({ toolsPerLot: 3 }), (r) => r.busy)
    const four = mean(plan({ toolsPerLot: 4 }), (r) => r.busy)
    expect(three).toBeLessThan(four - 0.15)
    expect(timeSplit(runLots(plan({ toolsPerLot: 3 }), 1)).unused).toBe(0.25)
  })

  it('wastes capacity at the tail of a sublot that does not fill its tools in whole rounds', () => {
    const speeds = SPEEDS.map(() => 25)
    const even = plan({ size: 600, toolsPerLot: 8, depth: 1 })
    // 600 wafers on eight tools is 1.5 rounds of full loads: two rounds' time for 75% of the work.
    expect(runLots(even, 1, speeds).busy).toBeGreaterThan(0.7)
    expect(runLots(even, 1, speeds).busy).toBeLessThan(0.8)
    expect(runLots({ ...even, size: 800 }, 1, speeds).busy).toBeGreaterThan(0.9)
  })

  it('gains nothing from cutting an order into sublots that start at different times', () => {
    const whole = plan({ toolsPerLot: 4, depth: 2, split: 1 })
    const cut = { ...whole, split: 4 }
    expect(mean(cut, (r) => r.cycleHours)).toBeGreaterThan(mean(whole, (r) => r.cycleHours))
    expect(mean(cut, (r) => r.busy)).toBeLessThan(mean(whole, (r) => r.busy) - 0.05)
    const staggered = runLots({ ...whole, toolsPerLot: 2, depth: 4, split: 4 }, 1)
    expect(staggerHours(staggered)).toBeGreaterThan(1)
    // Finished sublots sit on the shelf waiting for the rest of their order.
    expect(Math.max(...Array.from({ length: 20 }, (_, k) => lotSnapshotAt(staggered, (k + 1) * 1000, 8).held))).toBeGreaterThan(0)
  })

  it('helps only when the sublots can all run at once', () => {
    const alone = plan({ toolsPerLot: 2, depth: 1 })
    expect(mean({ ...alone, split: 4 }, (r) => r.cycleHours)).toBeLessThan(mean(alone, (r) => r.cycleHours) * 0.5)
    expect(staggerHours(runLots({ ...alone, split: 4 }, 1))).toBeLessThan(0.5)
  })

  it('moves the wait to the big orders, not away, when the shortest go first', () => {
    const first = plan({ toolsPerLot: 4, depth: 4 })
    const shortest = { ...first, order: 'shortest' as const }
    const by = (p: LotPlan, size: number) => mean(p, (r) => r.cycleBySize[size] ?? 0)
    expect(by(shortest, 600)).toBeLessThan(by(first, 600) * 0.7)
    expect(by(shortest, 2400)).toBeGreaterThan(by(first, 2400) * 1.1)
    expect(Math.abs(mean(shortest, (r) => r.cycleHours) - mean(first, (r) => r.cycleHours)) / mean(first, (r) => r.cycleHours)).toBeLessThan(0.1)
  })
})

describe('full orders', () => {
  it('ship with at least the good wafers ordered, never short', () => {
    for (const startFor of START_FOR) {
      const r = runLots(plan({ toolsPerLot: 4, depth: 3, startFor }), 4)
      const shipped = r.orders.filter((o) => o.end !== null)
      expect(shipped.length).toBeGreaterThan(20)
      for (const o of shipped) expect(o.started * o.yield).toBeGreaterThanOrEqual(o.size - 1e-6)
      expect(r.good).toBe(shipped.reduce((sum, o) => sum + o.size, 0))
    }
  })

  it('start more wafers than ordered, for the yield the plan hopes for', () => {
    const r = runLots(plan({ startFor: 0.69 }), 1)
    for (const o of r.orders.filter((o) => o.topUps === 0)) expect(o.started).toBeGreaterThanOrEqual(o.size / 0.69)
    expect(r.orders.filter((o) => o.end !== null).every((o) => o.started >= o.size / 0.85)).toBe(true)
  })

  it('need no top-up when started for the worst yield, and a top-up for most orders when started for the best', () => {
    expect(mean(plan({ startFor: 0.69 }), (r) => r.shortShare)).toBe(0)
    expect(mean(plan({ startFor: 0.77 }), (r) => r.shortShare)).toBeGreaterThan(0.3)
    expect(mean(plan({ startFor: 0.85 }), (r) => r.shortShare)).toBeGreaterThan(0.75)
    expect(mean(plan({ startFor: 0.69 }), (r) => r.surplus)).toBeGreaterThan(mean(plan({ startFor: 0.85 }), (r) => r.surplus) * 10)
  })

  it('run a top-up as one more small sublot of the order, which then ships when it is done', () => {
    const r = runLots(plan({ startFor: 0.85 }), 2)
    const shortOrder = r.orders.find((o) => o.topUps > 0 && o.end !== null)!
    expect(shortOrder.sublots.length).toBe(2)
    const [first, topUp] = shortOrder.sublots.map((id) => r.lots[id])
    expect(topUp.size).toBeLessThan(first.size)
    expect(shortOrder.end).toBe(Math.max(first.end ?? 0, topUp.end ?? 0))
  })

  it('ship more wafers when started for a better yield, on sets that run top-ups well, and not on all eight tools', () => {
    expect(mean(plan({ startFor: 0.85 }), (r) => r.good)).toBeGreaterThan(mean(plan({ startFor: 0.69 }), (r) => r.good) + 2000)
    expect(mean(plan({ toolsPerLot: 8, depth: 1, startFor: 0.85 }), (r) => r.busy)).toBeLessThan(mean(plan({ toolsPerLot: 8, depth: 1, startFor: 0.69 }), (r) => r.busy) - 0.05)
  })
})

describe('the order mission', () => {
  const whole = (p: Partial<LotPlan>) => plan({ toolsPerLot: 8, depth: 1, startFor: 0.69, ...p })

  it('is won by the whole fleet on one order at a time, started for the worst yield', () => {
    expect(wins(whole({}))).toBeGreaterThanOrEqual(0.7)
    expect(wins(whole({ depth: 2 }))).toBeGreaterThanOrEqual(0.5)
  })

  it('is lost by queueing orders, by dividing the workgroup, and by cutting orders for nothing', () => {
    expect(wins(LOT_ROUND.start)).toBe(0)
    expect(wins(whole({ depth: 4 }))).toBe(0)
    expect(wins(whole({ toolsPerLot: 1, depth: 8 }))).toBe(0)
    expect(wins(whole({ toolsPerLot: 1, depth: 4, split: 4 }))).toBe(0)
    expect(wins(whole({ split: 4 }))).toBe(0)
  })

  it('shows what dividing buys and costs: more shipped, much longer orders', () => {
    const divided = whole({ toolsPerLot: 1, depth: 8, startFor: 0.85 })
    expect(mean(divided, (r) => r.busy)).toBeGreaterThan(0.97)
    expect(mean(divided, (r) => r.good)).toBeGreaterThan(mean(whole({}), (r) => r.good) * 1.05)
    expect(mean(divided, (r) => r.cycleHours)).toBeGreaterThan(mean(whole({}), (r) => r.cycleHours) * 4)
  })

  it('has top-ups waste the whole fleet, so the worst yield suits it, and a hopeful start suits single tools', () => {
    expect(mean(whole({ startFor: 0.85 }), (r) => r.busy)).toBeLessThan(mean(whole({}), (r) => r.busy) - 0.05)
    const single = (y: number) => whole({ toolsPerLot: 1, depth: 8, startFor: y })
    expect(mean(single(0.85), (r) => r.good)).toBeGreaterThan(mean(single(0.69), (r) => r.good) + 3000)
  })

  it('gives advice that names the cause', () => {
    const advise = (p: LotPlan) => lotAdvice(runLots(p, LOT_ROUND.day))
    expect(advise(whole({ toolsPerLot: 3, depth: 2 }))).toMatch(/in no set/)
    expect(advise(whole({ toolsPerLot: 1, depth: 3 }))).toMatch(/no sublot to run/)
    expect(advise(whole({ toolsPerLot: 1, depth: 8 }))).toMatch(/Dividing the workgroup/)
    expect(advise(whole({ depth: 4 }))).toMatch(/always waiting/)
    expect(advise(whole({ split: 4 }))).toMatch(/idle while the others|hours apart/)
    expect(advise(whole({}))).toBe('Mission done.')
  })
})

describe('hot orders', () => {
  const hot = (p: Partial<LotPlan>): LotPlan => ({ size: 'demand', toolsPerLot: 8, depth: 2, split: 1, order: 'hot', hot: 0.15, reserve: false, ...p })
  const stat = (p: LotPlan, pick: (r: ReturnType<typeof runLots>) => number) => mean(p, pick)

  it('arrive on top of the orders kept in the system, at about the share of capacity asked for', () => {
    const r = runLots(hot({}), 3)
    const hotOrders = r.orders.filter((o) => o.hot)
    expect(hotOrders.length / 14).toBeGreaterThan(hotOrdersPerDay(hot({})) * 0.6)
    expect(hotOrders.length / 14).toBeLessThan(hotOrdersPerDay(hot({})) * 1.4)
    expect(r.orders.filter((o) => !o.hot && o.end === null).length).toBe(2)
    expect(runLots(hot({ hot: 0 }), 3).orders.some((o) => o.hot)).toBe(false)
  })

  it('miss their promise with no priority, and keep it when they go first', () => {
    const first = hot({ order: 'first' })
    expect(stat(first, (r) => r.promises.hot.onTime)).toBeLessThan(0.5)
    expect(stat(hot({}), (r) => r.promises.hot.onTime)).toBeGreaterThan(0.85)
    expect(stat(hot({}), (r) => r.promises.hot.cycleHours)).toBeLessThan(stat(first, (r) => r.promises.hot.cycleHours) * 0.7)
  })

  it('go faster at little cost to the other orders', () => {
    const first = hot({ order: 'first', depth: 3, hot: 0.25 })
    const priority = hot({ depth: 3, hot: 0.25 })
    expect(stat(priority, (r) => r.promises.normal.cycleHours)).toBeGreaterThanOrEqual(stat(first, (r) => r.promises.normal.cycleHours))
    expect(stat(priority, (r) => r.promises.normal.cycleHours)).toBeLessThan(stat(first, (r) => r.promises.normal.cycleHours) * 1.15)
  })

  it('cannot interrupt a sublot being run out, so small sets break the promise even first in line', () => {
    expect(stat(hot({ toolsPerLot: 2, depth: 4 }), (r) => r.promises.hot.onTime)).toBeLessThan(0.4)
    expect(stat(hot({ toolsPerLot: 4, depth: 4 }), (r) => r.promises.hot.onTime)).toBeLessThan(0.6)
    expect(stat(hot({ toolsPerLot: 8, depth: 2 }), (r) => r.promises.hot.onTime)).toBeGreaterThan(0.85)
  })

  it('are made quicker by a reserved set, at the cost of the capacity it leaves idle', () => {
    const base = hot({ toolsPerLot: 4, depth: 3, hot: 0.1 })
    const reserved = { ...base, reserve: true }
    expect(stat(reserved, (r) => r.promises.hot.onTime)).toBeGreaterThan(stat(base, (r) => r.promises.hot.onTime) + 0.15)
    expect(stat(reserved, (r) => r.busy)).toBeLessThan(stat(base, (r) => r.busy) - 0.2)
    expect(timeSplit(runLots(reserved, 1)).starved).toBeGreaterThan(0.2)
  })

  it('make the mission winnable with the whole fleet and priority, and not otherwise', () => {
    expect(hotWins(hot({ depth: 1 }))).toBeGreaterThanOrEqual(0.5)
    expect(hotWins(hot({ depth: 2 }))).toBeGreaterThanOrEqual(0.5)
    expect(hotWins(hot({ order: 'first' }))).toBe(0)
    expect(hotWins(hot({ toolsPerLot: 1, depth: 8 }))).toBe(0)
    expect(hotWins(HOT_ROUND.start)).toBe(0)
    expect(hotWins(hot({ hot: 0 }))).toBe(0)
  })

  it('gives advice that names the cause', () => {
    const advise = (p: LotPlan) => hotAdvice(runLots(p, HOT_ROUND.day))
    expect(advise(hot({ order: 'first' }))).toMatch(/waited their turn/)
    expect(advise(hot({ toolsPerLot: 1, depth: 8 }))).toMatch(/Dividing the workgroup/)
    expect(advise(hot({ toolsPerLot: 2, depth: 4 }))).toMatch(/interrupt|still waits/)
    expect(advise(hot({ hot: 0 }))).toMatch(/Hardly any hot orders/)
    expect(advise(hot({ depth: 1 }))).toBe('Mission done.')
  })
})
