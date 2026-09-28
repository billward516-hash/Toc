import type { SimResult } from '../engine/simulate.ts'
import { steadyShare } from '../engine/timeline.ts'
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
    case 'identifyBottleneck':
      return {}
  }
}
