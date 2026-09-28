import { useState } from 'react'
import type { FactoryModel } from '../engine/model.ts'
import type { SimResult } from '../engine/simulate.ts'
import { clock, describeEvent } from './shiftEvents.ts'

const SHOWN = 60

// Every event of the run so far in plain words, newest first, hidden until the player opens it (spec
// §4.5): for older learners who want to see exactly what happened when.
export function SimulationLog({ model, result, t, unit }: { model: FactoryModel; result: SimResult; t: number; unit: string }) {
  const [open, setOpen] = useState(false)
  // Events are in time order, so find the last one that has happened.
  let low = 0
  let high = result.events.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (result.events[mid].t <= t) low = mid + 1
    else high = mid
  }
  const recent = open ? result.events.slice(Math.max(0, low - SHOWN), low).reverse() : []
  return (
    <details className="sim-log" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Show simulation log</summary>
      {open &&
        (recent.length === 0 ? (
          <p className="hint">Nothing has happened yet.</p>
        ) : (
          <>
            <p className="hint">
              {low} events so far{low > SHOWN ? `; the latest ${SHOWN}` : ''}, newest first.
            </p>
            <ol>
              {recent.map((event, k) => (
                <li key={low - k}>
                  <span className="when">{clock(event.t)}</span> {describeEvent(model, result, event, unit)}
                </li>
              ))}
            </ol>
          </>
        ))}
    </details>
  )
}
