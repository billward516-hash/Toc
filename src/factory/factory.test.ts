import { describe, expect, it } from 'vitest'
import { cases, csv } from './cases.ts'
import { cleanFactory, EXAMPLE, type Factory } from './model.ts'
import { verdict } from './words.ts'
import { analyze, curve, effectiveRate, measure, reach, runFactory, startsFor, stepHours, whatIf } from './sim.ts'

const one = (patch: Partial<Factory['steps'][number]>, f: Factory = EXAMPLE): Factory => ({ ...f, steps: f.steps.map((s, i) => (i === 1 ? { ...s, ...patch } : s)) })
const load = (f: Factory, share: number): Factory => ({ ...f, demand: share * analyze(f).capacity })

describe('how long a step takes', () => {
  const whole = { name: 'A', tools: 4, rate: 25, load: 25, divided: false }

  it('shares an order among the whole fleet, in runs that take the same time however full', () => {
    // 400 units on four tools taking 25 a run: 4 runs of an hour each across the fleet, one round.
    expect(stepHours(whole, 400)).toBe(4)
    expect(stepHours(whole, 100)).toBe(1)
    // 101 units need a second round for one tool, so the whole fleet waits a second hour.
    expect(stepHours(whole, 101)).toBe(2)
    expect(effectiveRate(whole, 400)).toBeCloseTo(100)
    expect(effectiveRate(whole, 101)).toBeLessThan(100)
  })

  it('puts a divided order on one tool', () => {
    const divided = { ...whole, divided: true }
    expect(stepHours(divided, 100)).toBe(4)
    // Four orders run at once, one on each tool.
    expect(effectiveRate(divided, 100)).toBeCloseTo(100)
  })

  it('starts more units to get the good ones asked for', () => {
    expect(startsFor(900, 90)).toBe(1000)
    expect(startsFor(100, 100)).toBe(100)
  })
})

describe('the bottleneck', () => {
  it('is the step with the most of its time taken, and capacity is its pace', () => {
    const a = analyze(EXAMPLE)
    const busiest = Math.max(...a.steps.map((s) => s.utilization))
    expect(a.steps[a.bottleneck].utilization).toBe(busiest)
    expect(a.steps[a.bottleneck].bottleneck).toBe(true)
    expect(a.load).toBeCloseTo(busiest, 6)
    expect(a.overloaded).toBe(false)
  })

  it('moves when the bottleneck gets a tool, and capacity then rises only to the next one', () => {
    const before = analyze(EXAMPLE)
    const faster = analyze(one({ tools: EXAMPLE.steps[before.bottleneck].tools + 5 }, { ...EXAMPLE, steps: EXAMPLE.steps }))
    const target = EXAMPLE.steps.map((s, i) => (i === before.bottleneck ? { ...s, tools: s.tools + 5 } : s))
    const after = analyze({ ...EXAMPLE, steps: target })
    expect(after.capacity).toBeGreaterThan(before.capacity)
    expect(after.bottleneck).not.toBe(before.bottleneck)
    expect(faster.steps.length).toBe(before.steps.length)
  })

  it('tags every step about as slow as the slowest', () => {
    const level: Factory = { ...EXAMPLE, steps: EXAMPLE.steps.map((s) => ({ ...s, tools: 3, rate: 30, load: 1, divided: false })) }
    expect(analyze(level).bottlenecks).toHaveLength(level.steps.length)
    expect(analyze(EXAMPLE).bottlenecks.length).toBeLessThan(EXAMPLE.steps.length)
  })

  it('flags demand past capacity', () => {
    expect(analyze(load(EXAMPLE, 1.1)).overloaded).toBe(true)
    expect(analyze(load(EXAMPLE, 0.9)).overloaded).toBe(false)
  })

  it('asks for more units started when yield is low', () => {
    const lossy = analyze({ ...EXAMPLE, yieldPct: 60 })
    expect(lossy.load).toBeGreaterThan(analyze(EXAMPLE).load * 1.3)
  })
})

describe('cycle time', () => {
  it('is deterministic, and at least the work in an order', () => {
    const a = measure(EXAMPLE)
    expect(measure(EXAMPLE)).toEqual(a)
    expect(a.cycle).toBeGreaterThanOrEqual(a.working - 1e-9)
    expect(a.working).toBeGreaterThan(0)
    expect(a.waits).toHaveLength(EXAMPLE.steps.length)
  })

  it('stays near the work time when the factory is quiet and climbs steeply near capacity', () => {
    const quiet = measure(load(EXAMPLE, 0.3))
    const busy = measure(load(EXAMPLE, 0.9))
    const full = measure(load(EXAMPLE, 1.05))
    expect(quiet.waiting).toBeLessThan(quiet.working * 0.4)
    expect(busy.cycle).toBeGreaterThan(quiet.cycle * 1.4)
    expect(full.cycle).toBeGreaterThan(busy.cycle * 1.5)
  })

  it('rises as demand rises, and as variation does', () => {
    const points = curve(EXAMPLE)
    for (let i = 1; i < points.length; i++) expect(points[i].cycle).toBeGreaterThanOrEqual(points[i - 1].cycle * 0.98)
    const steady = measure(load({ ...EXAMPLE, variation: 'low' }, 0.9)).cycle
    const wild = measure(load({ ...EXAMPLE, variation: 'high' }, 0.9)).cycle
    expect(wild).toBeGreaterThan(steady)
  })

  it('is longer with bigger orders, which hold every step longer', () => {
    const small = measure({ ...EXAMPLE, sizeMin: 50, sizeMax: 100, demand: 1000 })
    const big = measure({ ...EXAMPLE, sizeMin: 500, sizeMax: 1000, demand: 1000 })
    expect(big.cycle).toBeGreaterThan(small.cycle * 2)
  })

  it('waits most in front of the bottleneck', () => {
    const f = load(EXAMPLE, 0.92)
    const m = measure(f)
    const a = analyze(f)
    expect(m.waits[a.bottleneck]).toBe(Math.max(...m.waits))
  })
})

describe('what the factory can take for the cycle time wanted', () => {
  it('finds the most demand that still meets the target, and it falls as the target tightens', () => {
    const loose = reach({ ...EXAMPLE, target: 40 })
    const tight = reach({ ...EXAMPLE, target: 20 })
    expect(loose.demand).not.toBeNull()
    expect(tight.demand).not.toBeNull()
    expect(loose.demand!).toBeGreaterThan(tight.demand!)
    const f = { ...EXAMPLE, target: 40, demand: loose.demand! }
    expect(measure(f, f.demand, 4).cycle).toBeLessThanOrEqual(40 * 1.05)
  })

  it('says so when even an empty factory is slower than wanted', () => {
    const r = reach({ ...EXAMPLE, target: 0.5 })
    expect(r.demand).toBeNull()
    expect(r.floor).toBeGreaterThan(0.5)
  })

  it('is not met at capacity: the knee comes before it', () => {
    const r = reach({ ...EXAMPLE, target: 40 })
    expect(r.load!).toBeLessThan(1)
  })
})

describe('what one more tool does', () => {
  it('helps most at the bottleneck, and little elsewhere', () => {
    // Tools that work one unit at a time, so one more always shortens the runs.
    const continuous: Factory = { ...EXAMPLE, steps: EXAMPLE.steps.map((s) => ({ ...s, load: 1, divided: false })) }
    const f = load(continuous, 0.93)
    const a = analyze(f)
    const tries = whatIf(f)
    const best = tries.reduce((x, y) => (y.saved > x.saved ? y : x))
    expect(best.step).toBe(a.bottleneck)
    expect(best.saved).toBeGreaterThan(0)
    expect(tries[best.step].capacity).toBeGreaterThan(a.capacity)
    const others = tries.filter((t) => t.step !== a.bottleneck && !a.bottlenecks.includes(t.step))
    for (const t of others) expect(t.capacity).toBeCloseTo(a.capacity, 6)
  })
})

describe('a factory kept on the device', () => {
  it('comes back as it went, and anything odd is thrown away', () => {
    expect(cleanFactory(JSON.parse(JSON.stringify(EXAMPLE)))).toEqual(EXAMPLE)
    expect(cleanFactory(null)).toBeNull()
    expect(cleanFactory({ ...EXAMPLE, steps: [] })).toBeNull()
    expect(cleanFactory({ ...EXAMPLE, yieldPct: 0 })).toBeNull()
    expect(cleanFactory({ ...EXAMPLE, sizeMax: 5 })).toBeNull()
    expect(cleanFactory({ ...EXAMPLE, variation: 'wild' })).toBeNull()
    expect(cleanFactory({ ...EXAMPLE, steps: [{ ...EXAMPLE.steps[0], tools: 1.5 }] })).toBeNull()
    expect(cleanFactory({ ...EXAMPLE, steps: [{ ...EXAMPLE.steps[0], name: 'x'.repeat(41) }] })).toBeNull()
  })

  it('runs in a few milliseconds, so results can follow every keystroke', () => {
    const start = performance.now()
    for (let i = 0; i < 20; i++) runFactory(EXAMPLE, EXAMPLE.demand, i + 1)
    expect((performance.now() - start) / 20).toBeLessThan(25)
  })
})

describe('part-full runs', () => {
  it('can make one more tool useless until it saves a whole round', () => {
    const step = { name: 'A', tools: 4, rate: 25, load: 25, divided: false }
    // 278 units: three rounds of 100, and with five tools (125 a round) still three.
    expect(stepHours(step, 278)).toBe(stepHours({ ...step, tools: 5 }, 278))
    expect(stepHours({ ...step, tools: 6 }, 278)).toBeLessThan(stepHours(step, 278))
  })
})

describe('the words', () => {
  const words = (f: Factory) => {
    const a = analyze(f)
    const m = measure(f)
    return verdict(f, a, m, reach(f, a.capacity), whatIf(f, m))
  }

  it('say the factory is within its cycle time when it is, and name the bottleneck', () => {
    const v = words(EXAMPLE)
    expect(v.tone).toBe('ok')
    expect(v.headline).toContain('On target')
    expect(v.lines[0]).toContain('Process is the bottleneck')
  })

  it('say when it is over, and when it is over capacity', () => {
    expect(words(load({ ...EXAMPLE, target: 14 }, 0.9)).tone).not.toBe('ok')
    const over = words(load(EXAMPLE, 1.2))
    expect(over.tone).toBe('bad')
    expect(over.headline).toContain('Over capacity')
    expect(over.lines.join(' ')).toContain('without end')
  })

  it('say when the work itself is slower than wanted, and when several steps are bottlenecks', () => {
    const v = words({ ...EXAMPLE, target: 1 })
    expect(v.lines.join(' ')).toContain('nearly empty factory')
    const level: Factory = { ...EXAMPLE, steps: EXAMPLE.steps.map((s) => ({ ...s, tools: 3, rate: 30, load: 1, divided: false })) }
    expect(words(load(level, 0.8)).lines[0]).toContain('all about as slow')
  })
})

describe('counting per week', () => {
  const week: Factory = { ...EXAMPLE, perWeek: true, weekDays: 5 }

  it('speak in weeks, and multiply the day numbers by the days in the week', () => {
    const a = analyze(week)
    const m = measure(week)
    const v = verdict(week, a, m, reach(week, a.capacity), whatIf(week, m))
    const text = v.lines.join(' ')
    expect(text).toContain('a week')
    expect(text).not.toContain('a day')
    expect(text).toContain(Math.round(a.capacity * 5).toLocaleString('en-US'))
  })

  it('leave the cycle time alone, since demand is kept per day', () => {
    expect(measure(week).cycle).toBe(measure(EXAMPLE).cycle)
  })

  it('read a factory saved before weeks existed as per day, and keep a saved week', () => {
    const { perWeek, weekDays, ...old } = EXAMPLE
    expect(perWeek).toBe(false)
    expect(weekDays).toBe(7)
    expect(cleanFactory(old)).toEqual(EXAMPLE)
    expect(cleanFactory(JSON.parse(JSON.stringify(week)))).toEqual(week)
    expect(cleanFactory({ ...week, weekDays: 9 })?.weekDays).toBe(7)
  })
})

describe('too low, midpoint, too high', () => {
  const list = cases(EXAMPLE)
  const of = (group: string) => list.filter((c) => c.group === group)

  it('give three cases for demand and three for batch size, in order', () => {
    expect(of('Demand').map((c) => c.spot)).toEqual(['Too low', 'Midpoint', 'Too high'])
    expect(of('Batch size').map((c) => c.spot)).toEqual(['Too low', 'Midpoint', 'Too high'])
  })

  it('meet the cycle time wanted at too low and the midpoint but not too high', () => {
    const [low, mid, high] = of('Demand')
    expect(low.meets).toBe(true)
    expect(mid.meets).toBe(true)
    expect(high.meets).toBe(false)
    expect(low.demand).toBeLessThan(mid.demand)
    expect(mid.demand).toBeLessThan(high.demand)
    expect(low.cycle).toBeLessThanOrEqual(mid.cycle)
  })

  it('use the smallest, middle and largest batch at the demand asked for', () => {
    const [small, middle, large] = of('Batch size')
    expect([small.sizeMin, middle.sizeMin, large.sizeMin]).toEqual([100, 250, 400])
    expect(new Set([small.demand, middle.demand, large.demand])).toEqual(new Set([EXAMPLE.demand]))
  })

  it('write a spreadsheet with a header and a row for every case, in weeks when asked', () => {
    const lines = csv(EXAMPLE, list).trim().split('\r\n')
    expect(lines).toHaveLength(7)
    expect(lines[0]).toContain('Good units a day')
    const week: Factory = { ...EXAMPLE, perWeek: true, weekDays: 5 }
    expect(csv(week, cases(week))).toContain('Good units a week')
  })
})
