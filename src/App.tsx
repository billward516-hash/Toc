import { useEffect, useMemo, useState } from 'react'
import { levels, tierNames } from './levels/index.ts'
import type { Level } from './levels/types.ts'
import {
  bestStars,
  chooseLearner,
  completedLevels,
  devicePlayers,
  loadOrCreateLearner,
  localProgressStore,
  type ProgressEvent,
  type StoredEvent,
} from './progress/store.ts'
import { LevelList } from './ui/LevelList.tsx'
import { LevelScreen } from './ui/LevelScreen.tsx'
import { PlayerBar } from './ui/PlayerBar.tsx'

export default function App() {
  const [learner, setLearner] = useState(() => loadOrCreateLearner())
  const [players, setPlayers] = useState(() => devicePlayers())
  const [store] = useState(() => localProgressStore())
  const [loaded, setLoaded] = useState<StoredEvent[]>([])
  const [open, setOpen] = useState<Level | null>(null)
  // Right after a switch, events loaded for the previous player are still in state; never show them.
  const events = useMemo(() => loaded.filter((e) => e.learnerId === learner.id), [loaded, learner.id])

  useEffect(() => {
    void store.loadProgress(learner.id).then(setLoaded)
  }, [store, learner.id])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [open])

  const completed = useMemo(() => completedLevels(events), [events])
  const stars = useMemo(() => bestStars(events), [events])

  const record = (event: ProgressEvent) => {
    void store.saveProgress(learner.id, event).then((saved) => setLoaded((previous) => [...previous, saved]))
  }

  const choosePlayer = (nickname: string) => {
    setLearner(chooseLearner(learner, nickname))
    setPlayers(devicePlayers())
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

  return (
    <LevelList
      levels={levels}
      tierNames={tierNames}
      completed={completed}
      stars={stars}
      player={<PlayerBar learner={learner} players={players} onChoose={choosePlayer} />}
      onOpen={setOpen}
    />
  )
}
