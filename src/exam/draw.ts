import { stream, type Rng } from '../engine/random.ts'
import { EXAM, QUOTA } from './config.ts'
import type { Item, Question } from './types.ts'

// A fair shuffle (Fisher-Yates) driven by the given random numbers, so the same seed shuffles the same way.
export function shuffle<T>(values: readonly T[], rng: Rng): T[] {
  const out = [...values]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const held = out[i]
    out[i] = out[j]
    out[j] = held
  }
  return out
}

// Which questions an exam asks, and in what order. The main ones come first, then the reserve: the
// extra questions, in the order they would be added. Everything about the exam follows from the seed,
// the bank, and the questions this player has seen before, so a saved plan can be rebuilt exactly.
export interface Plan {
  seed: number
  main: string[]
  reserve: string[]
}

// Draws an exam. Each tier gives its quota of questions, so every exam covers the whole course in the
// same proportions. Within a tier, questions this player has seen least come first, so a retake favors
// ones they have not met, and chance settles ties. The reserve takes what is left, spread across the
// tiers, the same way. Neither takes two questions from one group of `sameIdea`, because the answer
// shown after the first would give away the second.
export function planExam(
  bank: readonly Question[],
  seed: number,
  seen: Readonly<Record<string, number>> = {},
  sameIdea: readonly (readonly string[])[] = [],
): Plan {
  const rng = stream(seed, 'plan')
  // The groups each question belongs to, and the groups this exam has already drawn from.
  const groupsOf = new Map<string, number[]>()
  sameIdea.forEach((group, number) => {
    for (const id of group) groupsOf.set(id, [...(groupsOf.get(id) ?? []), number])
  })
  const used = new Set<number>()
  const clashes = (question: Question) => (groupsOf.get(question.id) ?? []).some((number) => used.has(number))
  const take = (question: Question) => (groupsOf.get(question.id) ?? []).forEach((number) => used.add(number))

  const main: Question[] = []
  const left = new Map<number, Question[]>()
  // Tiers are drawn in a random order, so that when an idea runs across tiers none of them always gets it.
  for (const tier of shuffle(Object.keys(QUOTA).map(Number), rng)) {
    const ranked = bank
      .filter((q) => q.tier === tier)
      .map((q) => ({ q, luck: rng() }))
      .sort((a, b) => (seen[a.q.id] ?? 0) - (seen[b.q.id] ?? 0) || a.luck - b.luck)
      .map((entry) => entry.q)
    const chosen: Question[] = []
    for (const q of ranked) {
      if (chosen.length === QUOTA[tier]) break
      if (clashes(q)) continue
      chosen.push(q)
      take(q)
    }
    // A tier with too few different ideas still gives its quota, from what comes next. The real bank has enough.
    for (const q of ranked) if (chosen.length < QUOTA[tier] && !chosen.includes(q)) chosen.push(q)
    main.push(...chosen)
    left.set(tier, ranked.filter((q) => !chosen.includes(q)))
  }

  // The extra questions: one from each tier in turn, round after round, each time an idea not yet asked.
  // Only when those run out (the real bank has enough for all but the last few) does it take a repeat, so
  // the reserve is always full.
  const tiers = shuffle([...left.keys()], rng)
  const reserve: Question[] = []
  for (const fresh of [true, false]) {
    for (let added = true; added && reserve.length < EXAM.maxExtra; ) {
      added = false
      for (const tier of tiers) {
        if (reserve.length === EXAM.maxExtra) break
        const queue = left.get(tier) ?? []
        const at = fresh ? queue.findIndex((q) => !clashes(q)) : queue.length > 0 ? 0 : -1
        if (at < 0) continue
        const [question] = queue.splice(at, 1)
        reserve.push(question)
        take(question)
        added = true
      }
    }
  }
  return { seed, main: shuffle(main, rng).map((q) => q.id), reserve: reserve.map((q) => q.id) }
}

// A question as this exam asks it. A multiple choice question's options are shuffled, a different way
// for every seed, so two people never see the same lettering. True/false keeps True first.
export function itemFor(question: Question, seed: number): Item {
  const base = { id: question.id, tier: question.tier, kind: question.kind, prompt: question.prompt, why: question.why, level: question.level }
  if (question.kind === 'tf') return { ...base, options: ['True', 'False'], right: question.answer ? 0 : 1 }
  const options = shuffle([question.right, ...question.wrong], stream(seed, question.id))
  return { ...base, options, right: options.indexOf(question.right) }
}

// Every question of a plan as an item, the main ones then the reserve. Null if the bank no longer has
// one of them, which can happen to an exam saved before the bank changed.
export function itemsOf(plan: Plan, bank: readonly Question[]): Item[] | null {
  const byId = new Map(bank.map((q) => [q.id, q]))
  const items: Item[] = []
  for (const id of [...plan.main, ...plan.reserve]) {
    const question = byId.get(id)
    if (!question) return null
    items.push(itemFor(question, plan.seed))
  }
  return items
}
