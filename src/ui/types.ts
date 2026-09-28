import type { Goal, Level } from '../levels/types.ts'
import type { Preferences, ProgressEvent } from '../progress/store.ts'

export interface LevelFlowProps<K extends Goal['kind']> {
  level: Level
  goal: Extract<Goal, { kind: K }>
  nextLevel: Level | null
  onRecord: (event: ProgressEvent) => void
  onExit: () => void
  onNext: (level: Level) => void
  preferences: Preferences
  onPreferences: (preferences: Preferences) => void
}
