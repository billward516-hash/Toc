import type { Dist } from '../engine/distributions.ts'
import { capacity, type FactoryModel, type Release, type Station } from '../engine/model.ts'

// Free play (spec §3.4): a line the player builds from a few settings for each station, then runs,
// with nothing scored. Stations take their names and pictures from the robot factory of Tiers 0–3, in
// line order.
export const STEPS = [
  { id: 'cut', name: 'Cut' },
  { id: 'mold', name: 'Mold' },
  { id: 'paint', name: 'Paint' },
  { id: 'assemble', name: 'Assemble' },
  { id: 'box', name: 'Box' },
  { id: 'pack', name: 'Pack' },
]

export const SHIFT = 480

// How much a station's time changes from robot to robot around its average: not at all; a little, as
// in most levels (15% either way); or a lot, like Tier 2's die (from a quarter to 1.75 times the average).
export type Variation = 'none' | 'some' | 'lots'

export interface SandboxStation {
  // Average minutes one machine takes to make one robot.
  minutes: number
  variation: Variation
  // Identical machines side by side, each making robots at that pace.
  machines: number
  // Whether the station jams now and then: about once an hour, for 5 to 15 minutes.
  jams: boolean
}

// How new work starts: whenever the first station can take it; only while fewer than `length` robots
// are on their way to the station the rope is tied to; or one every `every` minutes, whatever happens.
export type SandboxRelease = { kind: 'busy' } | { kind: 'rope'; station: number; length: number } | { kind: 'pace'; every: number }

export interface SandboxSetup {
  stations: SandboxStation[]
  release: SandboxRelease
}

export interface Range {
  min: number
  max: number
  step: number
}

export const LIMITS = {
  stations: { min: 2, max: 6 },
  minutes: { min: 1, max: 12, step: 0.5 },
  machines: { min: 1, max: 3, step: 1 },
  rope: { min: 1, max: 40, step: 1 },
  pace: { min: 1, max: 12, step: 0.5 },
} satisfies Record<string, Partial<Range>>

// Paint is the slowest step. Cut is slower than Mold, so with "keep everyone busy" the work piles up in
// front of Paint alone (see spec §4.7).
export const DEFAULT_SETUP: SandboxSetup = {
  stations: [3, 2.5, 4, 3, 2.5].map((minutes) => ({ minutes, variation: 'some', machines: 1, jams: false })),
  release: { kind: 'busy' },
}

const NEW_STATION: SandboxStation = { minutes: 3, variation: 'some', machines: 1, jams: false }
const JAMS = { every: { kind: 'uniform', min: 40, max: 80 }, lasts: { kind: 'uniform', min: 5, max: 15 } } satisfies Station['jams']

export function cycleTime(minutes: number, variation: Variation): Dist {
  switch (variation) {
    case 'none':
      return { kind: 'fixed', value: minutes }
    case 'some':
      return { kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 }
    case 'lots':
      return { kind: 'uniform', min: minutes * 0.25, max: minutes * 1.75 }
  }
}

function toStation(station: SandboxStation, i: number): Station {
  return {
    ...STEPS[i],
    cycleTime: cycleTime(station.minutes, station.variation),
    ...(station.machines > 1 ? { servers: station.machines } : {}),
    ...(station.jams ? { jams: JAMS } : {}),
  }
}

function toRelease(release: SandboxRelease): Release {
  switch (release.kind) {
    case 'busy':
      return { kind: 'saturate' }
    case 'rope':
      return { kind: 'rope', constraint: STEPS[release.station].id, buffer: release.length }
    case 'pace':
      return { kind: 'interval', every: { kind: 'fixed', value: release.every } }
  }
}

export function sandboxModel(setup: SandboxSetup): FactoryModel {
  return { stations: setup.stations.map(toStation), release: toRelease(setup.release), horizon: SHIFT }
}

// Robots a station could make in a shift if it never had to wait for work, counting jams at their
// average: what it can make on paper.
export function onPaper(setup: SandboxSetup, i: number): number {
  return capacity(toStation(setup.stations[i], i), SHIFT)
}

// The station that can make the fewest on paper (the first, on a tie).
export function slowest(setup: SandboxSetup): number {
  const made = setup.stations.map((_, i) => onPaper(setup, i))
  return made.indexOf(Math.min(...made))
}

// A value one step up or down, kept in range and on the step grid.
export function stepped(value: number, direction: 1 | -1, { min, max, step }: Range): number {
  return Math.min(max, Math.max(min, Math.round((value + direction * step) / step) * step))
}

export function changeStation(setup: SandboxSetup, i: number, change: Partial<SandboxStation>): SandboxSetup {
  return { ...setup, stations: setup.stations.map((station, k) => (k === i ? { ...station, ...change } : station)) }
}

export function addStation(setup: SandboxSetup): SandboxSetup {
  if (setup.stations.length >= LIMITS.stations.max) return setup
  return { ...setup, stations: [...setup.stations, NEW_STATION] }
}

// Takes away the last station. A rope tied to it moves to the new last station.
export function removeStation(setup: SandboxSetup): SandboxSetup {
  if (setup.stations.length <= LIMITS.stations.min) return setup
  const stations = setup.stations.slice(0, -1)
  const { release } = setup
  return { stations, release: release.kind === 'rope' && release.station >= stations.length ? { ...release, station: stations.length - 1 } : release }
}

// Switching how work starts: a rope goes on the slowest station, and a pace starts robots as often as
// the slowest station can finish them on paper, rounded up to the half minute.
export function releaseOfKind(setup: SandboxSetup, kind: SandboxRelease['kind']): SandboxRelease {
  switch (kind) {
    case 'busy':
      return { kind }
    case 'rope':
      return { kind, station: slowest(setup), length: 10 }
    case 'pace': {
      // Less a hair, so a pace that falls on the half minute isn't rounded past it.
      const every = Math.ceil((2 * SHIFT) / onPaper(setup, slowest(setup)) - 1e-9) / 2
      return { kind, every: Math.min(LIMITS.pace.max, Math.max(LIMITS.pace.min, every)) }
    }
  }
}

function sameStation(a: SandboxStation, b: SandboxStation): boolean {
  return a.minutes === b.minutes && a.variation === b.variation && a.machines === b.machines && a.jams === b.jams
}

function sameRelease(a: SandboxRelease, b: SandboxRelease): boolean {
  if (a.kind === 'rope' && b.kind === 'rope') return a.station === b.station && a.length === b.length
  if (a.kind === 'pace' && b.kind === 'pace') return a.every === b.every
  return a.kind === b.kind
}

export function sameSetup(a: SandboxSetup, b: SandboxSetup): boolean {
  return a.stations.length === b.stations.length && a.stations.every((s, i) => sameStation(s, b.stations[i])) && sameRelease(a.release, b.release)
}

export const variationWords: Record<Variation, string> = { none: 'no variation', some: 'some variation', lots: 'lots of variation' }

export const machineWords = (count: number) => `${count} ${count === 1 ? 'machine' : 'machines'}`

export function releaseWords(release: SandboxRelease): string {
  switch (release.kind) {
    case 'busy':
      return 'Keep everyone busy'
    case 'rope':
      return `A rope of ${release.length} to ${STEPS[release.station].name}`
    case 'pace':
      return `One robot every ${release.every} min`
  }
}

// What changed from one run's line to the next, a few words for each station or rule that changed:
// "Paint: 3 min, 2 machines", or "Every station: lots of variation" when all changed alike.
export function describeChanges(before: SandboxSetup, after: SandboxSetup): string[] {
  const kept = after.stations.slice(0, before.stations.length)
  const edits = kept.map((station, i) => {
    const old = before.stations[i]
    return [
      station.minutes !== old.minutes && `${station.minutes} min`,
      station.machines !== old.machines && machineWords(station.machines),
      station.variation !== old.variation && variationWords[station.variation],
      station.jams !== old.jams && (station.jams ? 'jams' : 'no jams'),
    ]
      .filter((part) => part !== false)
      .join(', ')
  })
  const alike = kept.length > 1 && edits[0] !== '' && edits.every((edit) => edit === edits[0])
  const changes = alike ? [`Every station: ${edits[0]}`] : edits.flatMap((edit, i) => (edit ? [`${STEPS[i].name}: ${edit}`] : []))
  for (let i = kept.length; i < after.stations.length; i++) changes.push(`Added ${STEPS[i].name}: ${after.stations[i].minutes} min`)
  for (let i = after.stations.length; i < before.stations.length; i++) changes.push(`Removed ${STEPS[i].name}`)
  if (!sameRelease(before.release, after.release)) changes.push(releaseWords(after.release))
  return changes
}

const onGrid = (value: unknown, { min, max, step }: Range): value is number =>
  typeof value === 'number' && value >= min && value <= max && Number.isInteger((value - min) / step)

function cleanStation(value: unknown): SandboxStation | null {
  if (typeof value !== 'object' || value === null) return null
  const { minutes, variation, machines, jams } = value as Record<string, unknown>
  if (!onGrid(minutes, LIMITS.minutes) || !onGrid(machines, LIMITS.machines) || typeof jams !== 'boolean') return null
  if (variation !== 'none' && variation !== 'some' && variation !== 'lots') return null
  return { minutes, variation, machines, jams }
}

function cleanRelease(value: unknown, stations: number): SandboxRelease | null {
  if (typeof value !== 'object' || value === null) return null
  const { kind, station, length, every } = value as Record<string, unknown>
  if (kind === 'busy') return { kind }
  if (kind === 'rope' && onGrid(station, { min: 0, max: stations - 1, step: 1 }) && onGrid(length, LIMITS.rope)) return { kind, station, length }
  if (kind === 'pace' && onGrid(every, LIMITS.pace)) return { kind, every }
  return null
}

// A line kept on the device, checked field by field: anything unexpected gives null, and the player
// starts again from the default line.
export function cleanSetup(value: unknown): SandboxSetup | null {
  if (typeof value !== 'object' || value === null) return null
  const { stations, release } = value as Record<string, unknown>
  if (!Array.isArray(stations) || stations.length < LIMITS.stations.min || stations.length > LIMITS.stations.max) return null
  const clean = stations.map(cleanStation)
  if (!clean.every((station) => station !== null)) return null
  const rule = cleanRelease(release, clean.length)
  return rule && { stations: clean, release: rule }
}
