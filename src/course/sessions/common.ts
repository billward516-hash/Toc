import { ask, say } from '../steps.ts'
import { tierInfoFor } from '../tiers.ts'
import type { Step, TalkSegment } from '../types.ts'

// The end of a session: the ideas said once more in plain words, the tier's exit question (learners
// can write their answer in the Notes of the Course guide), and where the course goes next.
export function closing(tier: number, minutes: number, recap: Step[]): TalkSegment {
  const info = tierInfoFor(tier)
  return {
    kind: 'talk',
    title: 'Close',
    minutes,
    steps: [
      ...recap,
      ask(info.reflect[0], 'Give a minute to think, then take two or three answers. Learners can write theirs in Notes, in the Course guide.'),
      say(info.bridge),
    ],
  }
}
