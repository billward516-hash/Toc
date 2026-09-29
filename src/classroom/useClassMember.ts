import { useEffect, useRef, useState } from 'react'
import type { Learner, StoredEvent } from '../progress/store.ts'
import type { Unsubscribe } from './backend.ts'
import { eventsSince, progressSummary } from './events.ts'
import { classBackend, withTimeout } from './load.ts'
import { loadMembership, saveMembership, type Membership } from './membership.ts'
import type { ClassMeta } from './room.ts'

// Why a player is no longer in their class, to tell them.
export interface ClassNotice {
  kind: 'ended' | 'removed'
  code: string
}

export interface ClassMember {
  // The class this player is in, if any, and what every student may know about it.
  code: string | null
  meta: ClassMeta | null
  notice: ClassNotice | null
  join: (code: string, player: Learner, events: readonly StoredEvent[]) => Promise<void>
  leave: () => Promise<void>
  dismissNotice: () => void
}

// This player's side of a class. While they're in one, each result goes to the class as it's saved,
// with the levels they've finished and the level on their screen, and they hear where the instructor
// sends the class. A dropped connection sends everything again when it comes back.
export function useClassMember(learnerId: string, events: readonly StoredEvent[], openLevel: string | null): ClassMember {
  const [member, setMember] = useState<{ learnerId: string; membership: Membership | null }>(() => ({ learnerId, membership: loadMembership(learnerId) }))
  // Each player on a shared device has their own class, or none.
  if (member.learnerId !== learnerId) setMember({ learnerId, membership: loadMembership(learnerId) })
  const [heard, setHeard] = useState<{ code: string; meta: ClassMeta } | null>(null)
  const [notice, setNotice] = useState<ClassNotice | null>(null)
  // Bumped each time the connection comes back, to send everything again.
  const [connection, setConnection] = useState(0)
  const sentResults = useRef(new Set<string>())
  const sentProgress = useRef('')
  // A class the player is leaving themselves, so its entry disappearing isn't news to them.
  const leaving = useRef<string | null>(null)

  const code = member.membership?.code ?? null
  const since = member.membership?.since ?? 0

  useEffect(() => {
    if (!code) return
    let stops: Unsubscribe[] = []
    let cancelled = false
    const gone = (kind: ClassNotice['kind']) => {
      if (leaving.current === code) return
      saveMembership(learnerId, null)
      setMember({ learnerId, membership: null })
      // If the class ended, both arrive; that it ended is the better news.
      setNotice((current) => (current?.code === code && current.kind === 'ended' ? current : { kind, code }))
    }
    classBackend().then(
      (backend) => {
        if (cancelled) return
        stops = [
          backend.watchMeta(code, (meta) => (meta ? setHeard({ code, meta }) : gone('ended')), () => undefined),
          backend.watchMembership(code, (inClass) => inClass || gone('removed'), () => undefined),
          backend.stayOnline(code, () => {
            sentResults.current = new Set()
            sentProgress.current = ''
            setConnection((n) => n + 1)
          }),
        ]
      },
      () => undefined,
    )
    return () => {
      cancelled = true
      stops.forEach((stop) => stop())
    }
  }, [code, learnerId])

  // Results and finished levels, whatever hasn't gone yet.
  useEffect(() => {
    if (!code) return
    const unsent = Object.fromEntries(Object.entries(eventsSince(events, since)).filter(([key]) => !sentResults.current.has(key)))
    const progress = progressSummary(events)
    const progressText = JSON.stringify(progress)
    const progressChanged = progressText !== sentProgress.current
    if (Object.keys(unsent).length === 0 && !progressChanged) return
    Object.keys(unsent).forEach((key) => sentResults.current.add(key))
    sentProgress.current = progressText
    classBackend()
      .then(async (backend) => {
        await backend.sendResults(code, unsent)
        if (progressChanged) await backend.sendProgress(code, progress)
      })
      .catch(() => {
        // Tried again with the next result, or when the connection comes back.
        Object.keys(unsent).forEach((key) => sentResults.current.delete(key))
        sentProgress.current = ''
      })
  }, [code, since, events, connection])

  useEffect(() => {
    if (!code) return
    classBackend()
      .then((backend) => backend.sendNow(code, openLevel))
      .catch(() => undefined)
  }, [code, openLevel, connection])

  return {
    code,
    meta: heard && heard.code === code ? heard.meta : null,
    notice,
    async join(joinCode, player, playerEvents) {
      const backend = await withTimeout(classBackend())
      const meta = await withTimeout(backend.join(joinCode, { name: player.nickname ?? 'Player', progress: progressSummary(playerEvents) }))
      // Results from the start of the class count, even from before the player joined it.
      const membership = { code: joinCode, since: Math.min(meta.since, Date.now()) }
      saveMembership(player.id, membership)
      sentResults.current = new Set()
      sentProgress.current = ''
      leaving.current = null
      setNotice(null)
      setHeard({ code: joinCode, meta })
      setMember({ learnerId: player.id, membership })
    },
    async leave() {
      const current = member.membership
      if (!current) return
      leaving.current = current.code
      saveMembership(member.learnerId, null)
      setMember({ learnerId: member.learnerId, membership: null })
      const backend = await classBackend()
      await backend.leave(current.code).catch(() => undefined)
    },
    dismissNotice: () => setNotice(null),
  }
}
