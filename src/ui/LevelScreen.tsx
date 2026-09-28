import { useMemo, useState } from 'react'
import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { feedbackFor } from '../levels/graph.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import type { Level } from '../levels/types.ts'
import type { ProgressEvent } from '../progress/store.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { usePlayback } from './usePlayback.ts'

const MINUTES_PER_SECOND = 6
const SPEEDS = [1, 4]

interface LevelScreenProps {
  level: Level
  nextLevel: Level | null
  onRecord: (event: ProgressEvent) => void
  onExit: () => void
  onNext: (level: Level) => void
}

interface Feedback {
  correct: boolean
  title: string
  body: string
}

export function LevelScreen({ level, nextLevel, onRecord, onExit, onNext }: LevelScreenProps) {
  const { goal, model } = level
  const result = useMemo(() => simulate(model, level.seed), [model, level.seed])
  const [speed, setSpeed] = useState(1)
  const playback = usePlayback(model.horizon, MINUTES_PER_SECOND * speed)
  const snapshot = useMemo(() => snapshotAt(result, playback.t), [result, playback.t])
  const [briefing, setBriefing] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const stationName = (id: string | null) => model.stations.find((s) => s.id === id)?.name
  const watched = playback.t >= goal.watchMinutes

  const start = () => {
    setBriefing(false)
    onRecord({ type: 'started', levelId: level.id })
    playback.play()
  }

  const lockIn = () => {
    if (!selected) return
    const correct = selected === goal.answer
    onRecord({ type: 'answered', levelId: level.id, answer: selected, correct })
    if (correct) {
      setSolved(true)
      onRecord({ type: 'completed', levelId: level.id })
    }
    playback.pause()
    const popup = feedbackFor(level, selected)
    setFeedback({
      correct,
      title: popup?.title ?? (correct ? 'Correct' : 'Not quite'),
      body: popup ? fillTemplate(popup.body, model, snapshot) : '',
    })
  }

  const resume = () => {
    setFeedback(null)
    if (!playback.finished) playback.play()
  }

  return (
    <div className="screen level-screen">
      <header className="level-header">
        <button className="btn small" onClick={onExit}>
          <Icon name="back" /> Levels
        </button>
        <div className="level-title">
          <span className="tier-chip">Tier {level.tier}</span>
          <h1>{level.title}</h1>
        </div>
        <div className="shipped-chip">
          Shipped <strong>{snapshot.shipped}</strong>
        </div>
      </header>

      <div className="floor">
        <FactoryView
          model={model}
          snapshot={snapshot}
          selected={selected}
          constraint={solved ? goal.answer : null}
          onSelect={solved ? undefined : setSelected}
        />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <div className="panel">
          <div className="legend" aria-hidden="true">
            <span>
              <i className="swatch" /> Part waiting
            </span>
            <span>
              <i className="swatch dot" /> Working
            </span>
            <span>
              <i className="swatch dot off" /> Waiting for parts
            </span>
          </div>
          <div className="controls">
            <button className="btn primary" onClick={playback.playing ? playback.pause : playback.play}>
              <Icon name={playback.playing ? 'pause' : 'play'} />
              {playback.playing ? 'Pause' : playback.finished ? 'Replay' : 'Play'}
            </button>
            <div className="speed" role="group" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button key={s} className={`btn small${speed === s ? ' active' : ''}`} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
            <button className="btn" onClick={playback.restart}>
              <Icon name="restart" /> Restart
            </button>
            <button className="btn" onClick={playback.skipToEnd}>
              <Icon name="skip" /> End of shift
            </button>
          </div>
          <div className="clock">
            <span>
              Shift clock {clock(playback.t)} of {clock(model.horizon)}
            </span>
            <div className="clock-track">
              <div className="clock-fill" style={{ width: `${(100 * playback.t) / model.horizon}%` }} />
            </div>
          </div>
        </div>

        <section className="question card" aria-live="polite">
          {solved ? (
            <>
              <p className="prompt">Solved: {stationName(goal.answer)} is the constraint.</p>
              <div className="actions">
                {nextLevel && (
                  <button className="btn primary big" onClick={() => onNext(nextLevel)}>
                    Next level <Icon name="next" />
                  </button>
                )}
                <button className="btn big" onClick={onExit}>
                  Back to levels
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="prompt">{goal.prompt}</p>
              <p className="hint">
                {selected ? (
                  <>
                    Your pick: <strong>{stationName(selected)}</strong>. Tap another station to change it.
                  </>
                ) : (
                  'Tap a station to pick it.'
                )}
              </p>
              <button className="btn primary big" disabled={!selected || !watched} onClick={lockIn}>
                Lock in my answer
              </button>
              {!watched && <p className="hint">Watch at least {duration(goal.watchMinutes)} of the shift first.</p>}
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
              Start the shift <Icon name="play" />
            </button>
          }
        >
          <p>{level.briefing}</p>
        </Dialog>
      )}

      {feedback && (
        <Dialog
          kicker={feedback.correct ? 'Correct' : 'Not quite'}
          title={feedback.title}
          tone={feedback.correct ? 'good' : 'retry'}
          actions={
            feedback.correct ? (
              <>
                {nextLevel ? (
                  <button className="btn primary big" onClick={() => onNext(nextLevel)}>
                    Next level <Icon name="next" />
                  </button>
                ) : (
                  <button className="btn primary big" onClick={onExit}>
                    Back to levels
                  </button>
                )}
                {!playback.finished && (
                  <button className="btn big" onClick={resume}>
                    Watch the rest
                  </button>
                )}
              </>
            ) : (
              <button className="btn primary big" onClick={resume}>
                Keep watching
              </button>
            )
          }
        >
          <p>{feedback.body}</p>
          {feedback.correct &&
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

function clock(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`
}

function duration(minutes: number) {
  if (minutes % 60 !== 0) return `${minutes} minutes`
  return minutes === 60 ? 'an hour' : `${minutes / 60} hours`
}
