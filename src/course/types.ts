import type { Choices } from '../levels/types.ts'

// The course that goes with the game, for the people learning from it and the person teaching it.
// The trainer's script is data, so the game can show it, print it, and check it against the levels.

// One thing for the trainer to do, in the order to do it.
//   say:  words to say aloud
//   ask:  a question for the room
//   do:   something to do on a screen or in the room
//   look: something to notice
//   tip:  advice for the trainer
export type StepKind = 'say' | 'ask' | 'do' | 'look' | 'tip'

export interface Step {
  kind: StepKind
  text: string
  // A smaller line under the step: what good answers sound like, or why.
  note?: string
}

// A stretch of the session with no level in it: the opening, a demonstration, the close.
export interface TalkSegment {
  kind: 'talk'
  title: string
  minutes: number
  // Left out of the session's length, for a trainer with time to spare.
  optional?: boolean
  steps: Step[]
}

// One level, played and talked over. Numbers in the text can be written as {baseline}, {best}, and
// so on (see facts.ts): the game fills them in from the level itself, so they can't go stale.
export interface PlaySegment {
  kind: 'play'
  levelId: string
  // Setting it up, playing it, and the debrief, all told.
  minutes: number
  // Of those, how long the learners play.
  play: number
  // The one sentence to leave the room with.
  idea: string
  setup: Step[]
  // What to notice while they play.
  watch: string[]
  // The wrong turns learners take, and what each one shows.
  mistakes: string[]
  debrief: Step[]
  // Planning levels: the plan that earns every star. Checked by the tests.
  answer?: Choices
}

export type Segment = TalkSegment | PlaySegment

// One session of the course, for one tier of the game.
export interface Session {
  tier: number
  // What the session is about, for the trainer.
  summary: string
  // To do before the session starts.
  before: string[]
  segments: Segment[]
  // What to cut when time is short.
  short: string[]
  // What to add when there's time to spare.
  extend: string[]
}

// What learners are told about a tier, and asked to think about.
export interface TierInfo {
  tier: number
  // Finishing sentences to "By the end you can…".
  objectives: string[]
  // Questions to think about after the tier, in the learner's notes.
  reflect: string[]
  // What comes next, for the end of the session.
  bridge: string
}

export interface Term {
  term: string
  // The tier where the game brings it up.
  tier: number
  meaning: string
}

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'steps'; steps: Step[] }

export interface OverviewSection {
  id: string
  title: string
  blocks: Block[]
}
