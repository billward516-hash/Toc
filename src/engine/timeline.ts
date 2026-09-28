import type { SimResult } from './simulate.ts'

export interface ActiveJob {
  job: number
  start: number
  end: number
}

export interface Snapshot {
  t: number
  released: number
  queues: number[]
  working: ActiveJob[][]
  completed: number[]
  // Stations stopped by a jam at time t.
  jammed: boolean[]
  shipped: number
}

// The state of the line at time t, rebuilt from the event log. Replaying from zero keeps
// playback, pausing, and rewinding trivially consistent; the logs are only a few thousand events.
export function snapshotAt(result: SimResult, t: number): Snapshot {
  const n = result.stations.length
  const queues = new Array<number>(n).fill(0)
  const completed = new Array<number>(n).fill(0)
  const working: ActiveJob[][] = Array.from({ length: n }, () => [])
  const jammedUntil = new Array<number>(n).fill(0)
  let released = 0

  for (const event of result.events) {
    if (event.t > t) break
    switch (event.type) {
      case 'release':
        released++
        queues[0]++
        break
      case 'start':
        queues[event.station]--
        working[event.station].push({ job: event.job, start: event.t, end: event.end })
        break
      case 'finish': {
        const active = working[event.station]
        active.splice(
          active.findIndex((a) => a.job === event.job),
          1,
        )
        completed[event.station]++
        if (event.station + 1 < n) queues[event.station + 1]++
        break
      }
      case 'jam':
        jammedUntil[event.station] = event.until
        break
    }
  }

  const jammed = jammedUntil.map((until) => t < until)
  return { t, released, queues, working, completed, jammed, shipped: completed[n - 1] }
}

export type Zone = 'dry' | 'healthy' | 'flooding'

export interface ZoneSpan {
  from: number
  to: number
  zone: Zone
}

// The pile in front of `station` over the shift, as stretches below `low` (running dry), within
// [low, high] (healthy), or above `high` (flooding). Changes that undo each other at the same
// instant take no time, so they never split a stretch.
export function bufferZones(result: SimResult, station: number, low: number, high: number): ZoneSpan[] {
  const zoneOf = (queue: number): Zone => (queue < low ? 'dry' : queue > high ? 'flooding' : 'healthy')
  const spans: ZoneSpan[] = []
  let queue = 0
  let from = 0
  let zone = zoneOf(0)
  const close = (to: number) => {
    const last = spans.at(-1)
    if (to <= from) return
    if (last && last.zone === zone && last.to === from) last.to = to
    else spans.push({ from, to, zone })
  }

  for (const event of result.events) {
    if (event.t > result.horizon) break
    if (event.type === 'release' && station === 0) queue++
    else if (event.type === 'start' && event.station === station) queue--
    else if (event.type === 'finish' && event.station + 1 === station) queue++
    else continue
    const next = zoneOf(queue)
    if (next === zone) continue
    close(event.t)
    from = event.t
    zone = next
  }
  close(result.horizon)
  return spans
}

// Share of [0, upTo] during which the pile in front of `station` stayed within [low, high]:
// neither running dry nor flooding.
export function bufferShare(result: SimResult, station: number, low: number, high: number, upTo = result.horizon): number {
  if (upTo <= 0) return 1
  let healthy = 0
  for (const span of bufferZones(result, station, low, high)) {
    if (span.zone === 'healthy') healthy += Math.max(0, Math.min(span.to, upTo) - span.from)
  }
  return healthy / upTo
}

// Share of [0, upTo] during which no station had `limit` or more units waiting.
// Several events at the same instant take no time, so momentary spikes cost nothing.
export function steadyShare(result: SimResult, limit: number, upTo = result.horizon): number {
  if (upTo <= 0) return 1
  const n = result.stations.length
  const queues = new Array<number>(n).fill(0)
  let crowded = 0
  let unsteady = 0
  let last = 0
  const change = (i: number, delta: number) => {
    const before = queues[i] >= limit
    queues[i] += delta
    const after = queues[i] >= limit
    if (before !== after) crowded += after ? 1 : -1
  }

  for (const event of result.events) {
    if (event.t > upTo) break
    if (crowded > 0) unsteady += event.t - last
    last = event.t
    if (event.type === 'release') change(0, 1)
    else if (event.type === 'start') change(event.station, -1)
    else if (event.type === 'finish' && event.station + 1 < n) change(event.station + 1, 1)
  }
  if (crowded > 0) unsteady += upTo - last
  return 1 - unsteady / upTo
}
