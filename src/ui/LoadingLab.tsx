import { useMemo, useRef, useState } from 'react'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { leadTimeSoFar, snapshotAt } from '../engine/timeline.ts'
import { loadCurve, outcomeOf, type Outcome } from '../loading/curve.ts'
import { bottlenecks, capacityPerHour, DAY, labModel, loadShare, noUpgrades, RATES, UPGRADE, workTime } from '../loading/lines.ts'
import {
  advice,
  GUESSES,
  judge,
  referenceOutcome,
  rightGuess,
  ROUND_MANY,
  ROUND_ONE,
  ROUND_TWO,
  ROUNDS,
  whatHappened,
  type Guess,
  type Round,
} from '../loading/rounds.ts'
import { queueSeries } from '../loading/series.ts'
import { STEPS } from '../sandbox/setup.ts'
import { FactoryView } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { CurveChart, CycleBar, QueueStrips, type CurveSeries } from './LabParts.tsx'
import { PlaybackPanel, ScreenHeader, type Stat } from './parts.tsx'
import { showFloor } from './scroll.ts'
import { usePlayback } from './usePlayback.ts'

// Simulated minutes per real second at 1x: a three-shift day plays in 80 seconds.
const MINUTES_PER_SECOND = 18
// Days averaged for the curves the lab draws after a round.
const CURVE_DAYS = 20
const CURVE_RATES = [8, 10, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24]
const STRIP_POINTS = 97

// How a round went, for the summary.
interface RoundLog {
  round: Round
  tries: number
  passed: boolean
  upgraded: boolean[]
  guess: { chosen: Guess; right: Guess } | null
}

// The loading lab: three short rounds that each ask how many orders the line can take before robots
// wait too long, on a line with one bottleneck, two, and five.
export function LoadingLab({ onExit }: { onExit: () => void }) {
  const [index, setIndex] = useState(0)
  const [log, setLog] = useState<RoundLog[]>([])
  if (index >= ROUNDS.length) {
    return (
      <LabSummary
        log={log}
        onAgain={() => {
          setLog([])
          setIndex(0)
        }}
        onExit={onExit}
      />
    )
  }
  return (
    <LabRound
      key={ROUNDS[index].id}
      round={ROUNDS[index]}
      number={index + 1}
      onFinish={(entry) => {
        setLog([...log, entry])
        setIndex(index + 1)
      }}
      onExit={onExit}
    />
  )
}

interface Run {
  number: number
  rate: number
  upgraded: boolean[]
  outcome: Outcome
  result: SimResult
}

const sameUpgrades = (a: readonly boolean[], b: readonly boolean[]) => a.every((v, i) => v === b[i])

function names(minutes: number[], upgraded: boolean[]): string {
  const necks = bottlenecks(minutes, upgraded)
  if (necks.length === minutes.length) return 'every station'
  const words = necks.map((i) => STEPS[i].name)
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0]
}

function LabRound({ round, number, onFinish, onExit }: { round: Round; number: number; onFinish: (log: RoundLog) => void; onExit: () => void }) {
  const [rate, setRate] = useState(round.predictAt ?? round.start)
  const [upgraded, setUpgraded] = useState(() => noUpgrades(round.minutes))
  const [runs, setRuns] = useState<Run[]>([])
  const [guess, setGuess] = useState<Guess | null>(null)
  const [speed, setSpeed] = useState(4)
  const [average, setAverage] = useState(false)
  const controlsRef = useRef<HTMLElement>(null)
  const model = useMemo(() => labModel(round.minutes, upgraded, rate), [round, upgraded, rate])
  const result = useMemo(() => simulate(model, round.day), [model, round.day])
  const outcome = useMemo(() => outcomeOf(round.minutes, upgraded, rate, result), [round, upgraded, rate, result])
  const playback = usePlayback(DAY, MINUTES_PER_SECOND * speed)
  const snapshot = useMemo(() => snapshotAt(result, playback.t), [result, playback.t])
  const necks = useMemo(() => bottlenecks(round.minutes, upgraded), [round, upgraded])
  const capacity = capacityPerHour(round.minutes, upgraded)
  const latest = runs.at(-1)
  const ran = latest !== undefined && latest.rate === rate && sameUpgrades(latest.upgraded, upgraded)
  const done = ran && playback.finished ? latest : null
  const verdict = done ? judge(round, done.outcome) : null
  const passed = runs.some((r) => judge(round, r.outcome).passed)
  const reference = useMemo(() => referenceOutcome(round), [round])
  const predicting = round.predictAt !== undefined && runs.length === 0
  const left = round.upgrades - upgraded.filter(Boolean).length
  const curve = useMemo(
    () => (average ? loadCurve(round.minutes, upgraded, CURVE_RATES, CURVE_DAYS) : null),
    [average, round, upgraded],
  )
  const strips = useMemo(() => (done ? queueSeries(done.result, STRIP_POINTS) : null), [done])

  const record = () => {
    setRuns((previous) => {
      const last = previous.at(-1)
      if (last && last.rate === rate && sameUpgrades(last.upgraded, upgraded)) return previous
      return [...previous, { number: previous.length + 1, rate, upgraded, outcome, result }]
    })
  }
  const controls = {
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
    seekTo: (minutes: number) => {
      record()
      playback.seekTo(minutes)
    },
  }

  // Any change to the load or the line shows it at the start of the day, ready to run.
  const changeRate = (next: number) => {
    setRate(Math.min(RATES.max, Math.max(RATES.min, next)))
    playback.rewind()
  }
  const toggleUpgrade = (i: number) => {
    if (round.upgrades === 0) return
    if (!upgraded[i] && left === 0) return
    setUpgraded(upgraded.map((v, k) => (k === i ? !v : v)))
    setAverage(false)
    playback.rewind()
  }
  const run = () => {
    controls.restart()
    showFloor()
  }

  const finish = () =>
    onFinish({
      round,
      tries: runs.length,
      passed,
      upgraded,
      guess: guess && reference && runs[0] ? { chosen: guess, right: rightGuess(runs[0].outcome.cycle / reference.cycle) } : null,
    })

  const stats: Stat[] = [
    { label: 'Shipped', value: snapshot.shipped },
    { label: 'In the factory', value: snapshot.released - snapshot.shipped },
    { label: 'Cycle time', value: leadTimeSoFar(result, playback.t) === null ? '–' : `${Math.round(leadTimeSoFar(result, playback.t) ?? 0)} min` },
    { label: 'Load', value: `${Math.round(100 * loadShare(round.minutes, upgraded, rate))}%` },
  ]
  const badges = Object.fromEntries(STEPS.slice(0, round.minutes.length).map((s, i) => [s.id, upgraded[i] ? ['upgraded' as const] : []]))
  const first = runs[0]
  const revealed = first && reference && guess && playback.finished && runs.length === 1 ? { first, reference, guess } : null

  return (
    <div className="screen level-screen lab">
      <ScreenHeader chip={`Loading lab · round ${number} of ${ROUNDS.length}`} title={round.title} stats={stats} onExit={onExit} />

      <Brief round={round} reference={reference} />

      <div className="floor">
        <FactoryView
          model={model}
          snapshot={snapshot}
          bottlenecks={model.stations.filter((_, i) => necks.includes(i)).map((s) => s.id)}
          badges={badges}
          onSelect={round.upgrades > 0 ? (id) => toggleUpgrade(STEPS.findIndex((s) => s.id === id)) : undefined}
          glide={playback.gliding ? speed : 0}
        />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <PlaybackPanel playback={controls} speed={speed} onSpeed={setSpeed} horizon={DAY}>
          {revealed && <Reveal {...revealed} />}
          {done && verdict && (
            <section className="runs lab-result" aria-label={`Run ${done.number}`} aria-live="polite">
              <h3>Run {done.number}</h3>
              <ul className={`verdict${verdict.passed ? ' won' : ''}`}>
                <li className={verdict.cycleOk ? 'ok' : 'miss'}>
                  <Icon name={verdict.cycleOk ? 'check' : 'cross'} />
                  <span>
                    Cycle time <strong>{Math.round(done.outcome.cycle)} min</strong>, no more than {round.mission.cycle}
                  </span>
                </li>
                <li className={verdict.shippedOk ? 'ok' : 'miss'}>
                  <Icon name={verdict.shippedOk ? 'check' : 'cross'} />
                  <span>
                    Shipped <strong>{done.outcome.shipped}</strong>, at least {round.mission.shipped}
                  </span>
                </li>
              </ul>
              <CycleBar cycle={done.outcome.cycle} waiting={done.outcome.waiting} />
              <p>{whatHappened(round, done.upgraded, done.outcome)}</p>
              <p className="advice">{advice(round, done.upgraded, done.outcome)}</p>
              {strips && <QueueStrips series={strips} bottlenecks={bottlenecks(round.minutes, done.upgraded)} horizon={DAY} />}
              <StationTable run={done} round={round} />
            </section>
          )}
          {runs.length > 0 && (
            <section className="runs" aria-label="Cycle time against load">
              <h3>Cycle time against load</h3>
              <CurveChart
                series={
                  curve
                    ? [{ name: `Average of ${CURVE_DAYS} days`, color: 'var(--blue)', points: curve, bold: true }]
                    : []
                }
                dots={runs.filter((r) => sameUpgrades(r.upgraded, upgraded)).map((r) => r.outcome)}
                limit={round.mission.cycle}
                label={`Cycle time against load. Your ${runs.length} runs${curve ? ' and the average of many days' : ''}.`}
              />
              <div className="actions">
                <button className="btn small" aria-pressed={average} onClick={() => setAverage(!average)}>
                  <Icon name="eye" /> {average ? 'Hide' : 'Show'} the average of {CURVE_DAYS} days
                </button>
              </div>
              <p className="hint">
                Each numbered dot is one of your runs, all on the same day with the same luck, so only the load differs. The curve is what many different days average out to.
              </p>
              <RunsTable runs={runs} round={round} />
            </section>
          )}
        </PlaybackPanel>

        <section className="card lab-controls" aria-label="Load the line" ref={controlsRef}>
          {predicting ? (
            <Predict round={round} reference={reference} guess={guess} onGuess={setGuess} />
          ) : (
            <Dial round={round} upgraded={upgraded} rate={rate} capacity={capacity} onChange={changeRate} />
          )}
          {round.upgrades > 0 && <Upgrades round={round} upgraded={upgraded} left={left} onToggle={toggleUpgrade} />}
          <div className="run-bar">
            <button className="btn primary big" disabled={predicting && guess === null} onClick={run}>
              {predicting ? 'Run it and see' : 'Run the day'} <Icon name="play" />
            </button>
            {(passed || runs.length >= 4) && (
              <button className={`btn big${passed ? ' next' : ''}`} onClick={finish}>
                {passed ? (number === ROUNDS.length ? 'See what it shows' : 'Next round') : 'Skip this round'} <Icon name="next" />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// What the round is, and what counts as done.
function Brief({ round, reference }: { round: Round; reference: Outcome | null }) {
  const cap = capacityPerHour(round.minutes)
  const work = workTime(round.minutes)
  const { mission } = round
  const goal = (
    <p className="mission">
      <Icon name="bolt" />
      <span>
        <strong>Mission:</strong> ship at least <strong>{mission.shipped} robots</strong> in the day, while the average robot spends no more than <strong>{mission.cycle} minutes</strong> in the factory.
      </span>
    </p>
  )
  const hint = (
    <p className="hint">
      <strong>Cycle time</strong> is the minutes from the order to the shipped robot. Actual work takes {Math.round(work)} of them; every minute more is waiting in a pile.
    </p>
  )
  if (round.id === 'one') {
    return (
      <section className="card lab-brief" aria-label="Round brief">
        <p>
          Orders for toy robots arrive all day, unevenly, and every step takes a little different time each robot. {STEPS[2].name} is the slowest step. It can make {cap} robots an hour, so <strong>{cap} orders an hour is a load of 100%</strong>: all it can do.
        </p>
        <p>You choose the load. Too few orders and the line sits idle; too many and robots wait in long piles. Slide the load, run the day, and find the sweet spot.</p>
        {goal}
        {hint}
      </section>
    )
  }
  if (round.id === 'two') {
    return (
      <section className="card lab-brief" aria-label="Round brief">
        <p>
          The factory changed. {STEPS[3].name} used to be quick, but now it is as slow as {STEPS[2].name}: <strong>two bottlenecks</strong>, each able to make {cap} robots an hour. The line's capacity is the same {cap} an hour.
        </p>
        {reference && round.predictAt !== undefined && (
          <p>
            At {round.predictAt} orders an hour ({Math.round(100 * loadShare(ROUND_ONE.minutes, noUpgrades(ROUND_ONE.minutes), round.predictAt))}% load), the first line's robots took <strong>{Math.round(reference.cycle)} minutes</strong>. Before you run this one, make a guess.
          </p>
        )}
        {goal}
      </section>
    )
  }
  return (
    <section className="card lab-brief" aria-label="Round brief">
      <p>
        Now every step takes {ROUND_MANY.minutes[0]} minutes: <strong>five bottlenecks</strong>. You have <strong>{round.upgrades} speed-ups</strong>. Tap a station on the floor (or below) to make it {Math.round((1 - UPGRADE) * 100)}% faster. Where will you leave the bottleneck?
      </p>
      {goal}
      {hint}
    </section>
  )
}

function Predict({ round, reference, guess, onGuess }: { round: Round; reference: Outcome | null; guess: Guess | null; onGuess: (guess: Guess) => void }) {
  return (
    <fieldset className="lever">
      <legend>
        <Icon name="eye" /> Your guess: at {round.predictAt} orders an hour, how does this line's cycle time compare{reference ? ` with ${Math.round(reference.cycle)} minutes` : ''}?
      </legend>
      <div className="chips">
        {GUESSES.map((g) => (
          <button key={g.id} className={`chip${guess?.id === g.id ? ' on' : ''}`} aria-pressed={guess?.id === g.id} onClick={() => onGuess(g)}>
            {g.text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Reveal({ first, reference, guess }: { first: Run; reference: Outcome; guess: Guess }) {
  const ratio = first.outcome.cycle / reference.cycle
  const right = rightGuess(ratio)
  const more = Math.round((ratio - 1) * 100)
  return (
    <section className="runs reveal" aria-live="polite">
      <h3>{right.id === guess.id ? 'You called it' : 'Not quite'}</h3>
      <p>
        The first line took {Math.round(reference.cycle)} minutes at this load. This one took <strong>{Math.round(first.outcome.cycle)}</strong>: {more >= 0 ? `${more}% longer` : `${-more}% shorter`}.
        {right.id === guess.id ? ' ' : ` You guessed "${guess.text.toLowerCase()}"; it was "${right.text.toLowerCase()}". `}
        The line can make exactly as many robots as before, but with two slow steps a robot can wait in front of either one, and a delay at one (a slow robot, a crowd of orders) shows up as a pile at the next. Two bottlenecks mean two places to queue.
      </p>
    </section>
  )
}

function Dial({ round, upgraded, rate, capacity, onChange }: { round: Round; upgraded: boolean[]; rate: number; capacity: number; onChange: (rate: number) => void }) {
  const load = Math.round((100 * rate) / capacity)
  return (
    <fieldset className="lever">
      <legend>
        <Icon name="even" /> Load: orders an hour
      </legend>
      <div className="dial" role="group" aria-label="Orders per hour">
        <button className="chip step" aria-label="Fewer orders" disabled={rate <= RATES.min} onClick={() => onChange(rate - RATES.step)}>
          <Icon name="minus" />
        </button>
        <input
          type="range"
          min={RATES.min}
          max={RATES.max}
          step={RATES.step}
          value={rate}
          aria-valuetext={`${rate} orders an hour, ${load}% load`}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button className="chip step" aria-label="More orders" disabled={rate >= RATES.max} onClick={() => onChange(rate + RATES.step)}>
          <Icon name="plus" />
        </button>
      </div>
      <p className={`dial-read${load > 100 ? ' over' : ''}`} aria-live="polite">
        <strong>{rate} orders an hour</strong> is <strong>{load}%</strong> of what {names(round.minutes, upgraded)} can make ({Math.round(capacity)} an hour).
      </p>
    </fieldset>
  )
}

function Upgrades({ round, upgraded, left, onToggle }: { round: Round; upgraded: boolean[]; left: number; onToggle: (i: number) => void }) {
  return (
    <fieldset className="lever">
      <legend>
        <Icon name="bolt" /> Speed-ups left: {left} of {round.upgrades}
      </legend>
      <div className="chips">
        {round.minutes.map((_, i) => (
          <button key={STEPS[i].id} className={`chip${upgraded[i] ? ' on' : ''}`} aria-pressed={upgraded[i]} disabled={!upgraded[i] && left === 0} onClick={() => onToggle(i)}>
            {STEPS[i].name}
          </button>
        ))}
      </div>
      <p className="hint">
        {bottlenecks(round.minutes, upgraded).length === 1
          ? `One bottleneck left: ${STEPS[bottlenecks(round.minutes, upgraded)[0]].name}.`
          : `${bottlenecks(round.minutes, upgraded).length} bottlenecks: ${names(round.minutes, upgraded)}.`}
      </p>
    </fieldset>
  )
}

function StationTable({ run, round }: { run: Run; round: Round }) {
  const necks = bottlenecks(round.minutes, run.upgraded)
  return (
    <table className="data-table station-table">
      <thead>
        <tr>
          <th scope="col">Station</th>
          <th scope="col">Busy</th>
          <th scope="col">Waiting in front</th>
        </tr>
      </thead>
      <tbody>
        {run.result.stations.map((station, i) => (
          <tr key={station.id} className={necks.includes(i) ? 'neck' : undefined}>
            <th scope="row">
              {STEPS[i].name}
              {necks.includes(i) && <small>bottleneck</small>}
            </th>
            <td>{Math.round(100 * station.utilization)}%</td>
            <td>{station.avgQueue.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RunsTable({ runs, round }: { runs: Run[]; round: Round }) {
  return (
    <table className="data-table runs-table">
      <thead>
        <tr>
          <th scope="col">Run</th>
          <th scope="col">Orders/hr</th>
          <th scope="col">Load</th>
          <th scope="col">Shipped</th>
          <th scope="col">Cycle</th>
          <th scope="col">Mission</th>
        </tr>
      </thead>
      <tbody>
        {[...runs].reverse().map((r) => {
          const v = judge(round, r.outcome)
          return (
            <tr key={r.number} className={v.passed ? 'current' : undefined}>
              <th scope="row">{r.number}</th>
              <td>{r.rate}</td>
              <td>{Math.round(100 * r.outcome.load)}%</td>
              <td>{r.outcome.shipped}</td>
              <td>{Math.round(r.outcome.cycle)} min</td>
              <td>{v.passed ? 'Done' : !v.cycleOk ? 'Too slow' : 'Too few'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const FIXED = [true, true, false, true, true]

// What the three rounds add up to: the same load on each line, and what to take back to the factory.
function LabSummary({ log, onAgain, onExit }: { log: RoundLog[]; onAgain: () => void; onExit: () => void }) {
  const lines = useMemo(() => {
    const curve = (minutes: number[], upgraded: boolean[]) => loadCurve(minutes, upgraded, CURVE_RATES, CURVE_DAYS)
    return {
      one: curve(ROUND_ONE.minutes, noUpgrades(ROUND_ONE.minutes)),
      two: curve(ROUND_TWO.minutes, noUpgrades(ROUND_ONE.minutes)),
      many: curve(ROUND_MANY.minutes, noUpgrades(ROUND_ONE.minutes)),
      fixed: curve(ROUND_MANY.minutes, FIXED),
    }
  }, [])
  const at = (points: Outcome[], rate: number) => points.find((p) => p.rate === rate) ?? points[0]
  const series: CurveSeries[] = [
    { name: '1 bottleneck', color: 'var(--green-deep)', points: lines.one },
    { name: '2 bottlenecks', color: '#b35c00', points: lines.two },
    { name: '5 bottlenecks', color: 'var(--red)', points: lines.many },
    { name: '5, with 4 sped up', color: 'var(--blue)', points: lines.fixed },
  ]
  const low = at(lines.one, 12)
  const mid = at(lines.one, 14)
  const high = at(lines.one, 19)
  const gain = Math.round((100 * (high.shipped - mid.shipped)) / mid.shipped)
  return (
    <div className="screen level-screen lab">
      <header className="level-header">
        <div className="header-buttons">
          <button className="btn small" onClick={onExit}>
            <Icon name="back" /> Levels
          </button>
        </div>
        <div className="level-title">
          <span className="tier-chip">Loading lab · done</span>
          <h1>What load does to cycle time</h1>
        </div>
      </header>

      <section className="card lab-summary">
        <CurveChart series={series} limit={ROUND_ONE.mission.cycle} label="Cycle time against load for a line with one bottleneck, two, five, and five with four sped up." />
        <ol className="takeaways">
          <li>
            <h3>Waiting is the whole story</h3>
            <p>
              A robot on the first line needs {Math.round(workTime(ROUND_ONE.minutes))} minutes of work. At 60% load it waited {Math.round(low.waiting)} of its {Math.round(low.cycle)} minutes. At 95% load it waited {Math.round(high.waiting)} of its {Math.round(high.cycle)}. The work didn't change; the piles did.
            </p>
          </li>
          <li>
            <h3>The last stretch of load is the costly one</h3>
            <p>
              Going from 70% to 95% load shipped {gain}% more robots but took cycle time from {Math.round(mid.cycle)} to {Math.round(high.cycle)} minutes. Past 100% nothing more ships at all, and cycle time just keeps growing: {Math.round(at(lines.one, 22).cycle)} minutes at 110%. A bottleneck that is never idle can never catch up after bad luck, so run it close to full, not full.
            </p>
          </li>
          <li>
            <h3>More bottlenecks, an earlier knee</h3>
            <p>
              At 95% load the same robots took {Math.round(high.cycle)} minutes with one bottleneck, {Math.round(at(lines.two, 19).cycle)} with two and {Math.round(at(lines.many, 19).cycle)} with five. Each near-equal station is another place to queue, and none has spare time to clear a pile. With one clear bottleneck, every other station has slack to absorb the variation before it reaches the constraint.
            </p>
          </li>
          <li>
            <h3>Fix the balance, not the speed</h3>
            <p>
              Speeding up four of the five stations did not raise the capacity ({Math.round(capacityPerHour(ROUND_MANY.minutes, FIXED))} an hour, as before). It cut cycle time at 95% load from {Math.round(at(lines.many, 19).cycle)} to {Math.round(at(lines.fixed, 19).cycle)} minutes by leaving exactly one bottleneck to protect. This is what a rope does in the main game: it holds the load where the bottleneck is nearly full and the piles stay short.
            </p>
          </li>
        </ol>
      </section>

      <section className="card" aria-label="Your rounds">
        <h2>Your rounds</h2>
        <ul className="plan-summary">
          {log.map((entry) => (
            <li key={entry.round.id}>
              <Icon name={entry.passed ? 'check' : 'cross'} />
              <span>
                {entry.round.title}: {entry.passed ? 'done' : 'skipped'} in {entry.tries} {entry.tries === 1 ? 'run' : 'runs'}
                {entry.guess ? `. You guessed "${entry.guess.chosen.text.toLowerCase()}"; it was "${entry.guess.right.text.toLowerCase()}"` : ''}
                {entry.round.upgrades > 0 && entry.passed
                  ? `. Bottleneck left at ${names(entry.round.minutes, entry.upgraded)}`
                  : ''}
                .
              </span>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn" onClick={onAgain}>
            <Icon name="restart" /> Play again
          </button>
          <button className="btn primary" onClick={onExit}>
            Back to the levels <Icon name="next" />
          </button>
        </div>
      </section>
    </div>
  )
}
