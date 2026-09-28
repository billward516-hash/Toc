import { useMemo, useState } from 'react'
import type { FactoryModel } from '../engine/model.ts'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { bufferShare, bufferZones, leadTimeSoFar, snapshotAt, steadyShare, type Snapshot, type ZoneSpan } from '../engine/timeline.ts'
import {
  bufferScore,
  elevateScore,
  feedbackForRun,
  flowHolds,
  maxStars,
  profitScore,
  profitSoFar,
  starsFor,
  type Investment,
  type ProfitScore,
} from '../levels/graph.ts'
import { applyLevers, leverValues, overBudget, planCost, valueLabel } from '../levels/levers.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import type { Choices, Goal, Lever } from '../levels/types.ts'
import { goalValues, tenths } from '../levels/values.ts'
import { BarsChecklist, BarsStarGoals } from './bars.tsx'
import { barsHint, barsOutcome, barsResultStats, barStats, type Words } from './barTexts.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView, type Badge } from './FactoryView.tsx'
import { Icon, type IconName } from './icons.tsx'
import { ShiftLog } from './ShiftLog.tsx'
import { breaksDown, hasDisruptions, shiftLog } from './shiftEvents.ts'
import { JamLog, LevelHeader, PlaybackPanel, Stars, type JamEntry, type Stat } from './parts.tsx'
import type { LevelFlowProps } from './types.ts'
import { productColor, productName } from './products.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

type PlanGoal = Extract<Goal, { kind: 'output' | 'steady' | 'buffer' | 'elevate' | 'flow' | 'profit' | 'bars' }>
type BufferGoal = Extract<Goal, { kind: 'buffer' }>
type ElevateGoal = Extract<Goal, { kind: 'elevate' }>
type FlowGoal = Extract<Goal, { kind: 'flow' }>
type ProfitGoal = Extract<Goal, { kind: 'profit' }>

interface Run {
  plan: Choices
  model: FactoryModel
  result: SimResult
  // The same plan on days the player hasn't seen: the third star of buffer and flow levels, and every star of elevate and profit levels.
  fresh: SimResult[]
  investment: Investment
  met: boolean
  stars: number
}

export function PlanTheShift({ level, goal, nextLevel, onRecord, onExit, onNext }: LevelFlowProps<PlanGoal['kind']>) {
  const { model, levers, seed } = level
  const baseline = useMemo(() => simulate(model, seed), [model, seed])
  const [speed, setSpeed] = useState(1)
  const playback = usePlayback(model.horizon, MINUTES_PER_SECOND * speed)
  const [briefing, setBriefing] = useState(true)
  const [choices, setChoices] = useState<Choices>({})
  const [run, setRun] = useState<Run | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const shown = run ?? { model, result: baseline }
  const snapshot = useMemo(() => snapshotAt(shown.result, playback.t), [shown.result, playback.t])
  const values = goalValues(goal, baseline, run?.result)
  const stars = maxStars(level)
  const budget = goal.kind === 'elevate' ? goal.budget : undefined
  const over = overBudget(levers, choices, budget)
  const ready = levers.every((lever) => choices[lever.id] !== undefined) && over === 0
  const windows = breakWindows(model)
  const showResult = run !== null && playback.finished && !dismissed
  const popup = run ? feedbackForRun(level, run.met, run.plan) : undefined
  const pileLimit = goal.kind === 'steady' || goal.kind === 'elevate' ? goal.pileLimit : 5
  const drum = goal.kind === 'buffer' ? model.stations.findIndex((s) => s.id === goal.drum) : -1
  const zones = useMemo(
    () => (goal.kind === 'buffer' ? bufferZones(shown.result, drum, goal.low, goal.high) : undefined),
    [goal, shown.result, drum],
  )
  const jams = model.stations.some((s) => s.jams) && zones ? jamLog(shown.model, shown.result, zones, playback.t) : null
  const words: Words = {
    material: model.supply?.name ?? 'material',
    products: (id) => `${productName(model, id).toLowerCase()}s`,
  }
  const spend = run?.investment.spend ?? 0
  const context = { words, spend }

  const stats: Stat[] =
    goal.kind === 'profit'
      ? moneyStats(goal, shown.result, snapshot)
      : goal.kind === 'bars'
        ? barStats(goal, shown.result, snapshot, words, spend)
        : [{ label: 'Shipped', value: snapshot.shipped }]
  if (goal.kind === 'steady' || goal.kind === 'elevate') {
    stats.push({ label: 'Steady', value: `${Math.floor(100 * steadyShare(shown.result, goal.pileLimit, playback.t))}%` })
  }
  if (goal.kind === 'elevate') stats.push({ label: 'Spent', value: dollars(run?.investment.spend ?? 0) })
  if (goal.kind === 'flow') stats.push({ label: 'Lead time', value: minutes(leadTimeSoFar(shown.result, playback.t)) })
  if (goal.kind === 'buffer') {
    stats.push({ label: 'Healthy', value: percent(bufferShare(shown.result, drum, goal.low, goal.high, playback.t)) })
  }
  if (goal.kind !== 'profit' && goal.kind !== 'bars') {
    stats.push({ label: goal.kind === 'buffer' ? 'On the floor' : 'In process', value: snapshot.released - snapshot.shipped })
  }
  if (goal.kind === 'output' || goal.kind === 'elevate' || goal.kind === 'flow') stats.push({ label: 'Goal', value: goal.target })

  const start = () => {
    setBriefing(false)
    onRecord({ type: 'started', levelId: level.id })
    playback.play()
  }

  const runPlan = () => {
    const planModel = applyLevers(model, levers, choices)
    const result = simulate(planModel, seed)
    const days = 'freshDays' in goal ? goal.freshDays : 0
    const fresh = freshSeeds(days, seed).map((day) => simulate(planModel, day))
    const investment = { spend: planCost(levers, choices), baseline: baseline.output }
    const earned = starsFor(goal, result, fresh, investment)
    // Earning the first star is what completes a level.
    const met = earned > 0
    onRecord({ type: 'ran', levelId: level.id, choices, shipped: result.output, met, stars: earned })
    if (met) onRecord({ type: 'completed', levelId: level.id })
    setRun({ plan: choices, model: planModel, result, fresh, investment, met, stars: earned })
    setDismissed(false)
    playback.restart()
  }

  const replan = () => {
    setRun(null)
    playback.rewind()
  }

  return (
    <div className="screen level-screen">
      <LevelHeader level={level} stats={stats} onExit={onExit} />

      <p className={`viewing${run ? ' mine' : ''}`}>{run ? 'Running your plan' : 'Running the factory as it is today'}</p>
      <div className="floor">
        <FactoryView
          model={shown.model}
          snapshot={snapshot}
          badges={run ? badgesFor(levers, run.plan) : {}}
          buildingAt={pileLimit}
          constraint={goal.kind === 'buffer' ? goal.drum : null}
          buffer={goal.kind === 'buffer' ? { station: goal.drum, low: goal.low, high: goal.high } : null}
          jobProducts={shown.result.products}
          unit={level.unit}
          rushJobs={shown.result.rush}
        />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <PlaybackPanel
          playback={playback}
          speed={speed}
          onSpeed={setSpeed}
          horizon={model.horizon}
          windows={windows}
          zones={zones}
          parts={model.products?.map((product) => (
            <span key={product.id}>
              <i className="swatch" style={{ background: productColor(model, product.id) }} /> {product.name}
            </span>
          ))}
          legend={
            <>
              {windows.length > 0 && (
                <span>
                  <i className="swatch dot resting" /> On break
                </span>
              )}
              {model.stations.some((s) => s.jams) && (
                <span>
                  <i className="swatch dot jammed" /> Jammed
                </span>
              )}
              {model.stations.some((s) => s.changeover) && (
                <span>
                  <i className="swatch dot changing" /> Changeover
                </span>
              )}
              {breaksDown(shown.model) && (
                <span>
                  <i className="swatch dot jammed" /> Broken down
                </span>
              )}
              {shown.model.supply && (
                <span>
                  <i className="swatch dot starved" /> No {words.material}
                </span>
              )}
              {shown.model.rush?.length ? (
                <span>
                  <i className="swatch rush" /> Rush order
                </span>
              ) : null}
              {goal.kind === 'buffer' && (
                <span className="buffer-key">
                  {model.stations[drum].name}'s buffer: <i className="swatch zone dry" /> running dry <i className="swatch zone healthy" /> healthy{' '}
                  <i className="swatch zone flooding" /> flooding
                </span>
              )}
              {run &&
                levers.map((lever) => {
                  const badge = badgeLegend[lever.kind]
                  return (
                    badge && (
                      <span key={lever.id}>
                        <Icon name={leverIcon(lever)} /> {badge}
                      </span>
                    )
                  )
                })}
            </>
          }
        >
          {jams && <JamLog entries={jams} drum={model.stations[drum].name} />}
          {!jams && hasDisruptions(shown.model) && <ShiftLog entries={shiftLog(shown.model, shown.result, playback.t, level.unit ?? 'robots')} />}
        </PlaybackPanel>

        <section className="question card" aria-live="polite">
          {run ? (
            <>
              <p className="prompt">Your plan</p>
              <ul className="plan-summary">
                {levers.map((lever) => (
                  <li key={lever.id}>
                    <Icon name={leverIcon(lever)} /> {lever.label}: <strong>{valueLabel(lever, run.plan[lever.id], model)}</strong>
                  </li>
                ))}
              </ul>
              {playback.finished ? (
                <p className="result">
                  {outcomeText(goal, run.result, context)} {run.met ? 'Goal met!' : 'Not there yet.'}
                  {stars > 0 && <Stars earned={run.stars} max={stars} />}
                </p>
              ) : (
                <p className="hint">Watch your plan run, or jump to the end of the shift.</p>
              )}
              <div className="actions">
                {run.met && playback.finished && nextLevel && (
                  <button className="btn primary big" onClick={() => onNext(nextLevel)}>
                    Next level <Icon name="next" />
                  </button>
                )}
                <button className="btn big" onClick={replan}>
                  Change my plan
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="prompt">{fillTemplate(goal.prompt, model, snapshotAt(baseline, 0), values)}</p>
              <p className="hint">{planningHint(goal, baseline, context)}</p>
              {goal.kind === 'buffer' && <StarGoals goal={goal} />}
              {goal.kind === 'elevate' && <ElevateStarGoals goal={goal} />}
              {goal.kind === 'flow' && <FlowStarGoals goal={goal} />}
              {goal.kind === 'profit' && <ProfitStarGoals goal={goal} />}
              {goal.kind === 'bars' && <BarsStarGoals goal={goal} words={words} />}
              {levers.map((lever) => (
                <fieldset key={lever.id} className="lever">
                  <legend>
                    <Icon name={leverIcon(lever)} /> {lever.label}
                  </legend>
                  <div className="chips">
                    {leverValues(lever).map((value) => (
                      <button
                        key={value}
                        className={`chip${choices[lever.id] === value ? ' on' : ''}`}
                        aria-pressed={choices[lever.id] === value}
                        onClick={() => setChoices({ ...choices, [lever.id]: value })}
                      >
                        {valueLabel(lever, value, model)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              {budget !== undefined && (
                <p className={`budget${over > 0 ? ' over' : ''}`}>
                  <Icon name="money" />{' '}
                  {over > 0
                    ? `Your plan costs ${dollars(planCost(levers, choices))}: ${dollars(over)} over your ${dollars(budget)} budget.`
                    : `Your plan costs ${dollars(planCost(levers, choices))} of your ${dollars(budget)} budget.`}
                </p>
              )}
              <button className="btn primary big" disabled={!ready} onClick={runPlan}>
                Run the shift with my plan <Icon name="play" />
              </button>
            </>
          )}
        </section>
      </div>

      {briefing && (
        <Dialog
          kicker={`Tier ${level.tier}`}
          title={level.title}
          actions={
            <button className="btn primary big" onClick={start}>
              Watch the factory <Icon name="play" />
            </button>
          }
        >
          <p>{fillTemplate(level.briefing, model, snapshotAt(baseline, 0), values)}</p>
        </Dialog>
      )}

      {showResult && (
        <Dialog
          kicker={run.met ? 'Goal met' : 'Not yet'}
          title={popup?.title ?? (run.met ? 'Goal met' : 'Not yet')}
          tone={run.met ? 'good' : 'retry'}
          actions={
            <>
              {run.met && (
                <button className="btn primary big" onClick={nextLevel ? () => onNext(nextLevel) : onExit}>
                  {nextLevel ? 'Next level' : 'Back to levels'} <Icon name="next" />
                </button>
              )}
              <button className={`btn big${run.met ? '' : ' primary'}`} onClick={replan}>
                {run.met ? 'Try another plan' : 'Change my plan'}
              </button>
              <button className="btn big" onClick={() => setDismissed(true)}>
                Look at the factory
              </button>
            </>
          }
        >
          <div className="result-stats">
            {resultStats(goal, run.result, baseline, { words, spend: run.investment.spend }).map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.detail && <small>{stat.detail}</small>}
              </div>
            ))}
          </div>
          {stars > 0 && <Stars earned={run.stars} max={stars} />}
          {goal.kind === 'buffer' && <StarChecklist goal={goal} result={run.result} fresh={run.fresh} />}
          {goal.kind === 'elevate' && <ElevateChecklist goal={goal} result={run.result} fresh={run.fresh} investment={run.investment} />}
          {goal.kind === 'flow' && <FlowChecklist goal={goal} result={run.result} fresh={run.fresh} />}
          {goal.kind === 'profit' && <ProfitChecklist goal={goal} result={run.result} fresh={run.fresh} />}
          {goal.kind === 'bars' && <BarsChecklist goal={goal} result={run.result} fresh={run.fresh} words={words} spend={run.investment.spend} />}
          {popup && <p>{fillTemplate(popup.body, run.model, snapshotAt(run.result, model.horizon), values)}</p>}
          {run.met &&
            level.principles.map((p) => (
              <p key={p} className="principle-chip">
                Principle {p}: {principleNames[p]}
              </p>
            ))}
        </Dialog>
      )}
    </div>
  )
}

// What each station lever's badge means, for the legend; levers that change release have no badge.
const badgeLegend: Record<Lever['kind'], string | null> = {
  upgrade: 'Upgraded',
  coverBreak: 'Works through breaks',
  steady: 'Standard work',
  maintain: 'Maintained: no more jams',
  releasePace: null,
  ropeTo: null,
  ropeLength: null,
  machineRule: null,
  buy: null,
  lotSize: null,
  quickChange: 'Quick changeovers',
  transferSize: null,
  priority: null,
  menu: null,
  option: null,
}

const stationBadge: Partial<Record<Lever['kind'], Badge>> = {
  upgrade: 'upgraded',
  coverBreak: 'covered',
  steady: 'steadied',
  maintain: 'maintained',
  quickChange: 'quick',
}

function leverIcon(lever: Lever): IconName {
  switch (lever.kind) {
    case 'upgrade':
      return 'bolt'
    case 'steady':
      return 'even'
    case 'coverBreak':
    case 'releasePace':
      return 'clock'
    case 'maintain':
      return 'wrench'
    case 'ropeTo':
    case 'ropeLength':
      return 'rope'
    case 'machineRule':
      return 'rule'
    case 'buy':
      return 'money'
    case 'lotSize':
      return 'stack'
    case 'quickChange':
      return 'swap'
    case 'transferSize':
      return 'cart'
    case 'priority':
      return 'sort'
    case 'menu':
      return 'tag'
    case 'option':
      return lever.icon ?? 'rule'
  }
}

function badgesFor(levers: Lever[], plan: Choices): Record<string, Badge[]> {
  const badges: Record<string, Badge[]> = {}
  for (const lever of levers) {
    const badge = stationBadge[lever.kind]
    if (!badge) continue
    const station = plan[lever.id]
    badges[station] = [...(badges[station] ?? []), badge]
  }
  return badges
}

// Days the player hasn't seen, for the third star: anything but the level's own day.
function freshSeeds(count: number, own: number): number[] {
  return Array.from(crypto.getRandomValues(new Uint32Array(count)), (day) => (day === own ? day + 1 : day))
}

// Every jam so far in the shown run, and whether the buffer ran into the red while it lasted.
function jamLog(model: FactoryModel, result: SimResult, zones: ZoneSpan[], t: number): JamEntry[] {
  return result.events.flatMap((event) => {
    if (event.type !== 'jam' || event.t > t) return []
    const to = Math.min(event.until, result.horizon)
    const dry = zones.some((z) => z.zone === 'dry' && z.from >= event.t && z.from <= Math.min(to, t))
    return [{ station: model.stations[event.station].name, from: event.t, to, over: t >= to, dry }]
  })
}

const percent = (share: number) => `${Math.floor(100 * share)}%`
const dollars = (amount: number) => `$${amount.toLocaleString('en-US')}`
// Whole dollars, with a real minus sign when a shift loses money.
const money = (amount: number) => (Math.round(amount) < 0 ? '−' : '') + dollars(Math.abs(Math.round(amount)))
const minutes = (value: number | null) => (value === null ? '–' : `${Math.round(value)} min`)
const wholeMinutes = (value: number | null) => (value === null ? '–' : Math.round(value))
const changeoverMinutes = (result: SimResult) => result.stations.reduce((sum, s) => sum + s.changeoverTime, 0)

// Words and spending for the texts of bars levels.
interface TextContext {
  words: Words
  spend: number
}

function planningHint(goal: PlanGoal, baseline: SimResult, { words }: TextContext): string {
  switch (goal.kind) {
    case 'bars':
      return barsHint(goal, baseline, words)
    case 'output':
      return `Today the factory ships ${baseline.output} a shift. The goal is ${goal.target}.`
    case 'steady':
      return `Today the line is steady ${percent(steadyShare(baseline, goal.pileLimit))} of the shift. The goal: steady at least ${percent(goal.minSteady)} of the shift while shipping at least ${goal.minShipped}.`
    case 'buffer': {
      const today = bufferScore(goal, baseline)
      return `Today the buffer is healthy ${percent(today.healthy)} of the shift, with ${tenths(today.avgWip)} robots on the floor on average.`
    }
    case 'elevate':
      return `Today the shop ships ${baseline.output} a shift, and it's steady ${percent(steadyShare(baseline, goal.pileLimit))} of the time. Your plan runs for ${goal.freshDays + 1} days.${goal.budget === undefined ? '' : ` You can spend up to ${dollars(goal.budget)}.`}`
    case 'flow':
      return `Today the workshop ships ${baseline.output} a shift, each about ${minutes(baseline.avgLeadTime)} from order to shipping.`
    case 'profit': {
      const today = profitScore(goal, baseline)
      return `Today the bakery makes ${money(today.profit)} a shift: ${money(today.throughput)} of throughput (sales minus ingredients), minus ${money(goal.expense)} of operating expense. Your plan runs for ${goal.freshDays + 1} days.`
    }
  }
}

function outcomeText(goal: PlanGoal, result: SimResult, { words, spend }: TextContext): string {
  switch (goal.kind) {
    case 'bars':
      return barsOutcome(goal, result, words, spend)
    case 'output':
      return `Shipped ${result.output}, goal ${goal.target}.`
    case 'steady':
      return `Steady ${percent(steadyShare(result, goal.pileLimit))} of the shift, shipped ${result.output}.`
    case 'buffer': {
      const score = bufferScore(goal, result)
      return `Buffer healthy ${percent(score.healthy)} of the shift, ${tenths(score.avgWip)} on the floor on average.`
    }
    case 'elevate':
      return `Shipped ${result.output} today, goal ${goal.target}.`
    case 'flow':
      return `Shipped ${result.output}, each about ${minutes(result.avgLeadTime)} from order to shipping.`
    case 'profit':
      return `Profit ${money(profitScore(goal, result).profit)} today, goal ${money(goal.target)}.`
  }
}

function resultStats(goal: PlanGoal, result: SimResult, baseline: SimResult, { words, spend }: TextContext): Stat[] {
  switch (goal.kind) {
    case 'bars':
      return barsResultStats(goal, result, baseline, words, spend)
    case 'output':
      return [
        { label: 'Shipped', value: result.output },
        { label: 'Before', value: baseline.output },
        { label: 'Goal', value: goal.target },
      ]
    case 'steady':
      return [
        { label: 'Steady', value: percent(steadyShare(result, goal.pileLimit)) },
        { label: 'Shipped', value: result.output },
        { label: 'Goal', value: percent(goal.minSteady), detail: `and ${goal.minShipped} shipped` },
      ]
    case 'buffer': {
      const score = bufferScore(goal, result)
      return [
        { label: 'Healthy', value: percent(score.healthy), detail: `goal ${percent(goal.minHealthy)}` },
        { label: 'On the floor', value: tenths(score.avgWip), detail: `limit ${goal.maxAvgWip}` },
        { label: 'Shipped', value: result.output, detail: `before ${baseline.output}` },
      ]
    }
    case 'elevate':
      return [
        { label: 'Shipped', value: result.output, detail: `goal ${goal.target}` },
        { label: 'Before', value: baseline.output },
        { label: 'Spent', value: dollars(spend) },
      ]
    case 'flow':
      return [
        { label: 'Shipped', value: result.output, detail: `goal ${goal.target}` },
        { label: 'Lead time, min', value: wholeMinutes(result.avgLeadTime), detail: `goal ${goal.maxLeadTime} or less` },
        { label: 'Changeovers, min', value: wholeMinutes(changeoverMinutes(result)), detail: `before ${wholeMinutes(changeoverMinutes(baseline))}` },
      ]
    case 'profit': {
      const score = profitScore(goal, result)
      return [
        { label: 'Profit', value: money(score.profit), detail: `before ${money(profitScore(goal, baseline).profit)}` },
        { label: 'Throughput', value: money(score.throughput), detail: `minus ${money(goal.expense)} expense` },
        { label: 'Inventory', value: money(score.inventory), detail: 'on average' },
      ]
    }
  }
}

// Tier 6's dashboard uses throughput accounting's own names (spec §5.5). Profit is what the shift has
// earned so far: throughput from what has shipped, minus the operating expense spent so far.
function moneyStats(goal: ProfitGoal, result: SimResult, snapshot: Snapshot): Stat[] {
  const now = profitSoFar(goal, result, snapshot)
  return [
    { label: 'Profit', value: money(now.profit) },
    { label: 'Throughput', value: money(now.throughput) },
    { label: 'Operating expense', value: money(now.expense) },
    { label: 'Inventory', value: money(now.inventory) },
    { label: 'Shipped', value: snapshot.shipped },
  ]
}

// What each star asks for, shown before the player plans.
function StarGoals({ goal }: { goal: BufferGoal }) {
  return (
    <ol className="star-goals">
      <li>
        <Stars earned={1} max={1} /> Buffer healthy at least {percent(goal.minHealthy)} of the shift
      </li>
      <li>
        <Stars earned={2} max={2} /> And no more than {goal.maxAvgWip} robots on the floor on average
      </li>
      <li>
        <Stars earned={3} max={3} /> And both again on {goal.freshDays} more days you haven't seen
      </li>
    </ol>
  )
}

// Each bar the run cleared or missed, including the fresh days behind the third star.
function StarChecklist({ goal, result, fresh }: { goal: BufferGoal; result: SimResult; fresh: SimResult[] }) {
  const score = bufferScore(goal, result)
  const rows = [
    { ok: score.healthy >= goal.minHealthy, text: `Buffer healthy ${percent(score.healthy)} of the shift (goal: ${percent(goal.minHealthy)})` },
    { ok: score.avgWip <= goal.maxAvgWip, text: `${tenths(score.avgWip)} robots on the floor on average (limit: ${goal.maxAvgWip})` },
  ]
  const days = fresh.map((day) => bufferScore(goal, day))
  return (
    <div className="checklist">
      <ul>
        {rows.map((row) => (
          <li key={row.text} className={row.ok ? 'ok' : 'miss'}>
            <Icon name={row.ok ? 'check' : 'cross'} /> {row.text}
          </li>
        ))}
      </ul>
      <p className="days-title">The same plan on {days.length} more days:</p>
      <ol className="days">
        {days.map((day, i) => (
          <li key={i} className={day.both ? 'ok' : 'miss'}>
            <strong>
              <Icon name={day.both ? 'check' : 'cross'} /> Day {i + 2}
            </strong>
            <span>{percent(day.healthy)} healthy</span>
            <span>{tenths(day.avgWip)} on the floor</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function breakWindows(model: FactoryModel) {
  const windows = new Map<string, { from: number; to: number }>()
  for (const station of model.stations) {
    for (const b of station.breaks ?? []) windows.set(`${b.from}-${b.to}`, b)
  }
  return [...windows.values()].sort((a, b) => a.from - b.from)
}

// What each star asks of an elevate plan, shown before the player plans.
function ElevateStarGoals({ goal }: { goal: ElevateGoal }) {
  const days = goal.freshDays + 1
  return (
    <ol className="star-goals">
      <li>
        <Stars earned={1} max={1} /> Ship at least {goal.target} a shift, on all {days} days
      </li>
      <li>
        <Stars earned={2} max={2} /> And keep it steady: no pile of {goal.pileLimit} or more for {percent(goal.minSteady)} of each shift
      </li>
      <li>
        <Stars earned={3} max={3} /> And spend wisely: at least {goal.minGainPer1000} more a shift for every $1,000
      </li>
    </ol>
  )
}

// Each bar an elevate plan cleared or missed, day by day.
function ElevateChecklist(props: { goal: ElevateGoal; result: SimResult; fresh: SimResult[]; investment: Investment }) {
  const { goal, result, fresh, investment } = props
  const score = elevateScore(goal, result, fresh, investment)
  const hits = score.days.filter((day) => day.hit).length
  const calm = score.days.filter((day) => day.calm).length
  const total = score.days.length
  const gained = result.output - investment.baseline
  const rows = [
    { ok: hits === total, text: `Shipped at least ${goal.target} on ${hits} of ${total} days` },
    { ok: calm === total, text: `Steady on ${calm} of ${total} days` },
    {
      ok: score.gain >= goal.minGainPer1000,
      text:
        investment.spend === 0
          ? `Spent nothing, and shipped ${gained} more than before`
          : `Spent ${dollars(investment.spend)} for ${gained} more a shift: ${tenths(score.gain)} per $1,000 (goal: ${goal.minGainPer1000})`,
    },
  ]
  return (
    <div className="checklist">
      <ul>
        {rows.map((row) => (
          <li key={row.text} className={row.ok ? 'ok' : 'miss'}>
            <Icon name={row.ok ? 'check' : 'cross'} /> {row.text}
          </li>
        ))}
      </ul>
      <p className="days-title">Your plan, day by day (day 1 is the one you watched):</p>
      <ol className="days compact">
        {score.days.map((day, i) => (
          <li key={i} className={day.hit && day.calm ? 'ok' : 'miss'}>
            <strong>
              <Icon name={day.hit && day.calm ? 'check' : 'cross'} /> Day {i + 1}
            </strong>
            <span>{day.output} shipped</span>
            <span>{percent(day.steady)} steady</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// What each star asks of a flow plan, shown before the player plans.
function FlowStarGoals({ goal }: { goal: FlowGoal }) {
  return (
    <ol className="star-goals">
      <li>
        <Stars earned={1} max={1} /> Ship at least {goal.target} a shift
      </li>
      <li>
        <Stars earned={2} max={2} /> And get each order out in {goal.maxLeadTime} minutes or less, on average
      </li>
      <li>
        <Stars earned={3} max={3} /> And both again on {goal.freshDays} more days you haven't seen
      </li>
    </ol>
  )
}

// Each bar a flow plan cleared or missed, and the same plan on fresh days.
function FlowChecklist({ goal, result, fresh }: { goal: FlowGoal; result: SimResult; fresh: SimResult[] }) {
  const rows = [
    { ok: result.output >= goal.target, text: `Shipped ${result.output} (goal: ${goal.target})` },
    { ok: (result.avgLeadTime ?? Infinity) <= goal.maxLeadTime, text: `About ${minutes(result.avgLeadTime)} from order to shipping (goal: ${goal.maxLeadTime} min or less)` },
  ]
  return (
    <div className="checklist">
      <ul>
        {rows.map((row) => (
          <li key={row.text} className={row.ok ? 'ok' : 'miss'}>
            <Icon name={row.ok ? 'check' : 'cross'} /> {row.text}
          </li>
        ))}
      </ul>
      <p className="days-title">The same plan on {fresh.length} more days:</p>
      <ol className="days compact">
        {fresh.map((day, i) => {
          const ok = flowHolds(goal, day)
          return (
            <li key={i} className={ok ? 'ok' : 'miss'}>
              <strong>
                <Icon name={ok ? 'check' : 'cross'} /> Day {i + 2}
              </strong>
              <span>{day.output} shipped</span>
              <span>{minutes(day.avgLeadTime)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// What each star asks of a profit plan, shown before the player plans.
function ProfitStarGoals({ goal }: { goal: ProfitGoal }) {
  return (
    <ol className="star-goals">
      <li>
        <Stars earned={1} max={1} /> Make at least {money(goal.target)} profit a shift, on all {goal.freshDays + 1} days
      </li>
      <li>
        <Stars earned={2} max={2} /> And ship at least {goal.minShipped} a shift
      </li>
      <li>
        <Stars earned={3} max={3} /> And keep inventory to {money(goal.maxInventory)} or less, on average
      </li>
    </ol>
  )
}

// Each bar a profit plan cleared or missed, day by day.
function ProfitChecklist({ goal, result, fresh }: { goal: ProfitGoal; result: SimResult; fresh: SimResult[] }) {
  const days = [result, ...fresh].map((day) => profitScore(goal, day))
  const count = (ok: (day: ProfitScore) => boolean) => days.filter(ok).length
  const total = days.length
  const profitable = count((day) => day.profit >= goal.target)
  const busy = count((day) => day.shipped >= goal.minShipped)
  const lean = count((day) => day.inventory <= goal.maxInventory)
  const lowest = Math.min(...days.map((day) => day.profit))
  const rows = [
    { ok: profitable === total, text: `At least ${money(goal.target)} profit on ${profitable} of ${total} days (lowest: ${money(lowest)})` },
    { ok: busy === total, text: `Shipped at least ${goal.minShipped} on ${busy} of ${total} days` },
    { ok: lean === total, text: `Inventory ${money(goal.maxInventory)} or less on average, on ${lean} of ${total} days` },
  ]
  return (
    <div className="checklist">
      <ul>
        {rows.map((row) => (
          <li key={row.text} className={row.ok ? 'ok' : 'miss'}>
            <Icon name={row.ok ? 'check' : 'cross'} /> {row.text}
          </li>
        ))}
      </ul>
      <p className="days-title">Your plan, day by day (day 1 is the one you watched):</p>
      <ol className="days compact">
        {days.map((day, i) => {
          const ok = day.profit >= goal.target && day.shipped >= goal.minShipped && day.inventory <= goal.maxInventory
          return (
            <li key={i} className={ok ? 'ok' : 'miss'}>
              <strong>
                <Icon name={ok ? 'check' : 'cross'} /> Day {i + 1}
              </strong>
              <span>{money(day.profit)} profit</span>
              <span>{day.shipped} shipped</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
