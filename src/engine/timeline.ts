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
  shipped: number
}

// The state of the line at time t, rebuilt from the event log. Replaying from zero keeps
// playback, pausing, and rewinding trivially consistent; the logs are only a few thousand events.
export function snapshotAt(result: SimResult, t: number): Snapshot {
  const n = result.stations.length
  const queues = new Array<number>(n).fill(0)
  const completed = new Array<number>(n).fill(0)
  const working: ActiveJob[][] = Array.from({ length: n }, () => [])
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
    }
  }

  return { t, released, queues, working, completed, shipped: completed[n - 1] }
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
    else if (event.station + 1 < n) change(event.station + 1, 1)
  }
  if (crowded > 0) unsteady += upTo - last
  return 1 - unsteady / upTo
}
