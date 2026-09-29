import { levels, tierNames } from '../levels/index.ts'
import { principleNames } from '../levels/principles.ts'
import type { Level } from '../levels/types.ts'
import { answerLines } from './answers.ts'
import { levelFiller } from './facts.ts'
import { levelNumber } from './numbering.ts'
import { act } from './steps.ts'
import { sessionMinutes } from './summary.ts'
import { tierInfoFor } from './tiers.ts'
import type { Session, Step } from './types.ts'

// A session as the trainer reads it: the game's numbers filled in, and the steps that are the same for
// every level (sending the class to it, reading the tally) added around the ones written for it.

export interface ResolvedTalk {
  kind: 'talk'
  title: string
  minutes: number
  optional: boolean
  steps: Step[]
}

export interface ResolvedPlay {
  kind: 'play'
  level: Level
  number: string
  title: string
  principles: string[]
  minutes: number
  play: number
  // A level with a right answer, or a planning level: what the class screen shows differs.
  answers: 'pick' | 'plans'
  idea: string
  setup: Step[]
  during: Step[]
  watch: string[]
  mistakes: string[]
  debrief: Step[]
  answer: string[]
}

export type ResolvedSegment = ResolvedTalk | ResolvedPlay

export interface ResolvedSession {
  tier: number
  name: string
  summary: string
  objectives: string[]
  before: string[]
  segments: ResolvedSegment[]
  // Minutes into the session at which each segment starts (optional segments are left out of the clock).
  starts: (number | null)[]
  minutes: { core: number; optional: number }
  short: string[]
  extend: string[]
}

export function resolveSession(session: Session): ResolvedSession {
  const info = tierInfoFor(session.tier)
  let clock = 0
  const starts: (number | null)[] = []
  const segments = session.segments.map<ResolvedSegment>((segment) => {
    if (segment.kind === 'talk') {
      starts.push(segment.optional ? null : clock)
      if (!segment.optional) clock += segment.minutes
      return { kind: 'talk', title: segment.title, minutes: segment.minutes, optional: segment.optional ?? false, steps: segment.steps }
    }
    starts.push(clock)
    clock += segment.minutes
    const level = levels.find((l) => l.id === segment.levelId)
    if (!level) throw new Error(`The script names a level that does not exist: ${segment.levelId}`)
    const fill = levelFiller(level, segment.answer)
    const fillStep = (step: Step): Step => ({ ...step, text: fill(step.text), note: step.note ? fill(step.note) : undefined })
    const number = levelNumber(level)
    const answers = level.goal.kind === 'identifyBottleneck' || level.goal.kind === 'predict' ? 'pick' : 'plans'
    return {
      kind: 'play',
      level,
      number,
      title: level.title,
      principles: level.principles.map((p) => principleNames[p]),
      minutes: segment.minutes,
      play: segment.play,
      answers,
      idea: fill(segment.idea),
      setup: [
        act(`Send the class to this level: on the Answers tab, choose ${number} ${level.title}, then tap Send everyone here. Each learner gets a prompt: Go to this level.`),
        ...segment.setup.map(fillStep),
      ],
      during: [
        act(
          `Let learners play on their own devices for about ${segment.play} minutes. Watch the Progress tab: a cell turns amber when someone has tried the level, and gets a check when they finish.`,
        ),
      ],
      watch: segment.watch.map(fill),
      mistakes: segment.mistakes.map(fill),
      debrief: [
        act(
          answers === 'pick'
            ? 'On the Answers tab, read the tally of everyone\'s first answer, with the right answer still hidden.'
            : 'On the Answers tab, read the plans table: every plan the class ran, best first, with how many learners ran each.',
        ),
        ...segment.debrief.map(fillStep),
        act(
          answers === 'pick'
            ? 'Tap Show the right answer. Then tap Watch the factory to replay it on the TV.'
            : 'Tap Watch on the best plan, then on a plan that missed the goal, and compare the two on the TV.',
        ),
      ],
      answer: answerLines(level, segment.answer),
    }
  })
  return {
    tier: session.tier,
    name: tierNames[session.tier],
    summary: session.summary,
    objectives: info.objectives,
    before: session.before,
    segments,
    starts,
    minutes: sessionMinutes(session),
    short: session.short,
    extend: session.extend,
  }
}

// "0:00", "1:05": minutes into a session, as a clock.
export const clockAt = (minutes: number): string => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

// Working out a session runs its levels, so each is done once, when first needed.
const resolved = new Map<number, ResolvedSession>()
export function resolvedSession(session: Session): ResolvedSession {
  let found = resolved.get(session.tier)
  if (!found) {
    found = resolveSession(session)
    resolved.set(session.tier, found)
  }
  return found
}
