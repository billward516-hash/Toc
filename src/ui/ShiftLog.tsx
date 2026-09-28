import { Icon } from './icons.tsx'
import { clock, type LogEntry } from './shiftEvents.ts'

export function ShiftLog({ entries }: { entries: LogEntry[] }) {
  return (
    <section className="shift-log" aria-live="polite">
      <h2>Shift log</h2>
      {entries.length === 0 ? (
        <p className="hint">Nothing unusual yet.</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={`${entry.at}-${entry.text}`} className={entry.tone}>
              <span className="when">{clock(entry.at)}</span>
              <Icon name={entry.icon} />
              <strong>{entry.text}</strong>
              {entry.detail && <span className="what">{entry.detail}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
