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
