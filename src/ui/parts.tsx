import { useRef, type ReactNode } from 'react'
import type { ZoneSpan } from '../engine/timeline.ts'
import type { Level } from '../levels/types.ts'
import { Icon } from './icons.tsx'
import type { Stop } from './shiftEvents.ts'
import type { Playback } from './usePlayback.ts'

const SPEEDS = [1, 4]

export interface Stat {
  label: string
  value: number | string
  detail?: string
}

export function LevelHeader({ level, stats, onExit, onBriefing }: { level: Level; stats: Stat[]; onExit: () => void; onBriefing: () => void }) {
  return <ScreenHeader chip={`Tier ${level.tier}`} title={level.title} stats={stats} onExit={onExit} onBriefing={onBriefing} />
}

// A play screen's title, with a way back to the levels, the level's briefing to reread, and the
// numbers that matter as the shift plays.
export function ScreenHeader(props: { chip: string; title: string; stats: Stat[]; onExit: () => void; onBriefing?: () => void }) {
  const { chip, title, stats, onExit, onBriefing } = props
  return (
    <header className="level-header">
      <div className="header-buttons">
        <button className="btn small" onClick={onExit}>
          <Icon name="back" /> Levels
        </button>
        {onBriefing && (
          <button className="btn small" onClick={onBriefing}>
            <Icon name="info" /> Briefing
          </button>
        )}
      </div>
      <div className="level-title">
        <span className="tier-chip">{chip}</span>
        <h1>{title}</h1>
      </div>
      <dl className="dashboard">
        {stats.map((stat) => (
          <div key={stat.label} className="stat">
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  )
}

interface PlaybackPanelProps {
  playback: Playback
  speed: number
  onSpeed: (speed: number) => void
  horizon: number
  windows?: { from: number; to: number }[]
  // Legend entries for waiting parts, in place of the plain "Part waiting".
  parts?: ReactNode
  legend?: ReactNode
  // The buffer's history colors the shift clock as it plays: red running dry, green healthy, amber flooding.
  zones?: ZoneSpan[]
  // Where the line can have problems: whether playback stops at each one, and where they are.
  pause?: { on: boolean; onToggle: () => void; stops: Stop[] }
  children?: ReactNode
}

export function PlaybackPanel(props: PlaybackPanelProps) {
  const { playback, speed, onSpeed, horizon, windows = [], parts, legend, zones, pause, children } = props
  const at = (minutes: number) => `${(100 * minutes) / horizon}%`
  const stoppedAt = pause?.on && !playback.playing ? pause.stops.find((stop) => stop.at === playback.t) : undefined
  return (
    <div className="panel">
      <div className="legend" aria-hidden="true">
        {parts ?? (
          <span>
            <i className="swatch" /> Part waiting
          </span>
        )}
        <span>
          <i className="swatch dot" /> Working
        </span>
        <span>
          <i className="swatch dot off" /> Waiting for parts
        </span>
        {legend}
      </div>
      <div className="controls">
        <button className="btn primary" onClick={playback.playing ? playback.pause : playback.play}>
          <Icon name={playback.playing ? 'pause' : 'play'} />
          {playback.playing ? 'Pause' : playback.finished ? 'Replay' : 'Play'}
        </button>
        <div className="speed" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} className={`btn small${speed === s ? ' active' : ''}`} aria-pressed={speed === s} onClick={() => onSpeed(s)}>
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
        {pause && (
          <button className={`btn small${pause.on ? ' active' : ''}`} aria-pressed={pause.on} onClick={pause.onToggle}>
            <Icon name="alert" /> Pause at problems
          </button>
        )}
      </div>
      <div className="clock">
        <span>
          Shift clock {clock(playback.t)} of {clock(horizon)}
          {windows.map((w) => ` · Break ${clock(w.from)} to ${clock(w.to)}`).join('')}
        </span>
        <Scrubber t={playback.t} horizon={horizon} onSeek={playback.seekTo}>
          <div className="clock-track">
            {zones ? (
              zones
                .filter((z) => z.from < playback.t)
                .map((z) => (
                  <div key={z.from} className={`clock-zone ${z.zone}`} style={{ left: at(z.from), width: at(Math.min(z.to, playback.t) - z.from) }} />
                ))
            ) : (
              <div className="clock-fill" style={{ width: at(playback.t) }} />
            )}
            {windows.map((w) => (
              <div key={w.from} className="clock-window" style={{ left: at(w.from), width: at(w.to - w.from) }} />
            ))}
          </div>
        </Scrubber>
        {stoppedAt && (
          <p className="paused-at" role="status">
            <Icon name="alert" /> Paused at {clock(stoppedAt.at)}: {stoppedAt.why}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

// The shift clock as a timeline: drag along it, tap it, or use the arrow keys to jump to any minute.
function Scrubber({ t, horizon, onSeek, children }: { t: number; horizon: number; onSeek: (minutes: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const clamp = (minutes: number) => Math.min(horizon, Math.max(0, minutes))
  const seekAt = (x: number) => {
    const box = ref.current?.getBoundingClientRect()
    if (box && box.width > 0) onSeek(clamp(((x - box.left) / box.width) * horizon))
  }
  const keys: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -60, PageUp: 60 }
  return (
    <div
      ref={ref}
      className="scrub"
      role="slider"
      tabIndex={0}
      aria-label="Shift clock"
      aria-valuemin={0}
      aria-valuemax={horizon}
      aria-valuenow={Math.round(t)}
      aria-valuetext={clock(t)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        seekAt(event.clientX)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event.clientX)
      }}
      onKeyDown={(event) => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? horizon : event.key in keys ? t + keys[event.key] : null
        if (next === null) return
        event.preventDefault()
        onSeek(clamp(next))
      }}
    >
      {children}
      <i className="clock-thumb" style={{ left: `${(100 * t) / horizon}%` }} />
    </div>
  )
}

export interface JamEntry {
  station: string
  from: number
  to: number
  // False while the jam is still going.
  over: boolean
  // Whether the buffer ran into the red while the jam lasted (so far).
  dry: boolean
}

// The shift log: every jam so far, and whether it drained the buffer.
export function JamLog({ entries, drum }: { entries: JamEntry[]; drum: string }) {
  return (
    <section className="jam-log" aria-live="polite">
      <h2>
        Jams so far <small>and what each did to {drum}'s buffer</small>
      </h2>
      {entries.length === 0 ? (
        <p className="hint">None yet.</p>
      ) : (
        <ol>
          {entries.map((jam) => (
            <li key={`${jam.station}-${jam.from}`} className={jam.dry ? 'dry' : jam.over ? 'held' : 'going'}>
              <span className="when">{clock(jam.from)}</span>
              <strong>{jam.station}</strong>
              {jam.over && <small>{Math.round(jam.to - jam.from)} min</small>}
              <span className="what">{jam.dry ? 'buffer ran dry' : jam.over ? 'buffer held' : 'jammed now'}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// One measure across many days as dots along a line, with the goal dashed: the spec's aggregate view
// for 7 or more days (§5.4). Green dots cleared the goal, red ones missed it.
export function DayDots({ label, values, goal, atLeast, format }: { label: string; values: number[]; goal: number; atLeast: boolean; format: (value: number) => string }) {
  // The line reaches at least a tenth either side of the goal, so small differences look small.
  const low = Math.min(goal - Math.abs(goal) * 0.1, ...values)
  const high = Math.max(goal + Math.abs(goal) * 0.1, ...values)
  const pad = Math.max(1e-9, (high - low) * 0.06)
  const x = (value: number) => 8 + ((value - (low - pad)) / (high - low + 2 * pad)) * 284
  const met = (value: number) => (atLeast ? value >= goal : value <= goal)
  // Days with the same value stack up, three high, then spread sideways.
  const seen = new Map<number, number>()
  const dots = values.map((value, day) => {
    const key = Math.round(x(value))
    const stack = seen.get(key) ?? 0
    seen.set(key, stack + 1)
    return { value, day, cx: x(value) + Math.floor(stack / 3) * 7, cy: 20 - (stack % 3) * 7, ok: met(value) }
  })
  const goalText = goal === 0 && !atLeast ? 'none' : `${format(goal)} or ${atLeast ? 'more' : 'less'}`
  const summary = `${label}: goal ${goalText}, met on ${dots.filter((dot) => dot.ok).length} of ${values.length} days; from ${format(Math.min(...values))} to ${format(Math.max(...values))}`
  return (
    <figure className="day-dots">
      <figcaption>
        {label} <span>(goal: {goalText})</span>
      </figcaption>
      <svg viewBox="0 0 300 30" role="img" aria-label={summary}>
        <line className="axis" x1={8} x2={292} y1={26} y2={26} />
        <line className="goal" x1={x(goal)} x2={x(goal)} y1={2} y2={30} />
        {dots.map((dot) => (
          <circle key={dot.day} className={dot.ok ? 'ok' : 'miss'} cx={dot.cx} cy={dot.cy} r={3.5}>
            <title>{`Day ${dot.day + 1}: ${format(dot.value)}`}</title>
          </circle>
        ))}
      </svg>
    </figure>
  )
}

// A result's explanation: in full, or with brief explanations on, folded behind "Why?" (spec §6).
export function Explanation({ brief, children }: { brief: boolean; children: ReactNode }) {
  if (!brief) return <p>{children}</p>
  return (
    <details className="why">
      <summary>Why?</summary>
      <p>{children}</p>
    </details>
  )
}

export function Stars({ earned, max }: { earned: number; max: number }) {
  return (
    <span className="stars" role="img" aria-label={`${earned} of ${max} ${max === 1 ? 'star' : 'stars'}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`star${i < earned ? ' on' : ''}`}>
          <Icon name="star" />
        </span>
      ))}
    </span>
  )
}

function clock(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`
}
