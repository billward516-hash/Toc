import type { ReactNode } from 'react'
import type { ZoneSpan } from '../engine/timeline.ts'
import type { Level } from '../levels/types.ts'
import { Icon } from './icons.tsx'
import type { Playback } from './usePlayback.ts'

const SPEEDS = [1, 4]

export interface Stat {
  label: string
  value: number | string
  detail?: string
}

export function LevelHeader({ level, stats, onExit }: { level: Level; stats: Stat[]; onExit: () => void }) {
  return (
    <header className="level-header">
      <button className="btn small" onClick={onExit}>
        <Icon name="back" /> Levels
      </button>
      <div className="level-title">
        <span className="tier-chip">Tier {level.tier}</span>
        <h1>{level.title}</h1>
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
  legend?: ReactNode
  // The buffer's history colors the shift clock as it plays: red running dry, green healthy, amber flooding.
  zones?: ZoneSpan[]
  children?: ReactNode
}

export function PlaybackPanel(props: PlaybackPanelProps) {
  const { playback, speed, onSpeed, horizon, windows = [], legend, zones, children } = props
  const at = (minutes: number) => `${(100 * minutes) / horizon}%`
  return (
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
      </div>
      <div className="clock">
        <span>
          Shift clock {clock(playback.t)} of {clock(horizon)}
          {windows.map((w) => ` · Break ${clock(w.from)} to ${clock(w.to)}`).join('')}
        </span>
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
      </div>
      {children}
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
