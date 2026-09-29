import { useEffect, useState } from 'react'
import type { Unsubscribe } from './backend.ts'
import { classBackend } from './load.ts'
import type { ClassRoom } from './room.ts'

export type Hosted = { status: 'loading' } | { status: 'open'; room: ClassRoom } | { status: 'ended' } | { status: 'failed' }

// The class this device hosts, as it stands. It ends when the class is ended (here, or once it's
// old enough to be cleared away), and fails if this device can't open it: another device hosts it,
// or the class service can't be reached. Bumping `attempt` tries again after a failure.
export function useHostedClass(code: string, attempt = 0): Hosted {
  const key = `${code}:${attempt}`
  const [state, setState] = useState<{ key: string; hosted: Hosted }>({ key, hosted: { status: 'loading' } })
  useEffect(() => {
    let stop: Unsubscribe = () => undefined
    let cancelled = false
    const show = (hosted: Hosted) => setState({ key, hosted })
    classBackend().then(
      (backend) => {
        if (cancelled) return
        stop = backend.watchClass(
          code,
          (room) => show(room ? { status: 'open', room } : { status: 'ended' }),
          () => show({ status: 'failed' }),
        )
      },
      () => show({ status: 'failed' }),
    )
    return () => {
      cancelled = true
      stop()
    }
  }, [code, key])
  return state.key === key ? state.hosted : { status: 'loading' }
}
