import { EXAM } from './config.ts'
import { correctInARow, correctToPass, fewestForExtra, mistakesToSpare, risk, type Risk } from './rules.ts'
import type { Item } from './types.ts'

// What the screens say about how an exam went, kept out of the screens so the words can be tested.

export interface Topic {
  tier: number
  asked: number
  correct: number
}

// How many of each tier's questions were asked, and how many were right, in tier order.
export function topics(items: readonly Item[], answers: readonly number[]): Topic[] {
  const byTier = new Map<number, Topic>()
  answers.forEach((choice, i) => {
    const item = items[i]
    const topic = byTier.get(item.tier) ?? { tier: item.tier, asked: 0, correct: 0 }
    topic.asked++
    if (choice === item.right) topic.correct++
    byTier.set(item.tier, topic)
  })
  return [...byTier.values()].sort((a, b) => a.tier - b.tier)
}

export interface Answered {
  item: Item
  chosen: number
  right: boolean
}

// The questions answered so far, each with the answer given and whether it was right.
export const answered = (items: readonly Item[], answers: readonly number[]): Answered[] =>
  answers.map((chosen, i) => ({ item: items[i], chosen, right: chosen === items[i].right }))

// The topics with the most mistakes, worst first, leaving out any without one.
export function weakest(list: readonly Topic[], count = 3): Topic[] {
  const missed = (t: Topic) => t.asked - t.correct
  return list
    .filter((t) => missed(t) > 0)
    .sort((a, b) => missed(b) - missed(a) || a.correct / a.asked - b.correct / b.asked || a.tier - b.tier)
    .slice(0, count)
}

export const RISK_LABEL: Record<Risk, string> = { safe: 'On track', close: 'Close', 'at-risk': 'At risk', 'out-of-reach': 'Out of reach' }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// "close" only ever means 0, 1, or 2 mistakes to spare, so say it in words.
const SPARE = ['No mistakes', 'One mistake', 'Two mistakes']

// One sentence on where the player stands, after an answer.
export function riskLine(asked: number, correct: number): string {
  const standing = risk(asked, correct)
  const pass = `${EXAM.passPercent}%`
  switch (standing) {
    case 'safe':
      return asked >= EXAM.length ? `You have reached the ${pass} pass mark.` : 'You are on track to pass.'
    case 'close': {
      const spare = mistakesToSpare(asked, correct)
      return `${SPARE[spare] ?? plural(spare, 'mistake')} to spare.`
    }
    case 'at-risk':
      if (asked < EXAM.length) {
        return `Below the pass mark for now. If you finish with ${fewestForExtra()} to ${correctToPass() - 1} right, up to ${EXAM.maxExtra} extra questions will follow to help you get there.`
      }
      return `${plural(correctInARow(asked, correct), 'more right answer')} in a row would reach ${pass}.`
    case 'out-of-reach':
      return asked < EXAM.length
        ? `You cannot reach ${pass} this time, even with extra questions. Keep going to see the rest of the answers.`
        : `You cannot reach ${pass} this time.`
  }
}
