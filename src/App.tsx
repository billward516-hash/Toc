import { useEffect, useMemo, useState } from 'react'
import { levels, tierNames } from './levels/index.ts'
import type { Level } from './levels/types.ts'
import {
  bestStars,
  completedLevels,
  loadOrCreateLearner,
  localProgressStore,
  type ProgressEvent,
  type StoredEvent,
} from './progress/store.ts'
import { LevelList } from './ui/LevelList.tsx'
import { LevelScreen } from './ui/LevelScreen.tsx'

export default function App() {
  const [learner] = useState(() => loadOrCreateLearner())
  const [store] = useState(() => localProgressStore())
  const [events, setEvents] = useState<StoredEvent[]>([])
  const [open, setOpen] = useState<Level | null>(null)

  useEffect(() => {
    void store.loadProgress(learner.id).then(setEvents)
  }, [store, learner.id])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [open])

  const completed = useMemo(() => completedLevels(events), [events])
  const stars = useMemo(() => bestStars(events), [events])

  const record = (event: ProgressEvent) => {
    void store.saveProgress(learner.id, event).then((saved) => setEvents((previous) => [...previous, saved]))
  }

  if (open) {
    const after = levels.slice(levels.indexOf(open) + 1)
    const nextLevel = after.find((l) => l.requires.every((id) => id === open.id || completed.has(id))) ?? null
    return (
      <LevelScreen
        key={open.id}
        level={open}
        nextLevel={nextLevel}
        onRecord={record}
        onExit={() => setOpen(null)}
        onNext={setOpen}
      />
    )
  }

  return <LevelList levels={levels} tierNames={tierNames} completed={completed} stars={stars} onOpen={setOpen} />
}
