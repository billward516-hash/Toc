import type { SimResult } from '../engine/simulate.ts'
import { movesOn } from '../engine/timeline.ts'

// Robots waiting in front of each station at `points` evenly spaced moments of the day, for the strips
// that show where the piles sit and how they move from one station to another.
export function queueSeries(result: SimResult, points: number): number[][] {
  const n = result.stations.length
  const queue = new Array<number>(n).fill(0)
  const series = result.stations.map(() => new Array<number>(points).fill(0))
  let next = 0
  const sampleUpTo = (t: number) => {
    while (next < points && (next * result.horizon) / (points - 1) <= t) {
      for (let i = 0; i < n; i++) series[i][next] = queue[i]
      next++
    }
  }
  for (const event of result.events) {
    sampleUpTo(event.t - 1e-9)
    if (event.type === 'release') queue[0]++
    else if (event.type === 'start') queue[event.station]--
    else if (event.type === 'finish' && movesOn(event) && event.station + 1 < n) queue[event.station + 1]++
  }
  sampleUpTo(Infinity)
  return series
}
