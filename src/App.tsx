import { useEffect, useMemo, useState } from 'react'
import { levels, tierNames } from './levels/index.ts'
import type { Level } from './levels/types.ts'
import { cleanSetup, DEFAULT_SETUP } from './sandbox/setup.ts'
import {
  bestStars,
  chooseLearner,
  completedLevels,
  devicePlayers,
  loadOrCreateLearner,
  loadPreferences,
  loadSandbox,
  localProgressStore,
  savePreferences,
  saveSandbox,
  type Preferences,
  type ProgressEvent,
  type StoredEvent,
} from './progress/store.ts'
import { FreePlay } from './ui/FreePlay.tsx'
import { LevelList } from './ui/LevelList.tsx'
import { LevelScreen } from './ui/LevelScreen.tsx'
import { PlayerBar } from './ui/PlayerBar.tsx'

export default function App() {
  const [learner, setLearner] = useState(() => loadOrCreateLearner())
  const [players, setPlayers] = useState(() => devicePlayers())
  const [store] = useState(() => localProgressStore())
  const [loaded, setLoaded] = useState<StoredEvent[]>([])
  const [open, setOpen] = useState<Level | null>(null)
  const [free, setFree] = useState(false)
  // Settings changed this session, by player, over what's stored on the device.
  const [changed, setChanged] = useState<ReadonlyMap<string, Preferences>>(new Map())
  const preferences = useMemo(() => changed.get(learner.id) ?? loadPreferences(learner.id), [changed, learner.id])
  // Right after a switch, events loaded for the previous player are still in state; never show them.
  const events = useMemo(() => loaded.filter((e) => e.learnerId === learner.id), [loaded, learner.id])

  useEffect(() => {
    void store.loadProgress(learner.id).then(setLoaded)
  }, [store, learner.id])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [open, free])

  const history = useMemo(() => (open ? events.filter((e) => e.levelId === open.id) : []), [events, open])
  const completed = useMemo(() => completedLevels(events), [events])
  const stars = useMemo(() => bestStars(events), [events])

  const record = (event: ProgressEvent) => {
    void store.saveProgress(learner.id, event).then((saved) => setLoaded((previous) => [...previous, saved]))
  }

  const setPreferences = (next: Preferences) => {
    savePreferences(learner.id, next)
    setChanged(new Map(changed).set(learner.id, next))
  }

  const choosePlayer = (nickname: string) => {
    setLearner(chooseLearner(learner, nickname))
    setPlayers(devicePlayers())
  }

  if (free) {
    return (
      <FreePlay
        key={learner.id}
        initial={cleanSetup(loadSandbox(learner.id)) ?? DEFAULT_SETUP}
        onSave={(setup) => saveSandbox(learner.id, setup)}
        onExit={() => setFree(false)}
      />
    )
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
        history={history}
        onExit={() => setOpen(null)}
        onNext={setOpen}
        preferences={preferences}
        onPreferences={setPreferences}
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
      preferences={preferences}
      onPreferences={setPreferences}
      onOpen={setOpen}
      onFreePlay={() => setFree(true)}
    />
  )
}
