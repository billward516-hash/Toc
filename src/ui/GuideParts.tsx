import type { ReactNode } from 'react'
import { fillCourse } from '../course/summary.ts'
import type { Block, Step, StepKind } from '../course/types.ts'

const LABEL: Record<StepKind, string> = { say: 'Say', ask: 'Ask', do: 'Do', look: 'Look for', tip: 'Tip' }

// A trainer's steps in order, each labeled in words as well as color: what to say, ask, do, notice.
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="steps">
      {steps.map((step, i) => (
        <li key={i} className={`step ${step.kind}`}>
          <span className="step-kind">{LABEL[step.kind]}</span>
          <div className="step-body">
            <p>{step.kind === 'say' ? `“${step.text}”` : step.text}</p>
            {step.note && <p className="step-note">{step.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

// Paragraphs, lists, and steps, with the course's own numbers filled in.
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'p') return <p key={i}>{fillCourse(block.text)}</p>
        if (block.kind === 'steps') return <Steps key={i} steps={block.steps} />
        const items = block.items.map((item, k) => <li key={k}>{fillCourse(item)}</li>)
        return block.ordered ? (
          <ol key={i} className="plain-list numbered">
            {items}
          </ol>
        ) : (
          <ul key={i} className="plain-list">
            {items}
          </ul>
        )
      })}
    </>
  )
}

interface TabsProps<T extends string> {
  label: string
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  panel: string
}

// A row of tabs for a guide, with the same look as the class screen's.
export function GuideTabs<T extends string>({ label, tabs, value, onChange, panel }: TabsProps<T>): ReactNode {
  return (
    <div className="host-tabs guide-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${panel}-tab-${tab.id}`}
          role="tab"
          aria-selected={value === tab.id}
          aria-controls={panel}
          className={`host-tab${value === tab.id ? ' on' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
