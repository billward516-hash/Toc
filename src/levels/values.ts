import type { SimResult } from '../engine/simulate.ts'
import { steadyShare } from '../engine/timeline.ts'
import { bufferScore, profitScore, rushOnTime } from './graph.ts'
import type { Goal } from './types.ts'

// Named numbers a level's text can quote, such as {baseline} or {steadyPct}.
// For a prediction, the baseline is the first day watched and the run is the second.
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
      return { ...runFacts(baseline, run), steady: baseline.output, gap: baseline.output - run.output, first: baseline.output, second: run.output }
    case 'bars': {
      const values: Record<string, number> = { ...runFacts(baseline, run), days: goal.freshDays + 1 }
      for (const bar of goal.bars) {
        if (bar.metric === 'shipped') values.target = bar.min
        if (bar.metric === 'steady') {
          values.limit = bar.pileLimit
          values.minSteadyPct = Math.round(bar.min * 100)
          values.steadyPct = Math.floor(100 * steadyShare(run, bar.pileLimit))
          values.steadyBeforePct = Math.floor(100 * steadyShare(baseline, bar.pileLimit))
        }
        if (bar.metric === 'leadTime') values.maxLead = bar.max
        if (bar.metric === 'wip') values.maxWip = bar.max
        if (bar.metric === 'stock') values.maxStock = bar.max
        if (bar.metric === 'scrapped') values.maxScrapped = bar.max
        if (bar.metric === 'spend') values.budget = bar.max
        if (bar.metric === 'rushOnTime') {
          values.onTime = rushOnTime(run, bar.due)
          values.onTimeBefore = rushOnTime(baseline, bar.due)
        }
      }
      return values
    }
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
    case 'flow':
      return {
        baseline: baseline.output,
        target: goal.target,
        maxLead: goal.maxLeadTime,
        lead: Math.round(run.avgLeadTime ?? 0),
        leadBefore: Math.round(baseline.avgLeadTime ?? 0),
        freshDays: goal.freshDays,
        changeover: Math.round(run.stations.reduce((sum, s) => sum + s.changeoverTime, 0)),
        changeoverBefore: Math.round(baseline.stations.reduce((sum, s) => sum + s.changeoverTime, 0)),
      }
    case 'profit': {
      const before = profitScore(goal, baseline)
      const after = profitScore(goal, run)
      return {
        target: goal.target,
        expense: goal.expense,
        profit: Math.round(after.profit),
        profitBefore: Math.round(before.profit),
        throughput: Math.round(after.throughput),
        throughputBefore: Math.round(before.throughput),
        inventory: Math.round(after.inventory),
        maxInventory: goal.maxInventory,
        gain: Math.round(after.profit - before.profit),
        minShipped: goal.minShipped,
        days: goal.freshDays + 1,
      }
    }
    case 'elevate':
      return {
        baseline: baseline.output,
        target: goal.target,
        gain: run.output - baseline.output,
        limit: goal.pileLimit,
        minSteadyPct: Math.round(goal.minSteady * 100),
        steadyPct: Math.floor(100 * steadyShare(run, goal.pileLimit)),
        days: goal.freshDays + 1,
        minGain: goal.minGainPer1000,
      }
    case 'identifyBottleneck':
      return {}
  }
}

export const tenths = (x: number) => Math.round(x * 10) / 10

// What happened on a run, next to the baseline: for levels about disruptions.
function runFacts(baseline: SimResult, run: SimResult): Record<string, number> {
  return {
    baseline: baseline.output,
    gain: run.output - baseline.output,
    lost: baseline.output - run.output,
    lead: Math.round(run.avgLeadTime ?? 0),
    leadBefore: Math.round(baseline.avgLeadTime ?? 0),
    wip: tenths(run.avgWip),
    wipBefore: tenths(baseline.avgWip),
    stock: Math.round(run.supply?.avgStock ?? 0),
    stockBefore: Math.round(baseline.supply?.avgStock ?? 0),
    scrapped: run.scrapped ?? 0,
    scrappedBefore: baseline.scrapped ?? 0,
    rush: run.rush?.length ?? 0,
  }
}
