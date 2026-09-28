import { useState } from 'react'
import type { Playback } from './usePlayback.ts'

// The level's briefing, reopened from the header at any time. The shift pauses while it's open, and
// plays on when it closes if it was playing.
export function useReread(playback: Playback) {
  const [open, setOpen] = useState(false)
  const [resume, setResume] = useState(false)
  return {
    open,
    show: () => {
      setResume(playback.playing)
      playback.pause()
      setOpen(true)
    },
    close: () => {
      setOpen(false)
      if (resume) playback.play()
    },
  }
}
