import { useMemo, useState } from 'react'
import { periodDays, periodName, type Factory } from '../factory/model.ts'
import { need, tryRate, type Gain } from '../factory/improve.ts'
import type { Analysis } from '../factory/sim.ts'
import { NumberField } from './FactoryParts.tsx'

interface WhatIfProps {
  factory: Factory
  analysis: Analysis
  // Gives a workgroup the speed tried.
  onApply: (step: number, rate: number) => void
}

// Units an hour, to a tenth, so what is shown is what is tried and used.
const one = (n: number) => String(Math.round(n * 10) / 10)
const up = (n: number) => Math.ceil(n * 10 - 1e-9) / 10
const pct = (n: number) => `${Math.round(n * 100)}%`
const hours = (h: number) => (h < 10 ? h.toFixed(1) : String(Math.round(h)))

function change(g: Gain, tools: number) {
  if (g.more <= 1e-9) return `it already makes enough: it could slow to ${one(up(g.rate))} units an hour per tool and still keep up`
  return `${one(up(g.rate))} units an hour per tool, ${one(up(g.more))} more than now (${pct(g.share)} faster), which is ${one(up(g.more * tools))} more units an hour across its ${tools} ${tools === 1 ? 'tool' : 'tools'}`
}

// What would have to improve in one workgroup, the bottleneck to begin with, for the factory to make the
// output wanted: the units an hour per tool it must reach, or the tools it must have, and a place to try a
// speed and see what the line does.
export function WhatIfCard({ factory, analysis, onApply }: WhatIfProps) {
  const [picked, setPicked] = useState<number | null>(null)
  const step = Math.min(picked ?? analysis.bottleneck, factory.steps.length - 1)
  const needs = useMemo(() => need(factory, step), [factory, step])
  const [trial, setTrial] = useState<number | null>(null)
  const suggested = up((needs.cycle ?? needs.output).rate)
  const rate = trial ?? suggested
  const result = useMemo(() => tryRate(factory, step, rate), [factory, step, rate])
  const s = factory.steps[step]
  const days = periodDays(factory)
  const kind = analysis.bottlenecks.includes(step) ? ' (a bottleneck)' : ''
  return (
    <section className="card whatif" aria-label="What if">
      <h2 className="card-title">What if</h2>
      <p className="hint">
        How much faster must a workgroup's tools get for the factory to make the {Math.round(factory.demand * days).toLocaleString('en-US')} good units a {periodName(factory)} you want? It starts with the bottleneck, since nothing else sets the pace.
      </p>
      <label className="number-field">
        <span className="setting-label">Workgroup to improve</span>
        <select value={step} onChange={(event) => (setPicked(Number(event.target.value)), setTrial(null))} aria-label="Workgroup to improve">
          {factory.steps.map((x, i) => (
            <option key={i} value={i}>
              {x.name}
              {analysis.bottlenecks.includes(i) ? ' (bottleneck)' : ''}
            </option>
          ))}
        </select>
      </label>
      <ul className="plain-list">
        <li>
          <strong>
            {needs.name}
            {kind}
          </strong>{' '}
          makes {one(s.rate)} units an hour per tool now.
        </li>
        <li>
          To <strong>keep up with the demand</strong> {needs.output.more <= 1e-9 ? '' : 'it needs '}
          {change(needs.output, s.tools)}.
        </li>
        <li>
          {needs.cycle ? (
            <>
              To keep up <strong>and meet {hours(factory.target)} hours</strong>, {change(needs.cycle, s.tools)}.
            </>
          ) : (
            <>
              <strong>Speeding up {needs.name} alone cannot meet {hours(factory.target)} hours</strong>
              {needs.limitedBy ? `: ${needs.limitedBy} would hold the line back however fast ${needs.name} gets. Improve that one too.` : '. Orders still take too long however fast it gets, so look at the order sizes and the variation.'}
            </>
          )}
        </li>
        <li>
          Or by tools at today's speed: {needs.tools.output > s.tools ? `${needs.tools.output - s.tools} more to keep up` : 'none more to keep up'}
          {needs.tools.cycle === null ? ', and no number of tools meets the cycle time on its own.' : needs.tools.cycle > s.tools ? `, ${needs.tools.cycle - s.tools} more to meet the cycle time too.` : ', and none more to meet the cycle time.'}
        </li>
      </ul>
      <h3 className="card-title">Try a speed</h3>
      <div className="field-grid">
        <NumberField label={`${s.name}: units an hour per tool`} value={rate} min={0.1} max={100000} step={1} decimals={1} onChange={setTrial} hint={trial === null ? 'Starts at what it needs.' : undefined} />
      </div>
      <p className={`trial ${result.meetsCycle ? 'ok' : result.keepsUp ? 'warn' : 'bad'}`} aria-live="polite">
        At {one(rate)}: {result.keepsUp ? `the line makes up to ${Math.round(result.capacity * days).toLocaleString('en-US')} good units a ${periodName(factory)}` : `${s.name} still cannot keep up`}, {s.name} is {pct(result.busy)} busy, and an order takes {hours(result.cycle)} hours
        {result.meetsCycle ? `, inside the ${hours(factory.target)} you want.` : result.keepsUp ? `, over the ${hours(factory.target)} you want.` : '.'}
        {result.next.name !== s.name && result.next.busy > result.busy ? ` Then ${result.next.name} is the busiest, at ${pct(result.next.busy)}.` : ''}
      </p>
      <div className="actions">
        <button className="btn small" disabled={rate === s.rate} onClick={() => (onApply(step, rate), setTrial(null))}>
          Use {one(rate)} for {s.name}
        </button>
        <button className="btn small" disabled={trial === null} onClick={() => setTrial(null)}>
          Back to what it needs
        </button>
      </div>
    </section>
  )
}
