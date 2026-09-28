import { describe, expect, it } from 'vitest'
import { validateModel } from '../engine/model.ts'
import { simulate } from '../engine/simulate.ts'
import {
  addStation,
  changeStation,
  cleanSetup,
  DEFAULT_SETUP,
  describeChanges,
  LIMITS,
  onPaper,
  releaseOfKind,
  removeStation,
  sameSetup,
  sandboxModel,
  slowest,
  stepped,
  type SandboxSetup,
} from './setup.ts'

const DAYS = Array.from({ length: 20 }, (_, i) => i + 1)
const withRelease = (release: SandboxSetup['release']): SandboxSetup => ({ ...DEFAULT_SETUP, release })

describe('the sandbox line', () => {
  it('builds a valid model for every way of starting work and every station setting', () => {
    const setups: SandboxSetup[] = [
      DEFAULT_SETUP,
      withRelease(releaseOfKind(DEFAULT_SETUP, 'rope')),
      withRelease(releaseOfKind(DEFAULT_SETUP, 'pace')),
      withRelease({ kind: 'rope', station: 0, length: 1 }),
      { stations: Array.from({ length: LIMITS.stations.max }, (_, i) => ({ minutes: 1 + i, variation: 'lots', machines: 3, jams: true })), release: { kind: 'busy' } },
      { stations: DEFAULT_SETUP.stations.slice(0, 2).map((s) => ({ ...s, variation: 'none' })), release: { kind: 'pace', every: 12 } },
    ]
    for (const setup of setups) expect(validateModel(sandboxModel(setup))).toEqual([])
  })

  it('turns each setting into the station it describes', () => {
    const setup = changeStation(DEFAULT_SETUP, 2, { minutes: 5, variation: 'lots', machines: 2, jams: true })
    const paint = sandboxModel(setup).stations[2]
    expect(paint).toMatchObject({ id: 'paint', name: 'Paint', cycleTime: { kind: 'uniform', min: 1.25, max: 8.75 }, servers: 2 })
    expect(paint.jams).toBeDefined()
    const cut = sandboxModel(changeStation(DEFAULT_SETUP, 0, { variation: 'none' })).stations[0]
    expect(cut).toEqual({ id: 'cut', name: 'Cut', cycleTime: { kind: 'fixed', value: 3 } })
    expect(sandboxModel(withRelease({ kind: 'rope', station: 2, length: 8 })).release).toEqual({ kind: 'rope', constraint: 'paint', buffer: 8 })
    expect(sandboxModel(withRelease({ kind: 'pace', every: 4 })).release).toEqual({ kind: 'interval', every: { kind: 'fixed', value: 4 } })
  })

  it('says what each station can make on paper', () => {
    expect(onPaper(DEFAULT_SETUP, 2)).toBeCloseTo(120)
    expect(onPaper(changeStation(DEFAULT_SETUP, 2, { machines: 2 }), 2)).toBeCloseTo(240)
    // Jams stop a station about 10 minutes in every 70.
    expect(onPaper(changeStation(DEFAULT_SETUP, 2, { jams: true }), 2)).toBeCloseTo((480 * 6) / 7 / 4)
    expect(slowest(DEFAULT_SETUP)).toBe(2)
    expect(slowest(changeStation(DEFAULT_SETUP, 2, { machines: 2 }))).toBe(0)
  })
})

// The line a player finds first shows the lessons of Tiers 0–3 when they experiment with it.
describe('the default line', () => {
  const busy = DAYS.map((day) => simulate(sandboxModel(DEFAULT_SETUP), day))

  it('piles work up in front of Paint alone when everyone is kept busy', () => {
    for (const day of busy) {
      expect(day.stations[2].avgQueue).toBeGreaterThan(10)
      for (const i of [0, 1, 3, 4]) expect(day.stations[i].avgQueue).toBeLessThan(1)
    }
  })

  it('ships just as many with a rope on Paint, with far less on the floor', () => {
    const rope = DAYS.map((day) => simulate(sandboxModel(withRelease(releaseOfKind(DEFAULT_SETUP, 'rope'))), day))
    rope.forEach((day, i) => {
      expect(day.output).toBe(busy[i].output)
      expect(day.avgWip).toBeLessThan(busy[i].avgWip / 1.5)
    })
  })

  it('loses nothing to jams at Cut, and many robots to jams at Paint', () => {
    DAYS.forEach((day, i) => {
      expect(simulate(sandboxModel(changeStation(DEFAULT_SETUP, 0, { jams: true })), day).output).toBe(busy[i].output)
      expect(simulate(sandboxModel(changeStation(DEFAULT_SETUP, 2, { jams: true })), day).output).toBeLessThan(busy[i].output - 5)
    })
  })
})

describe('changing the line', () => {
  it('steps values within their range and on the half minute', () => {
    expect(stepped(3, 1, LIMITS.minutes)).toBe(3.5)
    expect(stepped(1, -1, LIMITS.minutes)).toBe(1)
    expect(stepped(12, 1, LIMITS.minutes)).toBe(12)
    expect(stepped(3, 1, LIMITS.machines)).toBe(3)
    expect(stepped(1, 1, LIMITS.rope)).toBe(2)
  })

  it('adds and removes stations at the end of the line, within limits', () => {
    const six = addStation(DEFAULT_SETUP)
    expect(six.stations).toHaveLength(6)
    expect(addStation(six)).toBe(six)
    const two = removeStation(removeStation(removeStation(DEFAULT_SETUP)))
    expect(two.stations).toHaveLength(2)
    expect(removeStation(two)).toBe(two)
  })

  it('moves a rope tied to a removed station to the new last one', () => {
    const tied = withRelease({ kind: 'rope', station: 4, length: 10 })
    expect(removeStation(tied).release).toEqual({ kind: 'rope', station: 3, length: 10 })
    expect(removeStation(withRelease({ kind: 'rope', station: 2, length: 10 })).release).toEqual({ kind: 'rope', station: 2, length: 10 })
  })

  it('ties a new rope to the slowest station and paces work to it', () => {
    expect(releaseOfKind(DEFAULT_SETUP, 'rope')).toEqual({ kind: 'rope', station: 2, length: 10 })
    expect(releaseOfKind(DEFAULT_SETUP, 'pace')).toEqual({ kind: 'pace', every: 4 })
    // With jams, Paint finishes one about every 4.7 minutes: never start them faster than that.
    expect(releaseOfKind(changeStation(DEFAULT_SETUP, 2, { jams: true }), 'pace')).toEqual({ kind: 'pace', every: 5 })
    expect(releaseOfKind(DEFAULT_SETUP, 'busy')).toEqual({ kind: 'busy' })
  })

  it('describes what changed from one run to the next', () => {
    expect(describeChanges(DEFAULT_SETUP, DEFAULT_SETUP)).toEqual([])
    const after = changeStation(changeStation(DEFAULT_SETUP, 2, { minutes: 3, machines: 2 }), 0, { variation: 'lots', jams: true })
    expect(describeChanges(DEFAULT_SETUP, after)).toEqual(['Cut: lots of variation, jams', 'Paint: 3 min, 2 machines'])
    expect(describeChanges(DEFAULT_SETUP, addStation(DEFAULT_SETUP))).toEqual(['Added Pack: 3 min'])
    expect(describeChanges(DEFAULT_SETUP, removeStation(DEFAULT_SETUP))).toEqual(['Removed Box'])
    expect(describeChanges(DEFAULT_SETUP, withRelease({ kind: 'rope', station: 2, length: 10 }))).toEqual(['A rope of 10 to Paint'])
    expect(describeChanges(withRelease({ kind: 'pace', every: 4 }), withRelease({ kind: 'pace', every: 4.5 }))).toEqual(['One robot every 4.5 min'])
    const shaky = { ...DEFAULT_SETUP, stations: DEFAULT_SETUP.stations.map((s) => ({ ...s, variation: 'lots' as const })) }
    expect(describeChanges(DEFAULT_SETUP, shaky)).toEqual(['Every station: lots of variation'])
    expect(describeChanges(DEFAULT_SETUP, changeStation(shaky, 0, { variation: 'some' }))).toEqual([
      'Mold: lots of variation',
      'Paint: lots of variation',
      'Assemble: lots of variation',
      'Box: lots of variation',
    ])
  })

  it('tells whether two lines are the same', () => {
    expect(sameSetup(DEFAULT_SETUP, JSON.parse(JSON.stringify(DEFAULT_SETUP)))).toBe(true)
    expect(sameSetup(DEFAULT_SETUP, changeStation(DEFAULT_SETUP, 1, { jams: true }))).toBe(false)
    expect(sameSetup(DEFAULT_SETUP, addStation(DEFAULT_SETUP))).toBe(false)
    expect(sameSetup(withRelease({ kind: 'rope', station: 2, length: 10 }), withRelease({ kind: 'rope', station: 2, length: 11 }))).toBe(false)
  })
})

describe('a line kept on the device', () => {
  it('comes back as it was saved', () => {
    const setup = withRelease({ kind: 'rope', station: 1, length: 12 })
    expect(cleanSetup(JSON.parse(JSON.stringify(setup)))).toEqual(setup)
    expect(cleanSetup(JSON.parse(JSON.stringify(withRelease({ kind: 'pace', every: 6.5 }))))).toEqual(withRelease({ kind: 'pace', every: 6.5 }))
  })

  it('is refused when anything is out of place', () => {
    const station = DEFAULT_SETUP.stations[0]
    const bad: unknown[] = [
      null,
      'line',
      {},
      { stations: [station], release: { kind: 'busy' } },
      { stations: Array(7).fill(station), release: { kind: 'busy' } },
      { stations: [station, { ...station, minutes: 0.5 }], release: { kind: 'busy' } },
      { stations: [station, { ...station, minutes: 3.25 }], release: { kind: 'busy' } },
      { stations: [station, { ...station, machines: 4 }], release: { kind: 'busy' } },
      { stations: [station, { ...station, variation: 'wild' }], release: { kind: 'busy' } },
      { stations: [station, { ...station, jams: 'yes' }], release: { kind: 'busy' } },
      { stations: [station, station], release: { kind: 'rope', station: 2, length: 10 } },
      { stations: [station, station], release: { kind: 'rope', station: 1, length: 0 } },
      { stations: [station, station], release: { kind: 'pace', every: 13 } },
      { stations: [station, station], release: { kind: 'push' } },
    ]
    for (const value of bad) expect(cleanSetup(value)).toBeNull()
  })
})
