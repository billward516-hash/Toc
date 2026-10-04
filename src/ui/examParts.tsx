import type { Risk } from '../exam/rules.ts'
import { RISK_LABEL } from '../exam/summary.ts'
import { Icon, type IconName } from './icons.tsx'
import { taughtIn } from './taught.ts'

// "Taught in 3.2 Size the buffer". Said as a pointer for anyone who wants to look further, never as a
// requirement: nobody has to have played a level to take the exam.
export function Taught({ levelId }: { levelId: string }) {
  const place = taughtIn(levelId)
  return place ? <p className="exam-taught">Taught in {place}</p> : null
}

const RISK_ICON: Record<Risk, IconName> = { safe: 'check', close: 'info', 'at-risk': 'alert', 'out-of-reach': 'cross' }

// How the exam is going, in a word and a symbol as well as a color.
export function RiskChip({ risk }: { risk: Risk }) {
  return (
    <span className={`exam-risk ${risk}`}>
      <Icon name={RISK_ICON[risk]} /> {RISK_LABEL[risk]}
    </span>
  )
}
