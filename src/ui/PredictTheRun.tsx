import { useMemo, useState } from 'react'
import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { feedbackForPrediction } from '../levels/graph.ts'
import { steadyTwin } from '../levels/levers.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import { goalValues } from '../levels/values.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { LevelHeader, PlaybackPanel } from './parts.tsx'
import type { LevelFlowProps } from './types.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

export function PredictTheRun({ level, goal, nextLevel, onRecord, onExit, onNext }: LevelFlowProps<'predict'>) {
  const { model, seed } = level
  const twinModel = useMemo(() => steadyTwin(model), [model])
  const twin = useMemo(() => simulate(twinModel, seed), [twinModel, seed])
  const real = useMemo(() => simulate(model, seed), [model, seed])
  const [speed, setSpeed] = useState(1)
  const playback = usePlayback(model.horizon, MINUTES_PER_SECOND * speed)
  const [briefing, setBriefing] = useState(true)
  const [choice, setChoice] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const shown = locked ? { model, result: real } : { model: twinModel, result: twin }
  const snapshot = useMemo(() => snapshotAt(shown.result, playback.t), [shown.result, playback.t])
  const values = goalValues(goal, twin, real)
  const fill = (text: string) => fillTemplate(text, model, snapshotAt(real, model.horizon), values)
  const popup = choice ? feedbackForPrediction(level, choice) : undefined
  const showResult = locked && playback.finished && !dismissed

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
    playback.restart()
  }

  return (
    <div className="screen level-screen">
      <LevelHeader
        level={level}
        stats={[
          { label: 'Shipped', value: snapshot.shipped },
          { label: 'In process', value: snapshot.released - snapshot.shipped },
        ]}
        onExit={onExit}
      />

      <p className={`viewing${locked ? ' mine' : ''}`}>{locked ? 'A real day: every robot rolls the dice' : 'A perfect day: every station takes exactly its average'}</p>
      <div className="floor">
        <FactoryView model={shown.model} snapshot={snapshot} />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <PlaybackPanel playback={playback} speed={speed} onSpeed={setSpeed} horizon={model.horizon} />

        <section className="question card" aria-live="polite">
          {locked ? (
            <>
              <p className="prompt">Your prediction: {fill(goal.options.find((o) => o.id === choice)?.label ?? '')}</p>
              {playback.finished ? (
                <p className="result">
                  The perfect day shipped {twin.output}. The real day shipped {real.output}.
                </p>
              ) : (
                <p className="hint">Watch the real day, or jump to the end of the shift.</p>
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
              <p className="hint">The perfect day shipped {twin.output}.</p>
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
                Run the real day <Icon name="play" />
              </button>
            </>
          ) : (
            <>
              <p className="prompt">Watch the perfect day.</p>
              <p className="hint">Every station takes exactly its average time. When the shift ends, you'll predict what a real day looks like.</p>
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
              Watch the perfect day <Icon name="play" />
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
              <button className="btn big" onClick={() => setDismissed(true)}>
                Look at the factory
              </button>
            </>
          }
        >
          <div className="result-stats two">
            <div>
              <span>Perfect day</span>
              <strong>{twin.output}</strong>
            </div>
            <div>
              <span>Real day</span>
              <strong>{real.output}</strong>
            </div>
          </div>
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
