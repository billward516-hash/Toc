import { useMemo, useRef, useState } from 'react'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { leadTimeSoFar, snapshotAt } from '../engine/timeline.ts'
import { tenths } from '../levels/values.ts'
import { EXPERIMENTS, type Experiment } from '../sandbox/experiments.ts'
import {
  addStation,
  changeStation,
  DEFAULT_SETUP,
  describeChanges,
  LIMITS,
  machineWords,
  onPaper,
  releaseOfKind,
  removeStation,
  sameSetup,
  sandboxModel,
  SHIFT,
  STEPS,
  stepped,
  variationWords,
  type Range,
  type SandboxRelease,
  type SandboxSetup,
  type SandboxStation,
  type Variation,
} from '../sandbox/setup.ts'
import { FactoryView, StationMark } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { PlaybackPanel, ScreenHeader, type Stat } from './parts.tsx'
import { haltLabels } from './shiftEvents.ts'
import { SimulationLog } from './SimLog.tsx'
import { reveal, showFloor } from './scroll.ts'
import { MINUTES_PER_SECOND, usePlayback, type Playback } from './usePlayback.ts'

// One run of the player's line on one day, kept to compare later runs with.
interface Run {
  number: number
  day: number
  setup: SandboxSetup
  result: SimResult
  // What changed from the run before, a few words for each change.
  changes: string[]
}

interface FreePlayProps {
  initial: SandboxSetup
  onSave: (setup: SandboxSetup) => void
  onExit: () => void
}

const DAYS: Range = { min: 1, max: 999, step: 1 }
const SHOWN_RUNS = 8

const VARIATIONS: [Variation, string][] = [
  ['none', 'None'],
  ['some', 'Some'],
  ['lots', 'Lots'],
]

const RELEASES: [SandboxRelease['kind'], string][] = [
  ['busy', 'Keep everyone busy'],
  ['rope', 'Tie a rope'],
  ['pace', 'Set a pace'],
]

// Free play (spec §3.4): build a line, run it, change it, and run it again, with nothing scored and no
// pop-ups. Each day brings its own luck, so two lines run on the same day compare fairly.
export function FreePlay({ initial, onSave, onExit }: FreePlayProps) {
  const [setup, setSetup] = useState(initial)
  const [day, setDay] = useState(1)
  const [runs, setRuns] = useState<Run[]>([])
  const [speed, setSpeed] = useState(1)
  // The station whose settings are open.
  const [open, setOpen] = useState<number | null>(null)
  // The thing to try that the player picked, and whether the list of them is open.
  const [trying, setTrying] = useState<Experiment | null>(null)
  const [listOpen, setListOpen] = useState(true)
  const rows = useRef<(HTMLLIElement | null)[]>([])
  const model = useMemo(() => sandboxModel(setup), [setup])
  const result = useMemo(() => simulate(model, day), [model, day])
  const playback = usePlayback(SHIFT, MINUTES_PER_SECOND * speed)
  const snapshot = useMemo(() => snapshotAt(result, playback.t), [result, playback.t])
  const latest = runs.at(-1)
  // Whether the line on the floor, on this day, has been run: played, or looked at anywhere in its shift.
  const ran = latest !== undefined && latest.day === day && sameSetup(latest.setup, setup)
  const earlier = ran ? runs.slice(0, -1) : runs
  // A run's results show once its shift is over.
  const done = ran && playback.finished ? latest : null
  const { release } = setup

  // Checked against the latest list, so a burst of seeks while dragging records the run once.
  const record = () => {
    setRuns((previous) => {
      const last = previous.at(-1)
      if (last && last.day === day && sameSetup(last.setup, setup)) return previous
      return [...previous, { number: previous.length + 1, day, setup, result, changes: last ? describeChanges(last.setup, setup) : [] }]
    })
  }

  // Playing the shift, or looking at any moment of it, runs the line.
  const controls: Playback = {
    ...playback,
    play: () => {
      record()
      playback.play()
    },
    restart: () => {
      record()
      playback.restart()
    },
    skipToEnd: () => {
      record()
      playback.skipToEnd()
    },
    seekTo: (minutes) => {
      record()
      playback.seekTo(minutes)
    },
  }

  // Any change shows the new line at the start of its shift, ready to run.
  const change = (next: SandboxSetup) => {
    if (open !== null && open >= next.stations.length) setOpen(null)
    setSetup(next)
    onSave(next)
    playback.rewind()
  }

  const tryIt = (experiment: Experiment) => {
    setTrying(experiment)
    setListOpen(false)
    setOpen(null)
    change(experiment.setup)
  }

  const changeDay = (next: number) => {
    setDay(next)
    playback.rewind()
  }

  // Run from the editor, then watch it on the floor.
  const runShift = () => {
    controls.restart()
    showFloor()
  }

  // A station tapped on the floor opens its settings.
  const openStation = (id: string) => {
    const i = STEPS.findIndex((step) => step.id === id)
    setOpen(i)
    reveal(rows.current[i])
  }

  const stats: Stat[] = [
    { label: 'Shipped', value: snapshot.shipped },
    { label: 'In process', value: snapshot.released - snapshot.shipped },
    { label: 'Lead time', value: minutes(leadTimeSoFar(result, playback.t)) },
    { label: 'Day', value: day },
  ]

  return (
    <div className="screen level-screen">
      <ScreenHeader chip="Free play" title="Build your own line" stats={stats} onExit={onExit} />

      <p className={`viewing${ran ? ' mine' : ''}`}>{ran ? `Run ${latest.number}, day ${day}` : 'Your line, ready to run'}</p>
      <div className="floor">
        <FactoryView model={model} snapshot={snapshot} selected={open === null ? null : STEPS[open].id} selectedTag="Editing" onSelect={openStation} glide={playback.gliding ? speed : 0} />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <PlaybackPanel
          playback={controls}
          speed={speed}
          onSpeed={setSpeed}
          horizon={SHIFT}
          legend={haltLabels(model).map((label) => (
            <span key={label}>
              <i className="swatch dot jammed" /> {label}
            </span>
          ))}
        >
          <SimulationLog model={model} result={result} t={playback.t} unit="robots" />
          {trying && (
            <section className="trying" aria-label="What you're trying">
              <h3>{trying.title}</h3>
              <p>{trying.text}</p>
              <button className="btn small" onClick={() => setTrying(null)}>
                <Icon name="check" /> Done
              </button>
            </section>
          )}
          {(done || earlier.length > 0) && <RunsTable current={done} earlier={earlier} />}
          {done && <StationTable run={done} />}
          <details className="things-to-try" open={listOpen} onToggle={(event) => setListOpen(event.currentTarget.open)}>
            <summary>Things to try</summary>
            <ol>
              {EXPERIMENTS.map((experiment) => (
                <li key={experiment.id}>
                  <strong>{experiment.title}</strong>
                  <p>{experiment.text}</p>
                  <button className="btn small" onClick={() => tryIt(experiment)}>
                    Set it up <Icon name="next" />
                  </button>
                </li>
              ))}
            </ol>
          </details>
        </PlaybackPanel>

        <section className="card sandbox" aria-label="Your line">
          <p className="hint">Tap a station to change it, here or on the floor, then run the shift. Nothing here is scored, so try anything.</p>
          <ol className="line-editor">
            {setup.stations.map((station, i) => (
              <li
                key={i}
                ref={(row) => {
                  rows.current[i] = row
                }}
                className={`station-editor${open === i ? ' open' : ''}`}
              >
                <button className="station-top" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <StationMark index={i} kind={STEPS[i].id} />
                  <span className="station-text">
                    <strong>{STEPS[i].name}</strong>
                    <span>{summary(station)}</span>
                  </span>
                  <span className="paper">
                    <strong>{Math.round(onPaper(setup, i))}</strong> a shift
                  </span>
                  <Icon name="next" />
                </button>
                {open === i && <StationSettings name={STEPS[i].name} station={station} onChange={(patch) => change(changeStation(setup, i, patch))} />}
              </li>
            ))}
          </ol>
          <p className="hint">A shift: what each station could make on paper, if it never waited for work, with jams at their average.</p>
          <div className="actions">
            <button className="btn small" disabled={setup.stations.length >= LIMITS.stations.max} onClick={() => change(addStation(setup))}>
              <Icon name="plus" /> Add {STEPS[Math.min(setup.stations.length, STEPS.length - 1)].name}
            </button>
            <button
              className="btn small"
              disabled={setup.stations.length <= LIMITS.stations.min}
              onClick={() => change(removeStation(setup))}
            >
              <Icon name="minus" /> Remove {STEPS[setup.stations.length - 1].name}
            </button>
            <button className="btn small" disabled={sameSetup(setup, DEFAULT_SETUP)} onClick={() => change(DEFAULT_SETUP)}>
              <Icon name="restart" /> Back to the first line
            </button>
          </div>

          <fieldset className="lever">
            <legend>
              <Icon name="rope" /> How new work starts
            </legend>
            <Choice options={RELEASES} value={release.kind} onChange={(kind) => change({ ...setup, release: releaseOfKind(setup, kind) })} />
            {release.kind === 'rope' && (
              <div className="settings-row">
                <Choice
                  label="Tied to"
                  name="Rope tied to"
                  options={setup.stations.map((_, i): [number, string] => [i, STEPS[i].name])}
                  value={release.station}
                  onChange={(station) => change({ ...setup, release: { ...release, station } })}
                />
                <Stepper label="Robots" name="Robots on the rope" value={release.length} range={LIMITS.rope} onChange={(length) => change({ ...setup, release: { ...release, length } })} />
              </div>
            )}
            {release.kind === 'pace' && (
              <Stepper label="Minutes between robots" name="Minutes between robots" value={release.every} range={LIMITS.pace} onChange={(every) => change({ ...setup, release: { ...release, every } })} />
            )}
            <p className="hint">{releaseHint(release)}</p>
          </fieldset>

          <div className="day-row">
            <Stepper label="Day" name="Day" value={day} range={DAYS} onChange={changeDay} />
            <p className="hint">Each day brings its own luck: other variation, other jams. To compare two lines fairly, run them on the same day.</p>
          </div>
          <div className="run-bar">
            <button className="btn primary big" onClick={runShift}>
              Run the shift <Icon name="play" />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

// A station's settings in a few words: "4 min, 2 machines, lots of variation, jams".
function summary(station: SandboxStation): string {
  return [`${station.minutes} min`, machineWords(station.machines), variationWords[station.variation], ...(station.jams ? ['jams'] : [])].join(', ')
}

function StationSettings({ name, station, onChange }: { name: string; station: SandboxStation; onChange: (patch: Partial<SandboxStation>) => void }) {
  return (
    <div className="station-settings">
      <Stepper label="Minutes a robot" name={`${name}: minutes a robot`} value={station.minutes} range={LIMITS.minutes} onChange={(minutes) => onChange({ minutes })} />
      <Stepper label="Machines" name={`${name}: machines`} value={station.machines} range={LIMITS.machines} onChange={(machines) => onChange({ machines })} />
      <Choice label="Variation" name={`${name}: variation`} options={VARIATIONS} value={station.variation} onChange={(variation) => onChange({ variation })} />
      <Choice
        label="Jams"
        name={`${name}: jams`}
        options={[
          [false, 'Off'],
          [true, 'On'],
        ]}
        value={station.jams}
        onChange={(jams) => onChange({ jams })}
      />
    </div>
  )
}

function releaseHint(release: SandboxRelease): string {
  switch (release.kind) {
    case 'busy':
      return `${STEPS[0].name} starts a new robot whenever it's free, so it never waits for work.`
    case 'rope':
      return `A new robot starts only while fewer than ${release.length} are on their way to ${STEPS[release.station].name}.`
    case 'pace':
      return `A new robot starts every ${release.every} minutes, whatever happens on the line.`
  }
}

// A number with a button either side: one step less, one step more.
function Stepper({ label, name, value, range, onChange }: { label: string; name: string; value: number; range: Range; onChange: (value: number) => void }) {
  return (
    <div className="stepper" role="group" aria-label={name}>
      <span className="setting-label">{label}</span>
      <button className="chip step" aria-label="Less" disabled={value <= range.min} onClick={() => onChange(stepped(value, -1, range))}>
        <Icon name="minus" />
      </button>
      <output aria-live="polite">{value}</output>
      <button className="chip step" aria-label="More" disabled={value >= range.max} onClick={() => onChange(stepped(value, 1, range))}>
        <Icon name="plus" />
      </button>
    </div>
  )
}

// One choice from a few, as chips, named for screen readers unless it's already in a named group.
function Choice<T extends string | number | boolean>(props: { label?: string; name?: string; options: [T, string][]; value: T; onChange: (value: T) => void }) {
  const { label, name, options, value, onChange } = props
  return (
    <div className="choice" role={name ? 'group' : undefined} aria-label={name}>
      {label && <span className="setting-label">{label}</span>}
      <div className="chips">
        {options.map(([option, text]) => (
          <button key={text} className={`chip${value === option ? ' on' : ''}`} aria-pressed={value === option} onClick={() => onChange(option)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

// Every run so far, newest first: the one just watched, once its shift is over, then the earlier ones.
function RunsTable({ current, earlier }: { current: Run | null; earlier: Run[] }) {
  const shown = [...(current ? [current] : []), ...[...earlier].reverse()].slice(0, SHOWN_RUNS)
  return (
    <section className="runs" aria-label="Your runs">
      <h3>Your runs</h3>
      <table className="data-table runs-table">
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">What changed</th>
            <th scope="col">Shipped</th>
            <th scope="col">In process</th>
            <th scope="col">Lead time</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((run) => (
            <tr key={run.number} className={run === current ? 'current' : undefined}>
              <th scope="row">
                {run.number} <small>day {run.day}</small>
              </th>
              <td className="changes">{run.changes.length > 0 ? run.changes.join('; ') : run.number === 1 ? 'First run' : 'Same line'}</td>
              <td>{run.result.output}</td>
              <td>{tenths(run.result.avgWip)}</td>
              <td>{minutes(run.result.avgLeadTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">In process and lead time are averages over the shift.</p>
    </section>
  )
}

// Each station over the whole of a finished run.
function StationTable({ run }: { run: Run }) {
  return (
    <section className="runs" aria-label={`Each station in run ${run.number}`}>
      <h3>Each station in run {run.number}</h3>
      <table className="data-table station-table">
        <thead>
          <tr>
            <th scope="col">Station</th>
            <th scope="col">On paper</th>
            <th scope="col">Made</th>
            <th scope="col">Busy</th>
            <th scope="col">Waiting</th>
          </tr>
        </thead>
        <tbody>
          {run.result.stations.map((station, i) => (
            <tr key={station.id}>
              <th scope="row">{STEPS[i].name}</th>
              <td>{Math.round(onPaper(run.setup, i))}</td>
              <td>{station.completed}</td>
              <td>{Math.round(100 * station.utilization)}%</td>
              <td>{tenths(station.avgQueue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Busy: the share of the shift it was working. Waiting: robots in front of it, on average.</p>
    </section>
  )
}

const minutes = (value: number | null) => (value === null ? '–' : `${Math.round(value)} min`)
