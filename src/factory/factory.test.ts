import { describe, expect, it } from 'vitest'
import { cases, csv } from './cases.ts'
import { recommend, ropeStudy, ropeWords } from './rope.ts'
import { endOf, frame } from './watch.ts'
import { need, tryRate } from './improve.ts'
import { cleanFactory, EXAMPLE, type Factory } from './model.ts'
import { verdict } from './words.ts'
import { analyze, curve, effectiveRate, measure, reach, runFactory, schedule, startsFor, stepHours, whatIf } from './sim.ts'

const one = (patch: Partial<Factory['steps'][number]>, f: Factory = EXAMPLE): Factory => ({ ...f, steps: f.steps.map((s, i) => (i === 1 ? { ...s, ...patch } : s)) })
const load = (f: Factory, share: number): Factory => ({ ...f, demand: share * analyze(f).capacity })

describe('how long a step takes', () => {
  const whole = { name: 'A', tools: 4, rate: 25, load: 25, divided: false, availability: 100 }

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
    const step = { name: 'A', tools: 4, rate: 25, load: 25, divided: false, availability: 100 }
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
    const { perWeek, weekDays, rope, ...old } = EXAMPLE
    expect(rope.on).toBe(false)
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

describe('watching a run', () => {
  const run = schedule(EXAMPLE, EXAMPLE.demand, 1, 60)

  it('puts every arrived order in exactly one place, and ships them all by the end', () => {
    for (const t of [0, 10, 50, 120, 200]) {
      const fr = frame(run, t)
      const placed = fr.waiting.flat().length + fr.working.flat().length + fr.held.length
      expect(placed + fr.shipped).toBe(fr.arrived)
    }
    const end = frame(run, endOf(run) + 1)
    expect(end.shipped).toBe(60)
    expect(end.waiting.flat().length + end.working.flat().length + end.held.length).toBe(0)
  })

  it('never has more orders at a whole-fleet step than one, and one a tool at a divided one', () => {
    for (let t = 0; t < endOf(run); t += 3) {
      const fr = frame(run, t)
      EXAMPLE.steps.forEach((step, s) => expect(fr.working[s].length).toBeLessThanOrEqual(step.divided ? step.tools : 1))
    }
  })

  it('agrees with the numbers: the average cycle time of the shipped orders is that of the run', () => {
    const end = frame(run, endOf(run) + 1)
    const last = EXAMPLE.steps.length - 1
    const mean = run.arrive.reduce((sum, a, k) => sum + run.done[last][k] - a, 0) / 60
    expect(end.cycle).toBeCloseTo(mean, 9)
  })
})

describe('drum, buffer, rope', () => {
  const roped = (buffer: number, issue = 10): Factory => ({ ...EXAMPLE, rope: { on: true, at: 0, buffer, issue } })

  it('tie an order to the one a buffer ahead of it at the bottleneck', () => {
    const f = roped(2)
    const run = schedule(f, f.demand, 1, 80, true)
    expect(run.ropeAt).toBe(0)
    for (let k = 2; k < 80; k++) expect(run.start[0][k]).toBeGreaterThanOrEqual(run.start[1][k - 2] - 1e-9)
    expect(run.held.some((h) => h > 0)).toBe(true)
  })

  it('leave the numbers alone when the rope is off, and the headline numbers alone when it is on', () => {
    expect(schedule(EXAMPLE, EXAMPLE.demand, 1, 40).ropeAt).toBeNull()
    expect(measure(roped(3)).cycle).toBe(measure(EXAMPLE).cycle)
  })

  it('keep the pile in front of the bottleneck to the buffer in a yield problem, where it grows without one', () => {
    const study = ropeStudy(roped(3, 25))
    expect(study).not.toBeNull()
    const { plain, roped: held } = study!.troubled
    expect(plain.inFront).toBeGreaterThan(10)
    expect(held.inFront).toBeLessThanOrEqual(3.5)
    expect(held.heldBack).toBeGreaterThan(plain.heldBack)
    expect(held.lineCycle).toBeLessThan(plain.lineCycle)
    expect(held.feederIdle).toBeGreaterThan(plain.feederIdle)
  })

  it('starve the bottleneck when the buffer is one and the line is uneven, and say so', () => {
    const f: Factory = load({ ...roped(1), variation: 'high' }, 0.93)
    const study = ropeStudy(f)!
    expect(study.normal.roped.bottleneckBusy).toBeLessThan(study.normal.plain.bottleneckBusy)
    expect(ropeWords(f, study).join(' ')).toContain('buffer is too small')
  })

  it('have nothing to idle when the bottleneck is the first workgroup', () => {
    const first = { ...roped(3), steps: EXAMPLE.steps.map((s, i) => (i === 0 ? { ...s, tools: 1, rate: 5 } : s)) }
    expect(ropeStudy(first)).toBeNull()
  })

  it('keep a saved rope, and clean a bad one', () => {
    const f = roped(4, 7)
    expect(cleanFactory(JSON.parse(JSON.stringify(f)))).toEqual(f)
    expect(cleanFactory({ ...f, rope: { on: true, at: 99, buffer: -3, issue: 'x' } })?.rope).toEqual({ on: true, at: 0, buffer: 3, issue: 10 })
  })

  it('recommend the smallest buffer that keeps the bottleneck as busy as it is without the rope', () => {
    const f = load(roped(3), 0.95)
    const advice = recommend(f)!
    expect(advice.buffer).toBeGreaterThanOrEqual(1)
    const tie = measure(f, f.demand, 6, false).busy[1]
    const at = (buffer: number) => measure({ ...f, rope: { ...f.rope, buffer } }, f.demand, 6, true).busy[1]
    expect(at(advice.buffer)).toBeGreaterThanOrEqual(tie - 0.015)
    if (advice.buffer > 1 && advice.because === 'your numbers') expect(at(advice.buffer - 1)).toBeLessThan(tie - 0.015)
    expect(advice.hours).toBeGreaterThan(0)
  })

  it('ask for a bigger buffer when the line is uneven and heavily loaded than when it is steady and light', () => {
    const light = recommend(load({ ...roped(3), variation: 'low' }, 0.6))!
    const heavy = recommend(load({ ...roped(3), variation: 'high' }, 0.95))!
    expect(heavy.buffer).toBeGreaterThan(light.buffer)
  })

  it('have nothing to recommend when nothing feeds the bottleneck', () => {
    const first = { ...roped(3), steps: EXAMPLE.steps.map((s, i) => (i === 0 ? { ...s, tools: 1, rate: 5 } : s)) }
    expect(recommend(first)).toBeNull()
  })
})

describe('what if: the speed a workgroup needs', () => {
  const hot = (demand: number): Factory => ({ ...EXAMPLE, demand })

  it('say the rate that just keeps up, which makes the workgroup exactly full', () => {
    const f = hot(1900)
    const bottleneck = analyze(f).bottleneck
    const n = need(f, bottleneck)
    const g = { ...f, steps: f.steps.map((s, i) => (i === bottleneck ? { ...s, rate: n.output.rate } : s)) }
    expect(analyze(g).steps[bottleneck].utilization).toBeCloseTo(1, 6)
  })

  it('ask for more speed when the demand is past what the workgroup can make, and for less when there is room', () => {
    expect(need(hot(2300), 1).output.more).toBeGreaterThan(0)
    expect(need(hot(1000), 1).output.more).toBeLessThan(0)
  })

  it('find a speed that meets the cycle time, and a trial at it agrees', () => {
    const f = hot(1900)
    const n = need(f, 1)
    expect(n.cycle).not.toBeNull()
    expect(n.cycle!.rate).toBeGreaterThanOrEqual(n.output.rate)
    expect(tryRate(f, 1, n.cycle!.rate).meetsCycle).toBe(true)
    expect(tryRate(f, 1, n.cycle!.rate * 0.9).meetsCycle).toBe(false)
  })

  it('say another workgroup is the limit when speeding this one up cannot do it', () => {
    const n = need(hot(2300), 1)
    expect(n.cycle).toBeNull()
    expect(n.limitedBy).not.toBeNull()
    expect(n.limitedBy).not.toBe('Process')
    expect(n.tools.cycle).toBeNull()
  })

  it('give the tools that keep up, at least the tools it has', () => {
    const n = need(hot(2300), 1)
    expect(n.tools.output).toBeGreaterThan(4)
    expect(analyze({ ...hot(2300), steps: EXAMPLE.steps.map((s, i) => (i === 1 ? { ...s, tools: n.tools.output } : s)) }).steps[1].utilization).toBeLessThanOrEqual(1)
  })
})

describe('availability', () => {
  const step = { name: 'A', tools: 4, rate: 25, load: 25, divided: false, availability: 100 }

  it('stretches the time a step takes by the share of the time it is down', () => {
    expect(stepHours({ ...step, availability: 80 }, 100)).toBeCloseTo(stepHours(step, 100) / 0.8, 9)
    expect(effectiveRate({ ...step, availability: 50 }, 100)).toBeCloseTo(effectiveRate(step, 100) / 2, 9)
  })

  it('lowers the capacity of the factory and lengthens the cycle time, with the bottleneck in the step that is down most', () => {
    const steady: Factory = { ...EXAMPLE, steps: EXAMPLE.steps.map((s) => ({ ...s, availability: 100 })) }
    expect(analyze(steady).capacity).toBeGreaterThan(analyze(EXAMPLE).capacity)
    expect(measure(steady).cycle).toBeLessThan(measure(EXAMPLE).cycle)
    const down = { ...steady, steps: steady.steps.map((s, i) => (i === 0 ? { ...s, availability: 40 } : s)) }
    expect(analyze(down).bottleneck).toBe(0)
  })

  it('reads a step saved before availability existed as always up, and rejects a bad one', () => {
    const { availability, ...old } = EXAMPLE.steps[0]
    expect(availability).toBe(96)
    const saved = { ...EXAMPLE, steps: [old, ...EXAMPLE.steps.slice(1)] }
    expect(cleanFactory(JSON.parse(JSON.stringify(saved)))?.steps[0].availability).toBe(100)
    expect(cleanFactory({ ...EXAMPLE, steps: [{ ...old, availability: 500 }, ...EXAMPLE.steps.slice(1)] })?.steps[0].availability).toBe(100)
  })

  it('say the availability a workgroup needs to keep up, or that none is enough', () => {
    const f: Factory = { ...EXAMPLE, demand: 1600 }
    const n = need(f, 1)
    expect(n.availability.now).toBe(90)
    expect(n.availability.cycle).toBeGreaterThan(90)
    expect(need({ ...EXAMPLE, demand: 3000 }, 1).availability.output).toBeNull()
    expect(need({ ...EXAMPLE, demand: 1800 }, 1).availability.cycle).toBeNull()
  })
})
