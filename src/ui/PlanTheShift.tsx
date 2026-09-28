import { useMemo, useState } from 'react'
import type { FactoryModel } from '../engine/model.ts'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { bufferShare, bufferZones, snapshotAt, steadyShare, type ZoneSpan } from '../engine/timeline.ts'
import { bufferScore, feedbackForRun, goalMet, maxStars, starsFor } from '../levels/graph.ts'
import { applyLevers, leverValues, valueLabel } from '../levels/levers.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import type { Choices, Goal, Lever } from '../levels/types.ts'
import { goalValues, tenths } from '../levels/values.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView, type Badge } from './FactoryView.tsx'
import { Icon, type IconName } from './icons.tsx'
import { JamLog, LevelHeader, PlaybackPanel, Stars, type JamEntry, type Stat } from './parts.tsx'
import type { LevelFlowProps } from './types.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

type PlanGoal = Extract<Goal, { kind: 'output' | 'steady' | 'buffer' }>
type BufferGoal = Extract<Goal, { kind: 'buffer' }>

interface Run {
  plan: Choices
  model: FactoryModel
  result: SimResult
  // The same plan on days the player hasn't seen, for a buffer level's third star.
  fresh: SimResult[]
  met: boolean
  stars: number
}

export function PlanTheShift({ level, goal, nextLevel, onRecord, onExit, onNext }: LevelFlowProps<'output' | 'steady' | 'buffer'>) {
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
  const ready = levers.every((lever) => choices[lever.id] !== undefined)
  const windows = breakWindows(model)
  const showResult = run !== null && playback.finished && !dismissed
  const popup = run ? feedbackForRun(level, run.met, run.plan) : undefined
  const pileLimit = goal.kind === 'steady' ? goal.pileLimit : 5
  const drum = goal.kind === 'buffer' ? model.stations.findIndex((s) => s.id === goal.drum) : -1
  const zones = useMemo(
    () => (goal.kind === 'buffer' ? bufferZones(shown.result, drum, goal.low, goal.high) : undefined),
    [goal, shown.result, drum],
  )
  const jams = model.stations.some((s) => s.jams) && zones ? jamLog(shown.model, shown.result, zones, playback.t) : null

  const stats: Stat[] = [{ label: 'Shipped', value: snapshot.shipped }]
  if (goal.kind === 'steady') {
    stats.push({ label: 'Steady', value: `${Math.floor(100 * steadyShare(shown.result, goal.pileLimit, playback.t))}%` })
  }
  if (goal.kind === 'buffer') {
    stats.push({ label: 'Healthy', value: percent(bufferShare(shown.result, drum, goal.low, goal.high, playback.t)) })
  }
  stats.push({ label: goal.kind === 'buffer' ? 'On the floor' : 'In process', value: snapshot.released - snapshot.shipped })
  if (goal.kind === 'output') stats.push({ label: 'Goal', value: goal.target })

  const start = () => {
    setBriefing(false)
    onRecord({ type: 'started', levelId: level.id })
    playback.play()
  }

  const runPlan = () => {
    const planModel = applyLevers(model, levers, choices)
    const result = simulate(planModel, seed)
    const fresh = goal.kind === 'buffer' ? freshSeeds(goal.freshDays, seed).map((day) => simulate(planModel, day)) : []
    const met = goalMet(goal, result)
    const earned = starsFor(goal, result, fresh)
    onRecord({ type: 'ran', levelId: level.id, choices, shipped: result.output, met, stars: earned })
    if (met) onRecord({ type: 'completed', levelId: level.id })
    setRun({ plan: choices, model: planModel, result, fresh, met, stars: earned })
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
          legend={
            <>
              {windows.length > 0 && (
                <span>
                  <i className="swatch dot resting" /> On break
                </span>
              )}
              {jams && (
                <span>
                  <i className="swatch dot jammed" /> Jammed
                </span>
              )}
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
                  {outcomeText(goal, run.result)} {run.met ? 'Goal met!' : 'Not there yet.'}
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
              <p className="prompt">{goal.prompt}</p>
              <p className="hint">{planningHint(goal, baseline)}</p>
              {goal.kind === 'buffer' && <StarGoals goal={goal} />}
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
            {resultStats(goal, run.result, baseline).map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.detail && <small>{stat.detail}</small>}
              </div>
            ))}
          </div>
          {stars > 0 && <Stars earned={run.stars} max={stars} />}
          {goal.kind === 'buffer' && <StarChecklist goal={goal} result={run.result} fresh={run.fresh} />}
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
}

const stationBadge: Partial<Record<Lever['kind'], Badge>> = {
  upgrade: 'upgraded',
  coverBreak: 'covered',
  steady: 'steadied',
  maintain: 'maintained',
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

function planningHint(goal: PlanGoal, baseline: SimResult): string {
  switch (goal.kind) {
    case 'output':
      return `Today the factory ships ${baseline.output} a shift. The goal is ${goal.target}.`
    case 'steady':
      return `Today the line is steady ${percent(steadyShare(baseline, goal.pileLimit))} of the shift. The goal: steady at least ${percent(goal.minSteady)} of the shift while shipping at least ${goal.minShipped}.`
    case 'buffer': {
      const today = bufferScore(goal, baseline)
      return `Today the buffer is healthy ${percent(today.healthy)} of the shift, with ${tenths(today.avgWip)} robots on the floor on average.`
    }
  }
}

function outcomeText(goal: PlanGoal, result: SimResult): string {
  switch (goal.kind) {
    case 'output':
      return `Shipped ${result.output}, goal ${goal.target}.`
    case 'steady':
      return `Steady ${percent(steadyShare(result, goal.pileLimit))} of the shift, shipped ${result.output}.`
    case 'buffer': {
      const score = bufferScore(goal, result)
      return `Buffer healthy ${percent(score.healthy)} of the shift, ${tenths(score.avgWip)} on the floor on average.`
    }
  }
}

function resultStats(goal: PlanGoal, result: SimResult, baseline: SimResult): Stat[] {
  switch (goal.kind) {
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
  }
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
