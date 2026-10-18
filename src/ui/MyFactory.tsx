import { useDeferredValue, useMemo, useState } from 'react'
import { EXAMPLE, LIMITS, NEW_STEP, periodDays, periodName, type Factory, type Step, type Variation } from '../factory/model.ts'
import { cases, csv, rows } from '../factory/cases.ts'
import { analyze, curve, measure, reach, whatIf } from '../factory/sim.ts'
import { verdict } from '../factory/words.ts'
import { FactoryCurve, NumberField } from './FactoryParts.tsx'
import { RopeCard } from './RopeCard.tsx'
import { recommend, ropeStudy } from '../factory/rope.ts'
import { FactoryWatch } from './FactoryWatch.tsx'
import { Icon } from './icons.tsx'
import { ScreenHeader, type Stat } from './parts.tsx'

interface MyFactoryProps {
  initial: Factory
  onSave: (factory: Factory) => void
  onExit: () => void
}

const VARIATIONS: [Variation, string][] = [
  ['low', 'Steady'],
  ['medium', 'Some variation'],
  ['high', 'A lot of variation'],
]

const hours = (h: number) => (h < 10 ? h.toFixed(1) : String(Math.round(h)))
const units = (n: number) => Math.round(n).toLocaleString('en-US')

// Hands a file made on this device to the person's browser to save.
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Everything worked out for the factory as described, for the screen to show.
function work(factory: Factory) {
  const a = analyze(factory)
  const m = measure(factory)
  const r = reach(factory, a.capacity)
  const tries = whatIf(factory, m)
  return { a, m, r, tries, list: cases(factory), rope: ropeStudy(factory), advice: recommend(factory), points: curve(factory, a.capacity), v: verdict(factory, a, m, r, tries) }
}

// "My factory": a line of workgroups the person describes with their own numbers, with the bottleneck, the
// cycle time, and what it would take to meet the cycle time wanted all following every change as it is made.
// Their numbers stay on this device: nothing here is sent anywhere.
export function MyFactory({ initial, onSave, onExit }: MyFactoryProps) {
  const [factory, setFactory] = useState(initial)
  // The heavy part trails a little behind typing, so the boxes stay quick.
  const shown = useDeferredValue(factory)
  const result = useMemo(() => work(shown), [shown])
  const { a, m, r, tries, list, rope, advice, points, v } = result
  const table = rows(shown, list)
  const [making, setMaking] = useState(false)
  const download = async () => {
    setMaking(true)
    try {
      const { deck } = await import('../factory/deck.ts')
      save(await deck(shown, list), 'my-factory-cases.pptx')
    } finally {
      setMaking(false)
    }
  }
  const days = periodDays(factory)
  const shownDays = periodDays(shown)
  const scaled = points.map((p) => ({ ...p, demand: p.demand * shownDays }))

  const change = (next: Factory) => {
    setFactory(next)
    onSave(next)
  }
  const editStep = (i: number, patch: Partial<Step>) => change({ ...factory, steps: factory.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) })
  const move = (i: number, by: -1 | 1) => {
    const steps = [...factory.steps]
    ;[steps[i], steps[i + by]] = [steps[i + by], steps[i]]
    change({ ...factory, steps })
  }
  const remove = (i: number) => change({ ...factory, steps: factory.steps.filter((_, k) => k !== i) })
  const add = () => change({ ...factory, steps: [...factory.steps, { ...NEW_STEP, name: `Step ${factory.steps.length + 1}` }] })

  const stats: Stat[] = [
    { label: 'Bottleneck', value: a.steps[a.bottleneck].name },
    { label: 'Load', value: `${Math.round(a.load * 100)}%` },
    { label: 'Cycle time', value: `${hours(m.cycle)} h` },
    { label: 'Wanted', value: `${hours(shown.target)} h` },
  ]

  return (
    <div className="screen level-screen my-factory">
      <ScreenHeader chip="My factory" title="Your factory" stats={stats} onExit={onExit} />
      <p className="privacy">
        <Icon name="lock" /> Your numbers stay on this device. Nothing you type here is sent anywhere.
      </p>

      <section className={`card verdict-card ${v.tone}`} aria-live="polite" aria-label="What it means">
        <h2>{v.headline}</h2>
        <ul className="plain-list">
          {v.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {shown !== factory && <small className="hint">Working it out…</small>}
      </section>

      <div className="dock">
        <section className="card" aria-label="What you ask of it">
          <h2 className="card-title">What you ask of it</h2>
          <div className="field-grid">
            <NumberField
              label={`Good units wanted a ${periodName(factory)}`}
              value={Math.round(factory.demand * days * 100) / 100}
              min={LIMITS.demand.min * days}
              max={LIMITS.demand.max * days}
              step={factory.perWeek ? 100 : LIMITS.demand.step}
              decimals={2}
              onChange={(wanted) => change({ ...factory, demand: Math.max(LIMITS.demand.min, wanted / days) })}
              hint={`The factory can make about ${units(a.capacity * days)} a ${periodName(factory)}.`}
            />
            {factory.perWeek && (
              <NumberField label="Days in your week" value={factory.weekDays} min={LIMITS.weekDays.min} max={LIMITS.weekDays.max} onChange={(weekDays) => change({ ...factory, weekDays })} hint="Days the factory runs, 24 hours each." />
            )}
            <NumberField label="Cycle time wanted (hours)" value={factory.target} min={LIMITS.target.min} max={LIMITS.target.max} step={1} decimals={1} onChange={(target) => change({ ...factory, target })} hint="From an order's arrival to its leaving the last step." />
            <NumberField label="Smallest batch (units)" value={factory.sizeMin} min={LIMITS.size.min} max={LIMITS.size.max} step={LIMITS.size.step} onChange={(sizeMin) => change({ ...factory, sizeMin, sizeMax: Math.max(sizeMin, factory.sizeMax) })} />
            <NumberField label="Largest batch (units)" value={factory.sizeMax} min={LIMITS.size.min} max={LIMITS.size.max} step={LIMITS.size.step} onChange={(sizeMax) => change({ ...factory, sizeMax, sizeMin: Math.min(sizeMax, factory.sizeMin) })} hint="A batch, order, or lot moves through every step together." />
            <NumberField label="Yield (% good)" value={factory.yieldPct} min={LIMITS.yieldPct.min} max={LIMITS.yieldPct.max} step={1} onChange={(yieldPct) => change({ ...factory, yieldPct })} hint="Lower yield means more units started for the same good ones." />
          </div>
          <fieldset className="lever">
            <legend>Count units per</legend>
            <div className="chips">
              {([false, true] as const).map((week) => (
                <button key={String(week)} className={`chip${factory.perWeek === week ? ' on' : ''}`} aria-pressed={factory.perWeek === week} onClick={() => change({ ...factory, perWeek: week })}>
                  {week ? 'Week' : 'Day'}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="lever">
            <legend>
              <Icon name="even" /> How much times and arrivals vary
            </legend>
            <div className="chips">
              {VARIATIONS.map(([id, text]) => (
                <button key={id} className={`chip${factory.variation === id ? ' on' : ''}`} aria-pressed={factory.variation === id} onClick={() => change({ ...factory, variation: id })}>
                  {text}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="card" aria-label="Cycle time against demand">
          <h2 className="card-title">Cycle time against demand</h2>
          <FactoryCurve points={scaled} capacity={a.capacity * shownDays} demand={shown.demand * shownDays} cycle={m.cycle} target={shown.target} reach={{ ...r, demand: r.demand === null ? null : r.demand * shownDays }} period={periodName(shown)} />
          <p className="hint">
            Each dot is the average of several runs, each with its own luck. The line climbs slowly, then steeply: the bend is the knee, and it comes before the factory is full.
          </p>
        </section>
      </div>

      <RopeCard factory={factory} study={rope} advice={advice} onChange={change} />

      <FactoryWatch factory={shown} analysis={a} />

      <section className="card cases" aria-label="Too low, midpoint, too high">
        <h2 className="card-title">Too low, midpoint, too high</h2>
        <p className="hint">
          Demand: the midpoint is just inside the most the factory can take and still meet your cycle time, too low is half of that, and too high is nearly all it can make. Batch size: your smallest, middle, and largest, at the demand you ask for.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {table[0].map((head) => (
                  <th key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.slice(1).map((row, k) => (
                <tr key={k} className={list[k].meets ? 'meets' : 'misses'}>
                  {row.map((cell, i) => (
                    <td key={i}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button className="btn small" onClick={() => save(new Blob([csv(shown, list)], { type: 'text/csv' }), 'my-factory-cases.csv')}>
            <Icon name="clipboard" /> Download as a spreadsheet (CSV)
          </button>
          <button className="btn small" disabled={making} onClick={() => void download()}>
            <Icon name="clipboard" /> {making ? 'Making the slides…' : 'Download as PowerPoint'}
          </button>
        </div>
        <p className="hint">These files are made on this device from your numbers.</p>
      </section>

      <section aria-label="Your workgroups">
        <h2 className="section-title">Your workgroups, in the order an order goes through them</h2>
        <ol className="step-cards">
          {factory.steps.map((step, i) => {
            // The results trail typing a little: a step just added has none until they catch up.
            const s = a.steps[i]
            const tool = tries[i]
            const level = s && s.utilization > 0.9 ? 'hot' : s && s.utilization > 0.7 ? 'warm' : 'cool'
            return (
              <li key={i} className={`card step-card${s?.bottleneck ? ' neck' : ''}`}>
                <header>
                  <span className="level-num">{i + 1}</span>
                  <input className="step-name" aria-label={`Name of step ${i + 1}`} maxLength={40} value={step.name} onChange={(event) => editStep(i, { name: event.target.value })} />
                  {s?.bottleneck && <span className="neck-tag">Bottleneck</span>}
                </header>
                <div className="field-grid">
                  <NumberField label="Tools" value={step.tools} min={LIMITS.tools.min} max={LIMITS.tools.max} onChange={(tools) => editStep(i, { tools })} />
                  <NumberField label="Units an hour per tool" value={step.rate} min={LIMITS.rate.min} max={LIMITS.rate.max} step={1} decimals={1} onChange={(rate) => editStep(i, { rate })} hint="At full loads." />
                  <NumberField label="Units a tool takes at once" value={step.load} min={LIMITS.load.min} max={LIMITS.load.max} onChange={(load) => editStep(i, { load })} hint="1 if it works on one at a time. A run takes the same time however full it is." />
                </div>
                <label className="check">
                  <input type="checkbox" checked={step.divided} onChange={(event) => editStep(i, { divided: event.target.checked })} /> This workgroup can be divided, one tool to a batch
                </label>
                {s && tool && (
                <div className="readout">
                  <p>
                    Can make <strong>{units(s.effective)}</strong> units an hour with your batches
                    {Math.round(s.paper) !== Math.round(s.effective) && <span> ({units(s.paper)} on paper)</span>}.
                  </p>
                  <div className={`busy-bar ${level}`} role="img" aria-label={`${Math.round(s.utilization * 100)}% busy`}>
                    <span style={{ width: `${Math.min(100, s.utilization * 100)}%` }} />
                  </div>
                  <p className="busy-text">
                    <strong>{Math.round(s.utilization * 100)}%</strong> busy{s.utilization > 1 ? ': more than it can make' : ''}. Orders wait about <strong>{hours(m.waits[i])}</strong> h here.
                  </p>
                  <p className="tool-hint">
                    {tool.saved > 0.05 * Math.max(1, m.cycle) ? `One more tool: ${hours(tool.saved)} h off an order.` : 'One more tool: little change.'}
                  </p>
                </div>
                )}
                <div className="step-actions">
                  <button className="btn small" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${step.name} earlier`}>
                    <Icon name="back" /> Earlier
                  </button>
                  <button className="btn small" disabled={i === factory.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${step.name} later`}>
                    Later <Icon name="next" />
                  </button>
                  <button className="btn small" disabled={factory.steps.length <= LIMITS.steps.min} onClick={() => remove(i)} aria-label={`Remove ${step.name}`}>
                    <Icon name="minus" /> Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="actions">
          <button className="btn" disabled={factory.steps.length >= LIMITS.steps.max} onClick={add}>
            <Icon name="plus" /> Add a step
          </button>
          <button className="btn" onClick={() => change(EXAMPLE)}>
            <Icon name="restart" /> Start again from the example
          </button>
        </div>
        <p className="hint">The example is made up. Replace its numbers with your own.</p>
      </section>
    </div>
  )
}
