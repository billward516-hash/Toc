import type { SimResult } from '../engine/simulate.ts'
import { steadyShare } from '../engine/timeline.ts'
import { bufferScore } from './graph.ts'
import type { Goal } from './types.ts'

// Named numbers a level's text can quote, such as {baseline} or {steadyPct}.
// For a prediction, the baseline is the steady twin and the run is the real line.
export function goalValues(goal: Goal, baseline: SimResult, run: SimResult = baseline): Record<string, number> {
  switch (goal.kind) {
    case 'output':
      return { baseline: baseline.output, target: goal.target }
    case 'steady':
      return {
        baseline: baseline.output,
        limit: goal.pileLimit,
        minSteadyPct: Math.round(goal.minSteady * 100),
        minShipped: goal.minShipped,
        steadyPct: Math.floor(100 * steadyShare(run, goal.pileLimit)),
      }
    case 'predict':
      return { steady: baseline.output, gap: baseline.output - run.output }
    case 'buffer': {
      const before = bufferScore(goal, baseline)
      const after = bufferScore(goal, run)
      return {
        baseline: baseline.output,
        low: goal.low,
        high: goal.high,
        minHealthyPct: Math.round(goal.minHealthy * 100),
        maxWip: goal.maxAvgWip,
        freshDays: goal.freshDays,
        healthyBeforePct: Math.floor(100 * before.healthy),
        wipBefore: tenths(before.avgWip),
        healthyPct: Math.floor(100 * after.healthy),
        wip: tenths(after.avgWip),
      }
    }
    case 'identifyBottleneck':
      return {}
  }
}

export const tenths = (x: number) => Math.round(x * 10) / 10
