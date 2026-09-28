import type { Level } from '../levels/types.ts'
import type { ProgressEvent } from '../progress/store.ts'
import { FindTheConstraint } from './FindTheConstraint.tsx'
import { PlanTheShift } from './PlanTheShift.tsx'

interface LevelScreenProps {
  level: Level
  nextLevel: Level | null
  onRecord: (event: ProgressEvent) => void
  onExit: () => void
  onNext: (level: Level) => void
}

export function LevelScreen({ level, ...flow }: LevelScreenProps) {
  const { goal } = level
  switch (goal.kind) {
    case 'identifyBottleneck':
      return <FindTheConstraint level={level} goal={goal} {...flow} />
    case 'output':
      return <PlanTheShift level={level} goal={goal} {...flow} />
  }
}
