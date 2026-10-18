import { LIMITS, type Factory } from '../factory/model.ts'
import { ropeOf } from '../factory/sim.ts'
import { ropeWords, type RopeStudy, type Side } from '../factory/rope.ts'
import { NumberField } from './FactoryParts.tsx'

interface RopeProps {
  factory: Factory
  study: RopeStudy | null
  onChange: (factory: Factory) => void
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const one = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)))

const ROWS: [string, (s: Side) => string][] = [
  ['Bottleneck busy', (s) => pct(s.bottleneckBusy)],
  ['Orders waiting in front of the bottleneck', (s) => one(s.inFront)],
  ['Orders held back by the rope', (s) => one(s.heldBack)],
  ['Feeding workgroup idle', (s) => pct(s.feederIdle)],
  ['Hours in the line', (s) => one(s.lineCycle)],
  ['Hours from arrival to leaving', (s) => one(s.cycle)],
]

// Drum, buffer, rope: the workgroup that feeds the bottleneck idles when the buffer in front of the bottleneck
// is full, so a yield problem does not turn into piles of work nobody can use.
export function RopeCard({ factory, study, onChange }: RopeProps) {
  const tie = ropeOf({ ...factory, rope: { ...factory.rope, on: true } })
  const rope = factory.rope
  const set = (patch: Partial<typeof rope>) => onChange({ ...factory, rope: { ...rope, ...patch } })
  return (
    <section className="card rope" aria-label="Buffer and rope">
      <h2 className="card-title">Buffer and rope</h2>
      {!tie || !study ? (
        <p className="hint">The bottleneck is the first workgroup, so nothing feeds it and there is nothing for a rope to idle.</p>
      ) : (
        <>
          <p className="hint">
            The bottleneck sets the pace of the whole factory. The buffer is the orders kept waiting in front of it so it never runs dry, and the rope idles the workgroup that feeds it once the buffer is full. If the bottleneck's yield falls, the feeder idles instead of making more than can be used.
          </p>
          <label className="check">
            <input type="checkbox" checked={rope.on} onChange={(event) => set({ on: event.target.checked })} /> Use the rope (it also applies to the run you watch)
          </label>
          <div className="field-grid">
            <label className="number-field">
              <span className="setting-label">Workgroup that idles</span>
              <select value={tie.at} onChange={(event) => set({ at: Number(event.target.value) })} aria-label="Workgroup that idles">
                {factory.steps.slice(0, tie.bottleneck).map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
              <small>It must come before {factory.steps[tie.bottleneck].name}, the bottleneck.</small>
            </label>
            <NumberField label="Buffer (orders in front of the bottleneck)" value={rope.buffer} min={LIMITS.buffer.min} max={LIMITS.buffer.max} onChange={(buffer) => set({ buffer })} hint="Too few starves the bottleneck. Too many lets work pile up." />
            <NumberField label="Yield problem to test (points lower)" value={rope.issue} min={LIMITS.issue.min} max={LIMITS.issue.max} onChange={(issue) => set({ issue })} hint={`Tests ${study.troubledYield}% instead of ${factory.yieldPct}%.`} />
          </div>
          <ul className="plain-list">
            {ropeWords(factory, study).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2} />
                  <th colSpan={2}>At your yield ({factory.yieldPct}%)</th>
                  <th colSpan={2}>With a yield problem ({study.troubledYield}%)</th>
                </tr>
                <tr>
                  <th>As it runs now</th>
                  <th>With the rope</th>
                  <th>As it runs now</th>
                  <th>With the rope</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, show]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{show(study.normal.plain)}</td>
                    <td>{show(study.normal.roped)}</td>
                    <td>{show(study.troubled.plain)}</td>
                    <td>{show(study.troubled.roped)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
