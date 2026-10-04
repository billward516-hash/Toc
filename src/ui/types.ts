import type { Goal, Level } from '../levels/types.ts'
import type { Preferences, ProgressEvent, StoredEvent } from '../progress/store.ts'

// The pages opened from the buttons under the home screen's heading.
export type Guide = 'course' | 'trainer' | 'exam'

export interface LevelFlowProps<K extends Goal['kind']> {
  level: Level
  goal: Extract<Goal, { kind: K }>
  nextLevel: Level | null
  onRecord: (event: ProgressEvent) => void
  // What this player has done on this level so far, oldest first, including earlier visits.
  history: readonly StoredEvent[]
  onExit: () => void
  onNext: (level: Level) => void
  preferences: Preferences
  onPreferences: (preferences: Preferences) => void
}
