import { loadCurve } from './curve.ts'
import { noUpgrades, capacityPerHour as lineCapacity } from './lines.ts'
import { hotMission, lotMission } from './lotRound.ts'
import { dueFor, runLots, SPEEDS, type LotPlan, type LotResult } from './lots.ts'
import { ROUND_MANY, ROUND_ONE, ROUND_TWO } from './rounds.ts'
import { workTime } from './lines.ts'

// The loading lab's own numbers as the course guide quotes them, so the guide follows the lab when the
// lab is retuned. Written as {labWork}, {lab90}, and so on in the guide's texts (see course/lab.ts).
const FIXED = [true, true, false, true, true]
const DAYS = 20
const FORTNIGHTS = [1, 2, 3, 4, 5, 6]

const thousands = (n: number) => (Math.round(n / 100) * 100).toLocaleString('en-US')

let cached: Record<string, string> | null = null

export function labFacts(): Record<string, string> {
  if (cached) return cached
  const none = (minutes: readonly number[]) => noUpgrades(minutes)
  const one = loadCurve(ROUND_ONE.minutes, none(ROUND_ONE.minutes), [12, 14, 18, 19, 20, 22], DAYS)
  const two = loadCurve(ROUND_TWO.minutes, none(ROUND_TWO.minutes), [19], DAYS)[0]
  const five = loadCurve(ROUND_MANY.minutes, none(ROUND_MANY.minutes), [19], DAYS)[0]
  const fixed = loadCurve(ROUND_MANY.minutes, FIXED, [19], DAYS)[0]
  const at = (rate: number) => one.find((o) => o.rate === rate)!
  const cycle = (rate: number) => String(Math.round(at(rate).cycle))

  // The lot rounds, on the eight-tool group, averaged over a few fortnights.
  const avg = (plan: LotPlan) => {
    const runs: LotResult[] = FORTNIGHTS.map((day) => runLots(plan, day))
    const mean = (pick: (r: LotResult) => number) => runs.reduce((sum, r) => sum + pick(r), 0) / runs.length
    return {
      cycle: mean((r) => r.cycleHours),
      busy: mean((r) => r.busy),
      shipped: mean((r) => r.good),
      short: mean((r) => r.shortShare),
      hotOnTime: mean((r) => r.promises.hot.onTime),
    }
  }
  const whole: LotPlan = { size: 'demand', toolsPerLot: 8, depth: 1, split: 1, order: 'first', startFor: 0.69 }
  const hot: LotPlan = { ...whole, depth: 2, startFor: 0.77, hot: 0.15 }
  const one1 = avg(whole)
  const four = avg({ ...whole, depth: 4 })
  const hopeful = avg({ ...whole, startFor: 0.85 })
  const divided = avg({ ...whole, toolsPerLot: 1, depth: 8, startFor: 0.85 })
  const noPriority = avg(hot)
  const priority = avg({ ...hot, order: 'hot' })
  const dividedHot = avg({ ...hot, toolsPerLot: 1, depth: 8, order: 'hot' })
  const pct = (x: number) => String(Math.round(100 * x))
  const mission = lotMission(SPEEDS)
  const due = dueFor(SPEEDS)

  cached = {
    // Days the lab's "average of many days" curve is made from.
    labDays: String(DAYS),
    // Round 1: the first line.
    labWork: String(Math.round(workTime(ROUND_ONE.minutes))),
    labCapacity: String(Math.round(lineCapacity(ROUND_ONE.minutes))),
    lab60: cycle(12),
    lab70: cycle(14),
    lab90: cycle(18),
    lab95: cycle(19),
    lab100: cycle(20),
    lab110: cycle(22),
    labShip90: String(Math.round(at(18).shipped)),
    labShip100: String(Math.round(at(20).shipped)),
    labShipGain: String(Math.round((100 * (at(20).shipped - at(18).shipped)) / at(18).shipped)),
    labRatio: (at(20).cycle / at(18).cycle).toFixed(1),
    labM1Shipped: String(ROUND_ONE.mission.shipped),
    labM1Cycle: String(ROUND_ONE.mission.cycle),
    // Rounds 2 and 3, at 95% load.
    two95: String(Math.round(two.cycle)),
    five95: String(Math.round(five.cycle)),
    fixed95: String(Math.round(fixed.cycle)),
    twoMore: String(Math.round((100 * (two.cycle - at(19).cycle)) / at(19).cycle)),
    // Round 4: the eight-tool workgroup.
    fleetGood: mission.good.toLocaleString('en-US'),
    fleetCycle: String(mission.cycleHours),
    fleetOne: String(Math.round(one1.cycle)),
    fleetFour: String(Math.round(four.cycle)),
    fleetBusy: pct(one1.busy),
    safeShip: thousands(one1.shipped),
    hopeBusy: pct(hopeful.busy),
    hopeShort: pct(hopeful.short),
    divBusy: pct(divided.busy),
    divShip: thousands(divided.shipped),
    divCycle: String(Math.round(divided.cycle)),
    // Round 5.
    dueHot: String(due.hot),
    dueNormal: String(due.normal),
    hotShip: hotMission(SPEEDS).good.toLocaleString('en-US'),
    hotNoPriority: pct(noPriority.hotOnTime),
    hotPriority: pct(priority.hotOnTime),
    hotDivided: pct(dividedHot.hotOnTime),
  }
  return cached
}
