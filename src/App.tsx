import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { codeInLink } from './classroom/code.ts'
import { classBackend, withTimeout } from './classroom/load.ts'
import { loadHosting, saveHosting } from './classroom/membership.ts'
import { classModeReady } from './classroom/settings.ts'
import { useClassMember } from './classroom/useClassMember.ts'
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
import { ClassCards, ClassPrompts, JoinClassDialog } from './ui/ClassMember.tsx'
import { FreePlay } from './ui/FreePlay.tsx'
import { LevelList } from './ui/LevelList.tsx'
import { LevelScreen } from './ui/LevelScreen.tsx'
import { PlayerBar } from './ui/PlayerBar.tsx'

// The instructor's screen loads only on a device that hosts a class.
const HostClass = lazy(() => import('./ui/HostClass.tsx').then((module) => ({ default: module.HostClass })))

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

  // Class mode: this player's class, a class code from a QR code waiting to be joined (or '' while
  // one is typed in), and the class this device hosts, with whether its screen is showing.
  const member = useClassMember(learner.id, events, open?.id ?? null)
  const [joining, setJoining] = useState<string | null>(() => (classModeReady ? codeInLink(window.location.search) : null))
  const [hosting, setHosting] = useState<string | null>(() => (classModeReady ? loadHosting() : null))
  const [hostView, setHostView] = useState(hosting !== null)
  // Scanning the code of the class the player is already in has nothing left to do.
  if (joining && joining === member.code) setJoining(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [open, free, hostView])

  // The class code has done its job once read; a reload shouldn't ask to join again.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('class')) return
    url.searchParams.delete('class')
    window.history.replaceState(null, '', url)
  }, [])

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
    const next = chooseLearner(learner, nickname)
    // A class is joined by one player; someone else picking up the device leaves it.
    if (member.code && next.id !== learner.id) void member.leave()
    setLearner(next)
    setPlayers(devicePlayers())
  }

  const joinClass = async (code: string, nickname: string) => {
    let player = learner
    if (learner.nickname === null) {
      player = chooseLearner(learner, nickname)
      setLearner(player)
      setPlayers(devicePlayers())
    }
    if (member.code && member.code !== code) await member.leave()
    await member.join(code, player, player.id === learner.id ? events : await store.loadProgress(player.id))
    setJoining(null)
  }

  const hostClass = async () => {
    const backend = await withTimeout(classBackend())
    const code = await withTimeout(backend.createClass())
    saveHosting(code)
    setHosting(code)
    setHostView(true)
  }

  const stopHosting = () => {
    saveHosting(null)
    setHosting(null)
    setHostView(false)
  }

  let screen: ReactNode
  if (hosting && hostView) {
    screen = (
      <Suspense
        fallback={
          <div className="screen host">
            <p className="hint">Opening the class screen…</p>
          </div>
        }
      >
        <HostClass code={hosting} levels={levels} tierNames={tierNames} onBack={() => setHostView(false)} onClosed={stopHosting} />
      </Suspense>
    )
  } else if (free) {
    screen = (
      <FreePlay
        key={learner.id}
        initial={cleanSetup(loadSandbox(learner.id)) ?? DEFAULT_SETUP}
        onSave={(setup) => saveSandbox(learner.id, setup)}
        onExit={() => setFree(false)}
      />
    )
  } else if (open) {
    const after = levels.slice(levels.indexOf(open) + 1)
    const nextLevel = after.find((l) => l.requires.every((id) => id === open.id || completed.has(id))) ?? null
    screen = (
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
  } else {
    screen = (
      <LevelList
        levels={levels}
        tierNames={tierNames}
        completed={completed}
        stars={stars}
        player={<PlayerBar learner={learner} players={players} onChoose={choosePlayer} />}
        classCards={
          classModeReady && (
            <ClassCards
              inClass={member.code}
              hosting={hosting}
              onJoin={() => setJoining('')}
              onLeave={() => void member.leave()}
              onHost={hostClass}
              onReturn={() => setHostView(true)}
            />
          )
        }
        classLevel={member.meta?.focus ?? null}
        preferences={preferences}
        onPreferences={setPreferences}
        onOpen={setOpen}
        onFreePlay={() => setFree(true)}
      />
    )
  }

  const hostShowing = hosting !== null && hostView
  return (
    <>
      {screen}
      {classModeReady && !hostShowing && (
        <ClassPrompts
          member={member}
          levels={levels}
          openLevel={open?.id ?? null}
          onGo={(level) => {
            setFree(false)
            setOpen(level)
          }}
        />
      )}
      {joining !== null && !hostShowing && (
        <JoinClassDialog initialCode={joining} nickname={learner.nickname} onJoin={joinClass} onCancel={() => setJoining(null)} />
      )}
    </>
  )
}
