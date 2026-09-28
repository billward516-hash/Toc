import { useMemo, useState } from 'react'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { feedbackForPrediction, secondDays } from '../levels/graph.ts'
import { applyChange, steadyTwin } from '../levels/levers.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import { goalValues } from '../levels/values.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { customers, shopStats } from './barTexts.ts'
import { LevelHeader, PlaybackPanel } from './parts.tsx'
import { productColor } from './products.ts'
import { ShiftLog } from './ShiftLog.tsx'
import { ShopDays } from './ShopDays.tsx'
import { haltLabels, hasDisruptions, shiftLog } from './shiftEvents.ts'
import type { LevelFlowProps } from './types.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

// Watch one day, predict another, then watch it: a perfect-day twin and the real line by default, or
// the line and the same line after a change, such as a breakdown. The second can be several days in
// a row, shown together as a chart, with any one of them to watch.
export function PredictTheRun({ level, goal, nextLevel, onRecord, onExit, onNext }: LevelFlowProps<'predict'>) {
  const { model, seed } = level
  const { compare } = goal
  const unit = level.unit ?? 'robots'
  const twinModel = useMemo(() => (compare ? model : steadyTwin(model)), [model, compare])
  const realModel = useMemo(() => (compare ? applyChange(model, compare.change) : model), [model, compare])
  const twin = useMemo(() => simulate(twinModel, seed), [twinModel, seed])
  const seconds = useMemo(() => secondDays(seed, compare).map((day) => simulate(realModel, day)), [realModel, seed, compare])
  const several = seconds.length > 1
  const [watching, setWatching] = useState(0)
  const real = seconds[watching]
  const days = compare ?? { first: 'The perfect day', second: 'The real day' }
  const [speed, setSpeed] = useState(1)
  const playback = usePlayback(model.horizon, MINUTES_PER_SECOND * speed)
  const [briefing, setBriefing] = useState(true)
  const [choice, setChoice] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const shown = locked ? { model: realModel, result: real } : { model: twinModel, result: twin }
  const snapshot = useMemo(() => snapshotAt(shown.result, playback.t), [shown.result, playback.t])
  const values = goalValues(goal, twin, seconds[0], seconds)
  const fill = (text: string) => fillTemplate(text, realModel, snapshotAt(seconds[0], model.horizon), values)
  const popup = choice ? feedbackForPrediction(level, choice) : undefined
  // Several days show all at once, as a chart; one day plays out first.
  const showResult = locked && (several || playback.finished) && !dismissed
  const told = (result: SimResult) => outcome(result, unit)

  const start = () => {
    setBriefing(false)
    onRecord({ type: 'started', levelId: level.id })
    playback.play()
  }

  const lockIn = () => {
    if (!choice) return
    onRecord({ type: 'predicted', levelId: level.id, option: choice, correct: choice === goal.answer })
    onRecord({ type: 'completed', levelId: level.id })
    setLocked(true)
    if (several) playback.rewind()
    else playback.restart()
  }

  const watch = (day: number) => {
    setWatching(day)
    playback.restart()
  }

  const lookAround = () => {
    setDismissed(true)
    if (several) playback.play()
  }

  return (
    <div className="screen level-screen">
      <LevelHeader
        level={level}
        stats={
          snapshot.shop
            ? shopStats(shown.result, snapshot.shop, playback.t)
            : [
                { label: 'Shipped', value: snapshot.shipped },
                { label: 'In process', value: snapshot.released - snapshot.shipped },
              ]
        }
        onExit={onExit}
      />

      <p className={`viewing${locked ? ' mine' : ''}`}>
        {compare
          ? locked
            ? several
              ? `${compare.second}: day ${watching + 1}`
              : compare.second
            : compare.first
          : locked
            ? 'A real day: every robot rolls the dice'
            : 'A perfect day: every station takes exactly its average'}
      </p>
      <div className="floor">
        <FactoryView model={shown.model} snapshot={snapshot} unit={unit} rushJobs={shown.result.rush} jobProducts={shown.result.products} />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <PlaybackPanel
          playback={playback}
          speed={speed}
          onSpeed={setSpeed}
          horizon={model.horizon}
          parts={model.products?.map((product) => (
            <span key={product.id}>
              <i className="swatch" style={{ background: productColor(model, product.id) }} /> {product.name}
            </span>
          ))}
          legend={
            <>
              {haltLabels(shown.model).length > 0 && (
                <span>
                  <i className="swatch dot jammed" /> {haltLabels(shown.model).map((label, k) => (k === 0 ? label : label.toLowerCase())).join(' or ')}
                </span>
              )}
              {shown.model.rush?.length ? (
                <span>
                  <i className="swatch rush" /> Rush order
                </span>
              ) : null}
            </>
          }
        >
          {hasDisruptions(shown.model) && <ShiftLog entries={shiftLog(shown.model, shown.result, playback.t, unit)} />}
        </PlaybackPanel>

        <section className="question card" aria-live="polite">
          {locked ? (
            <>
              <p className="prompt">Your prediction: {fill(goal.options.find((o) => o.id === choice)?.label ?? '')}</p>
              {several ? (
                <>
                  <ShopDays days={seconds} unit={unit} />
                  <fieldset className="lever">
                    <legend>Watch a day</legend>
                    <div className="chips">
                      {seconds.map((_, day) => (
                        <button key={day} className={`chip${watching === day ? ' on' : ''}`} aria-pressed={watching === day} onClick={() => watch(day)}>
                          Day {day + 1}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : playback.finished ? (
                <p className="result">
                  {days.first} {told(twin)}. {days.second} {told(real)}.
                </p>
              ) : (
                <p className="hint">Watch {lowerFirst(days.second)}, or jump to the end of the shift.</p>
              )}
              <div className="actions">
                {playback.finished && nextLevel && (
                  <button className="btn primary big" onClick={() => onNext(nextLevel)}>
                    Next level <Icon name="next" />
                  </button>
                )}
                <button className="btn big" onClick={onExit}>
                  Back to levels
                </button>
              </div>
            </>
          ) : playback.finished ? (
            <>
              <p className="prompt">{goal.prompt}</p>
              <p className="hint">
                {days.first} {told(twin)}.
              </p>
              <div className="chips">
                {goal.options.map((option) => (
                  <button
                    key={option.id}
                    className={`chip${choice === option.id ? ' on' : ''}`}
                    aria-pressed={choice === option.id}
                    onClick={() => setChoice(option.id)}
                  >
                    {fill(option.label)}
                  </button>
                ))}
              </div>
              <button className="btn primary big" disabled={!choice} onClick={lockIn}>
                {several ? 'See' : 'Watch'} {lowerFirst(days.second)} <Icon name="play" />
              </button>
            </>
          ) : (
            <>
              <p className="prompt">Watch {lowerFirst(days.first)}.</p>
              <p className="hint">
                {compare
                  ? `When the shift ends, you'll predict ${lowerFirst(compare.second)}.`
                  : "Every station takes exactly its average time. When the shift ends, you'll predict what a real day looks like."}
              </p>
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
              Watch {lowerFirst(days.first)} <Icon name="play" />
            </button>
          }
        >
          <p>{level.briefing}</p>
        </Dialog>
      )}

      {showResult && (
        <Dialog
          kicker={choice === goal.answer ? 'Good prediction' : 'Surprise'}
          title={popup?.title ?? 'The real day'}
          tone={choice === goal.answer ? 'good' : 'retry'}
          actions={
            <>
              <button className="btn primary big" onClick={nextLevel ? () => onNext(nextLevel) : onExit}>
                {nextLevel ? 'Next level' : 'Back to levels'} <Icon name="next" />
              </button>
              <button className="btn big" onClick={lookAround}>
                {several ? 'Watch the days' : 'Look at the factory'}
              </button>
            </>
          }
        >
          {several ? (
            <>
              <div className="result-stats four">
                {totals(seconds).map((stat) => (
                  <div key={stat.label}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
              <ShopDays days={seconds} unit={unit} />
            </>
          ) : (
            <div className="result-stats two">
              <div>
                <span>{shortDay(days.first)}</span>
                <strong>{twin.market?.sold ?? twin.output}</strong>
                {twin.market && <small>sold</small>}
              </div>
              <div>
                <span>{shortDay(days.second)}</span>
                <strong>{real.market?.sold ?? real.output}</strong>
                {real.market && <small>sold</small>}
              </div>
            </div>
          )}
          {popup && <p>{fill(popup.body)}</p>}
          {level.principles.map((p) => (
            <p key={p} className="principle-chip">
              Principle {p}: {principleNames[p]}
            </p>
          ))}
        </Dialog>
      )}
    </div>
  )
}

// What a day shipped, or at a shop counter, what it sold, threw out, and turned away.
function outcome(result: SimResult, unit: string): string {
  const shop = result.market
  if (!shop) return `shipped ${result.output}`
  return `sold ${shop.sold} ${unit}, threw ${shop.waste > 0 ? `out ${shop.waste}` : 'none out'}, and turned ${shop.lost > 0 ? customers(shop.lost) : 'no one'} away`
}

// The shop counter over several days, added up.
function totals(days: SimResult[]): { label: string; value: string }[] {
  const sum = (pick: (shop: NonNullable<SimResult['market']>) => number) =>
    days.reduce((total, day) => total + (day.market ? pick(day.market) : 0), 0).toLocaleString('en-US')
  return [
    { label: 'Customers', value: sum((shop) => shop.customers) },
    { label: 'Sold', value: sum((shop) => shop.sold) },
    { label: 'Thrown out', value: sum((shop) => shop.waste) },
    { label: 'Turned away', value: sum((shop) => shop.lost) },
  ]
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

// "The breakdown day" as a stat label: "Breakdown day".
function shortDay(text: string): string {
  const words = text.replace(/^(the|a|an) /i, '')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
