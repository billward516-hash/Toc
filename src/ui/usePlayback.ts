import { useCallback, useEffect, useRef, useState } from 'react'

// Simulated minutes per real second at 1x: an 8-hour shift plays in 80 seconds.
export const MINUTES_PER_SECOND = 6

export interface Playback {
  t: number
  playing: boolean
  finished: boolean
  play: () => void
  pause: () => void
  restart: () => void
  rewind: () => void
  skipToEnd: () => void
  // Jump to any minute of the shift, paused there.
  seekTo: (minutes: number) => void
}

// The whole run is precomputed, so playback only moves a time cursor forward in step with real time.
// Playing stops by itself at each of `stops` it reaches, such as the moment a buffer runs dry.
export function usePlayback(horizon: number, minutesPerSecond: number, stops: number[] = []): Playback {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const cursor = useRef(0)
  const stopsRef = useRef(stops)
  useEffect(() => {
    stopsRef.current = stops
  }, [stops])

  const seek = useCallback(
    (value: number) => {
      cursor.current = Math.min(horizon, Math.max(0, value))
      setT(cursor.current)
    },
    [horizon],
  )

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      // Cap each step so a tab returning from the background doesn't leap ahead.
      const elapsed = Math.min(0.1, (now - last) / 1000)
      last = now
      const from = cursor.current
      const to = from + elapsed * minutesPerSecond
      const stop = stopsRef.current.find((s) => s > from && s <= to)
      seek(stop ?? to)
      if (stop !== undefined || cursor.current >= horizon) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, horizon, minutesPerSecond, seek])

  return {
    t,
    playing,
    finished: t >= horizon,
    play: () => {
      if (cursor.current >= horizon) seek(0)
      setPlaying(true)
    },
    pause: () => setPlaying(false),
    restart: () => {
      seek(0)
      setPlaying(true)
    },
    rewind: () => {
      setPlaying(false)
      seek(0)
    },
    skipToEnd: () => {
      setPlaying(false)
      seek(horizon)
    },
    seekTo: (minutes: number) => {
      setPlaying(false)
      seek(minutes)
    },
  }
}
