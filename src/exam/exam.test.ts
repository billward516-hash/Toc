import { describe, expect, it } from 'vitest'
import { levels } from '../levels/index.ts'
import { bank, SAME_IDEA } from './bank/index.ts'
import { EXAM, QUOTA } from './config.ts'
import { itemFor, itemsOf, planExam, shuffle } from './draw.ts'
import { abandon, begin, cleanRecord, emptyRecord, finish, NAME_MAX, recordAnswer, withCertificate, withName } from './record.ts'
import { canStillPass, correctInARow, correctToPass, extraLeft, fewestForExtra, mistakesToSpare, mostWrongAllowed, next, passes, percentOf, risk } from './rules.ts'
import { mulberry32 } from '../engine/random.ts'

const tiers = Object.keys(QUOTA).map(Number)
const inTier = (tier: number) => bank.filter((q) => q.tier === tier)

describe('the question bank', () => {
  it('has the number of questions the exam draws from, and a fair mix of kinds and answers', () => {
    expect(bank).toHaveLength(EXAM.bank)
    const truths = bank.filter((q) => q.kind === 'tf')
    expect(truths.length).toBeGreaterThanOrEqual(30)
    expect(truths.length).toBeLessThanOrEqual(40)
    // Neither "always true" nor "always false" is a good way to guess.
    const trues = truths.filter((q) => q.kind === 'tf' && q.answer).length
    expect(trues).toBeGreaterThanOrEqual(15)
    expect(trues).toBeLessThanOrEqual(truths.length - 15)
  })

  it('gives every tier its quota, with questions to spare for the extra ones', () => {
    expect(Object.values(QUOTA).reduce((a, b) => a + b, 0)).toBe(EXAM.length)
    expect(new Set(bank.map((q) => q.tier))).toEqual(new Set(tiers))
    let spare = 0
    for (const tier of tiers) {
      expect(inTier(tier).length, `tier ${tier}`).toBeGreaterThan(QUOTA[tier])
      spare += inTier(tier).length - QUOTA[tier]
    }
    expect(spare).toBeGreaterThanOrEqual(EXAM.maxExtra)
  })

  it('numbers its questions by tier, with no id or prompt used twice', () => {
    for (const q of bank) expect(q.id, q.id).toMatch(new RegExp(`^${q.tier}-\\d+$`))
    expect(new Set(bank.map((q) => q.id)).size).toBe(bank.length)
    expect(new Set(bank.map((q) => q.prompt)).size).toBe(bank.length)
  })

  it('asks multiple choice questions with four different options and no catch-all answers', () => {
    for (const q of bank) {
      if (q.kind !== 'mc') continue
      const options = [q.right, ...q.wrong].map((o) => o.trim().toLowerCase())
      expect(new Set(options).size, q.id).toBe(4)
      for (const option of options) {
        expect(option, q.id).not.toMatch(/all of the above|none of the above|both of these|\ba and b\b|\bneither\b/)
        expect(option.length, q.id).toBeGreaterThan(2)
      }
    }
  })

  it('does not give the answer away by length: the right option is not usually the longest, or the second longest', () => {
    const choices = bank.filter((q) => q.kind === 'mc')
    // How many wrong options are at least as long as the right one: 0 means the right one is the longest, 3 the shortest.
    const rank = (q: (typeof choices)[number]) => (q.kind === 'mc' ? q.wrong.filter((w) => w.length >= q.right.length).length : 0)
    // By chance with four options each rank is a quarter of the questions, and the top two together are half.
    expect(choices.filter((q) => rank(q) === 0).length / choices.length).toBeLessThan(0.33)
    expect(choices.filter((q) => rank(q) <= 1).length / choices.length).toBeLessThan(0.6)
    // Nor is the right one usually the shortest, or second shortest, which a test-wise guesser would learn to pick instead.
    for (const place of [0, 1, 2, 3]) expect(choices.filter((q) => rank(q) === place).length / choices.length, `rank ${place}`).toBeLessThan(0.4)
  })

  it('does not give the answer away by wording: wrong options are as plain as right ones', () => {
    const choices = bank.filter((q) => q.kind === 'mc')
    const extreme = /\b(always|never|nothing|none|exactly)\b/i
    const rightOnes = choices.filter((q) => q.kind === 'mc' && extreme.test(q.right)).length
    const wrongOnes = choices.reduce((n, q) => n + (q.kind === 'mc' ? q.wrong.filter((w) => extreme.test(w)).length : 0), 0)
    // A third of the wrong options and a third of the right ones would be the same rate; the wrong ones were once far likelier.
    expect(wrongOnes / (choices.length * 3)).toBeLessThan(2 * (rightOnes / choices.length) + 0.06)
    // And the true/false statements that use an extreme word are not all false.
    const extremes = bank.filter((q) => q.kind === 'tf' && extreme.test(q.prompt))
    const trueOnes = extremes.filter((q) => q.kind === 'tf' && q.answer).length
    expect(trueOnes).toBeGreaterThanOrEqual(Math.floor(extremes.length / 3))
  })

  it('groups questions that repeat each other, and only real ones', () => {
    const ids = new Set(bank.map((q) => q.id))
    for (const group of SAME_IDEA) {
      expect(group.length, group.join(' ')).toBeGreaterThanOrEqual(2)
      expect(new Set(group).size, group.join(' ')).toBe(group.length)
      for (const id of group) expect(ids.has(id), id).toBe(true)
    }
    // Within a tier there must be at least as many different ideas as the tier's quota, or the tier could not be drawn without a repeat.
    for (const tier of tiers) {
      const own = inTier(tier).map((q) => q.id)
      const groups = SAME_IDEA.filter((g) => g.some((id) => own.includes(id)))
      const alone = own.filter((id) => !groups.some((g) => g.includes(id))).length
      expect(groups.length + alone, `tier ${tier}`).toBeGreaterThanOrEqual(QUOTA[tier])
    }
  })

  it('explains every answer', () => {
    for (const q of bank) {
      expect(q.why.length, q.id).toBeGreaterThanOrEqual(60)
      expect(q.why, q.id).toMatch(/[.?]$/)
      expect(q.prompt.length, q.id).toBeGreaterThanOrEqual(25)
    }
  })

  it('ties each question to a level of its own tier, and every level has a question', () => {
    for (const q of bank) {
      const level = levels.find((l) => l.id === q.level)
      expect(level, `${q.id}: ${q.level}`).toBeDefined()
      expect(level?.tier, q.id).toBe(q.tier)
    }
    for (const level of levels) expect(bank.some((q) => q.level === level.id), level.id).toBe(true)
  })

  it('stands on its own: nothing in a question needs the game or the course', () => {
    for (const q of bank) {
      const words = [q.prompt, ...(q.kind === 'mc' ? [q.right, ...q.wrong] : [])].join(' ')
      expect(words, q.id).not.toMatch(/\b(the game|this game|the course|this course|the briefing|each level|a level|tier \d)\b/i)
    }
  })
})

describe('the pass mark', () => {
  it('is 70%, worked out exactly', () => {
    expect(passes(28, 40)).toBe(true)
    expect(passes(27, 40)).toBe(false)
    expect(passes(0, 0)).toBe(false)
    expect(correctToPass()).toBe(28)
    for (let asked = 1; asked <= EXAM.length + EXAM.maxExtra; asked++) {
      for (let correct = 0; correct <= asked; correct++) expect(passes(correct, asked), `${correct}/${asked}`).toBe(correct * 10 >= 7 * asked)
    }
  })

  it('never shows a failing score as 70%', () => {
    expect(percentOf(28, 40)).toBe(70)
    expect(percentOf(27, 40)).toBe(67)
    // 30 of 43 is 69.77%, which a rounding display would call 70%.
    expect(passes(30, 43)).toBe(false)
    expect(percentOf(30, 43)).toBe(69)
    for (let asked = 1; asked <= EXAM.length + EXAM.maxExtra; asked++) {
      for (let correct = 0; correct <= asked; correct++) expect(percentOf(correct, asked) >= 70, `${correct}/${asked}`).toBe(passes(correct, asked))
    }
  })

  it('allows 12 mistakes in 40 questions and 16 in the longest exam', () => {
    expect(mostWrongAllowed(40)).toBe(12)
    expect(mostWrongAllowed(EXAM.length + EXAM.maxExtra)).toBe(16)
  })
})

describe('the extra questions', () => {
  const longest = EXAM.length + EXAM.maxExtra

  it('are asked only to someone below the pass mark who can still reach it', () => {
    expect(next(10, 4)).toEqual({ kind: 'ask' })
    expect(next(39, 20)).toEqual({ kind: 'ask' })
    expect(next(40, 28)).toEqual({ kind: 'done', passed: true })
    expect(next(40, 40)).toEqual({ kind: 'done', passed: true })
    // 24 to 27 right out of 40 is within reach of 70%; 23 or fewer is not, even if all 15 extra are right.
    for (const correct of [24, 25, 26, 27]) expect(next(40, correct), `${correct}/40`).toEqual({ kind: 'extend', starting: true })
    for (const correct of [0, 10, 23]) expect(next(40, correct), `${correct}/40`).toEqual({ kind: 'done', passed: false })
    // The lowest score that still gets extra questions, for the intro to say.
    expect(fewestForExtra()).toBe(24)
    for (let correct = 0; correct <= EXAM.length; correct++) expect(next(40, correct).kind === 'extend', `${correct}/40`).toBe(correct >= fewestForExtra() && correct < correctToPass())
  })

  it('end the moment the score reaches 70%, or can no longer', () => {
    // 27 of 40 needs four right in a row: 28/41, 29/42, 30/43 are all under 70%, and 31/44 is over.
    expect(correctInARow(40, 27)).toBe(4)
    expect(next(41, 28)).toEqual({ kind: 'extend', starting: false })
    expect(next(43, 30)).toEqual({ kind: 'extend', starting: false })
    expect(next(44, 31)).toEqual({ kind: 'done', passed: true })
    // A wrong answer in the extra questions can make the pass out of reach.
    expect(next(41, 27)).toEqual({ kind: 'extend', starting: false })
    expect(next(50, 33)).toEqual({ kind: 'done', passed: false })
    expect(next(longest, 38)).toEqual({ kind: 'done', passed: false })
    expect(next(longest, 39)).toEqual({ kind: 'done', passed: true })
  })

  it('count how many right answers in a row would reach the pass mark', () => {
    expect(correctInARow(40, 28)).toBe(0)
    expect(correctInARow(40, 40)).toBe(0)
    expect(correctInARow(40, 24)).toBe(14)
    expect(correctInARow(40, 23)).toBe(17)
    expect(extraLeft(40)).toBe(EXAM.maxExtra)
    expect(extraLeft(longest)).toBe(0)
    expect(extraLeft(60)).toBe(0)
  })

  it('never go past the longest exam, and never run when they cannot change the result', () => {
    for (let asked = 0; asked <= longest; asked++) {
      for (let correct = 0; correct <= asked; correct++) {
        const result = next(asked, correct)
        const label = `${correct}/${asked}`
        if (asked < EXAM.length) {
          expect(result, label).toEqual({ kind: 'ask' })
        } else if (passes(correct, asked)) {
          expect(result, label).toEqual({ kind: 'done', passed: true })
        } else if (result.kind === 'extend') {
          expect(asked, label).toBeLessThan(longest)
          expect(canStillPass(asked, correct), label).toBe(true)
          // Some run of right answers within the limit would pass.
          const k = correctInARow(asked, correct)
          expect(k, label).toBeGreaterThan(0)
          expect(k, label).toBeLessThanOrEqual(longest - asked)
          expect(passes(correct + k, asked + k), label).toBe(true)
          expect(result.starting, label).toBe(asked === EXAM.length)
        } else {
          expect(result, label).toEqual({ kind: 'done', passed: false })
          expect(asked === longest || !canStillPass(asked, correct), label).toBe(true)
        }
      }
    }
  })

  it('end every possible exam with a result that agrees with the pass mark', () => {
    // Every state an exam can reach by any order of right and wrong answers: the exam is over by the
    // longest length, whatever the answers were, and each result agrees with the pass mark.
    let states = new Set([0])
    let ended = 0
    for (let asked = 0; asked < longest; asked++) {
      const following = new Set<number>()
      for (const correct of states) {
        for (const right of [0, 1]) {
          const now = correct + right
          const result = next(asked + 1, now)
          if (result.kind === 'done') {
            ended++
            expect(asked + 1, `${now}/${asked + 1}`).toBeGreaterThanOrEqual(EXAM.length)
            expect(passes(now, asked + 1), `${now}/${asked + 1}`).toBe(result.passed)
          } else {
            following.add(now)
          }
        }
      }
      states = following
    }
    expect(states.size).toBe(0)
    expect(ended).toBeGreaterThan(0)
  })

  it('never turn a pass into a fail: a better run of answers always does at least as well', () => {
    const outcomeOf = (answers: boolean[]) => {
      let correct = 0
      for (let i = 0; i < answers.length; i++) {
        correct += answers[i] ? 1 : 0
        const result = next(i + 1, correct)
        if (result.kind === 'done') return result.passed
      }
      return null
    }
    const rng = mulberry32(5)
    for (let trial = 0; trial < 400; trial++) {
      const answers = Array.from({ length: longest }, () => rng() < 0.7)
      const first = outcomeOf(answers)
      expect(first, `trial ${trial}`).not.toBeNull()
      // Flip one wrong answer to right: a pass stays a pass.
      const index = answers.findIndex((a) => !a)
      if (index >= 0 && first) {
        const better = [...answers]
        better[index] = true
        expect(outcomeOf(better), `trial ${trial}`).toBe(true)
      }
    }
  })

  it('help someone who knows 70% of the material, but not someone who knows half of it', () => {
    // The exact chance of passing for a taker who gets each question right with probability p.
    const chance = (p: number) => {
      let state = new Map<number, number>([[0, 1]])
      let passed = 0
      for (let asked = 0; asked < longest; asked++) {
        const following = new Map<number, number>()
        for (const [correct, probability] of state) {
          for (const [right, weight] of [[1, p], [0, 1 - p]] as const) {
            const result = next(asked + 1, correct + right)
            const mass = probability * weight
            if (result.kind === 'done') passed += result.passed ? mass : 0
            else following.set(correct + right, (following.get(correct + right) ?? 0) + mass)
          }
        }
        state = following
      }
      return passed
    }
    const base = (p: number) => {
      let total = 0
      let coefficient = 1
      for (let k = 0; k <= EXAM.length; k++) {
        if (k > 0) coefficient = (coefficient * (EXAM.length - k + 1)) / k
        if (passes(k, EXAM.length)) total += coefficient * p ** k * (1 - p) ** (EXAM.length - k)
      }
      return total
    }
    let before = 0
    for (const p of [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9]) {
      const withExtra = chance(p)
      expect(withExtra, `p=${p}`).toBeGreaterThanOrEqual(base(p))
      expect(withExtra - base(p), `p=${p}`).toBeLessThan(0.12)
      expect(withExtra, `p=${p}`).toBeGreaterThanOrEqual(before)
      before = withExtra
    }
    expect(chance(0.5)).toBeLessThan(0.03)
    expect(chance(0.7)).toBeGreaterThan(0.6)
    expect(chance(0.9)).toBeGreaterThan(0.999)
  })
})

describe('how the exam is going', () => {
  it('says so as answers come in', () => {
    expect(risk(0, 0)).toBe('safe')
    expect(risk(30, 28)).toBe('safe')
    // Twelve mistakes is the most a pass in 40 allows. Ten to twelve is close (twelve leaves none to
    // spare); thirteen is below the line, where extra questions could still help, up to sixteen.
    expect(risk(20, 15)).toBe('safe')
    expect(risk(20, 10)).toBe('close')
    expect(risk(20, 8)).toBe('close')
    expect(risk(20, 7)).toBe('at-risk')
    expect(risk(20, 4)).toBe('at-risk')
    expect(risk(20, 3)).toBe('out-of-reach')
    expect(mistakesToSpare(20, 15)).toBe(7)
    expect(mistakesToSpare(20, 8)).toBe(0)
    expect(mistakesToSpare(20, 7)).toBe(0)
  })

  it('says so after the main questions and during the extra ones', () => {
    expect(risk(40, 30)).toBe('safe')
    expect(risk(40, 27)).toBe('at-risk')
    expect(risk(40, 23)).toBe('out-of-reach')
    expect(risk(42, 29)).toBe('at-risk')
    expect(risk(44, 31)).toBe('safe')
  })

  it('agrees with what happens next', () => {
    for (let asked = 0; asked <= EXAM.length + EXAM.maxExtra; asked++) {
      for (let correct = 0; correct <= asked; correct++) {
        const status = risk(asked, correct)
        expect(status === 'out-of-reach', `${correct}/${asked}`).toBe(!canStillPass(asked, correct))
        if (asked >= EXAM.length && !passes(correct, asked)) expect(['at-risk', 'out-of-reach'], `${correct}/${asked}`).toContain(status)
      }
    }
  })
})

describe('drawing an exam', () => {
  const plan = (seed: number, seen: Record<string, number> = {}) => planExam(bank, seed, seen, SAME_IDEA)
  const tierOf = (id: string) => bank.find((q) => q.id === id)!.tier

  it('asks every tier its quota, with no question twice', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { main, reserve } = plan(seed)
      expect(main, `seed ${seed}`).toHaveLength(EXAM.length)
      expect(reserve, `seed ${seed}`).toHaveLength(EXAM.maxExtra)
      expect(new Set([...main, ...reserve]).size, `seed ${seed}`).toBe(EXAM.length + EXAM.maxExtra)
      for (const tier of tiers) expect(main.filter((id) => tierOf(id) === tier), `seed ${seed} tier ${tier}`).toHaveLength(QUOTA[tier])
    }
  })

  it('spreads the extra questions across the tiers', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { reserve } = plan(seed)
      const covered = new Set(reserve.map(tierOf))
      for (const tier of tiers) expect(reserve.filter((id) => tierOf(id) === tier).length, `seed ${seed} tier ${tier}`).toBeLessThanOrEqual(4)
      // Some tiers have no spare idea left once the main questions are drawn, but most are covered.
      expect(covered.size, `seed ${seed}`).toBeGreaterThanOrEqual(8)
    }
  })

  it('never asks two questions about the same idea, in the main questions or the first dozen extra ones', () => {
    const group = (id: string) => SAME_IDEA.flatMap((g, n) => (g.includes(id) ? [n] : []))
    for (let seed = 1; seed <= 1500; seed++) {
      const { main, reserve } = plan(seed)
      expect(main, `seed ${seed}`).toHaveLength(EXAM.length)
      expect(reserve, `seed ${seed}`).toHaveLength(EXAM.maxExtra)
      expect(new Set([...main, ...reserve]).size, `seed ${seed}`).toBe(EXAM.length + EXAM.maxExtra)
      // With 100 questions and up to 55 asked, the last extra questions may have to repeat an idea; nobody who gets that far minds.
      const asked = [...main, ...reserve.slice(0, EXAM.maxExtra - 3)]
      const groups = asked.flatMap(group)
      expect(new Set(groups).size, `seed ${seed}: ${asked.filter((id) => group(id).length).join(' ')}`).toBe(groups.length)
    }
  })

  it('does not guard against repeats when it is not told about them', () => {
    // The default is no groups, which is what the other tests of the draw rely on.
    expect(planExam(bank, 5)).toEqual(planExam(bank, 5, {}, []))
  })

  it('is the same for the same seed and different for different seeds', () => {
    expect(plan(7)).toEqual(plan(7))
    expect(plan(7)).not.toEqual(plan(8))
    const exams = Array.from({ length: 80 }, (_, i) => plan(i + 1).main)
    expect(new Set(exams.map((m) => m.join(','))).size).toBe(exams.length)
    // Two people next to each other share some questions, but nowhere near all of them, and not in the same order.
    let shared = 0
    let pairs = 0
    for (let i = 0; i < exams.length; i++) {
      for (let j = i + 1; j < exams.length; j++) {
        const overlap = exams[i].filter((id) => exams[j].includes(id)).length
        expect(overlap, `${i} and ${j}`).toBeLessThan(34)
        shared += overlap
        pairs++
      }
    }
    expect(shared / pairs).toBeGreaterThan(12)
    expect(shared / pairs).toBeLessThan(20)
    expect(new Set(exams.map((m) => tierOf(m[0]))).size).toBeGreaterThanOrEqual(5)
  })

  it('favors questions the player has not met, and goes through the bank before repeating', () => {
    // Mark two of Tier 3's twelve questions as seen: a new exam takes its five from the other ten.
    const seen = { '3-1': 1, '3-4': 1 }
    for (let seed = 1; seed <= 30; seed++) {
      const { main } = plan(seed, seen)
      expect(main.filter((id) => id in seen), `seed ${seed}`).toEqual([])
    }
    // A retake, with what the exam before it asked marked as seen, shares far fewer questions than two fresh exams do.
    let retaken = 0
    let fresh = 0
    for (let seed = 1; seed <= 40; seed++) {
      const first = plan(seed)
      const marked = Object.fromEntries(first.main.map((id) => [id, 1]))
      retaken += plan(seed + 1000, marked).main.filter((id) => first.main.includes(id)).length
      fresh += plan(seed + 1000).main.filter((id) => first.main.includes(id)).length
    }
    expect(retaken / 40).toBeLessThan(0.4 * (fresh / 40))
    // Having seen everything still draws a full exam.
    const everything = Object.fromEntries(bank.map((q) => [q.id, 3]))
    expect(plan(13, everything).main).toHaveLength(EXAM.length)
  })

  it('shuffles the options of a multiple choice question differently for different seeds', () => {
    const question = bank.find((q) => q.kind === 'mc')!
    const positions = new Set<number>()
    const orders = new Set<string>()
    for (let seed = 1; seed <= 80; seed++) {
      const item = itemFor(question, seed)
      expect(item.options).toHaveLength(4)
      expect([...item.options].sort()).toEqual([question.kind === 'mc' ? question.right : '', ...(question.kind === 'mc' ? question.wrong : [])].sort())
      expect(item.options[item.right]).toBe(question.kind === 'mc' ? question.right : '')
      positions.add(item.right)
      orders.add(item.options.join('|'))
    }
    expect(positions.size).toBe(4)
    expect(orders.size).toBeGreaterThan(10)
    expect(itemFor(question, 5)).toEqual(itemFor(question, 5))
  })

  it('keeps true first on a true/false question', () => {
    for (const question of bank.filter((q) => q.kind === 'tf')) {
      const item = itemFor(question, 3)
      expect(item.options).toEqual(['True', 'False'])
      expect(item.options[item.right]).toBe(question.kind === 'tf' && question.answer ? 'True' : 'False')
    }
  })

  it('shuffles fairly and keeps everything', () => {
    const rng = mulberry32(3)
    const values = Array.from({ length: 10 }, (_, i) => i)
    const first = new Array<number>(10).fill(0)
    for (let i = 0; i < 4000; i++) first[shuffle(values, rng)[0]]++
    for (const count of first) expect(count).toBeGreaterThan(300)
    expect([...shuffle(values, rng)].sort((a, b) => a - b)).toEqual(values)
    expect(values).toEqual(Array.from({ length: 10 }, (_, i) => i))
  })

  it('rebuilds a saved exam exactly, and notices when the bank has changed', () => {
    const saved = plan(21)
    const items = itemsOf(saved, bank)
    expect(items).toHaveLength(EXAM.length + EXAM.maxExtra)
    expect(items).toEqual(itemsOf(JSON.parse(JSON.stringify(saved)), bank))
    expect(itemsOf({ ...saved, main: ['99-1', ...saved.main.slice(1)] }, bank)).toBeNull()
  })
})

describe('what is kept on the device', () => {
  const sample = () => planExam(bank, 4)

  it('starts empty, and takes whatever is stored with caution', () => {
    expect(cleanRecord(null)).toEqual(emptyRecord())
    expect(cleanRecord('nonsense')).toEqual(emptyRecord())
    expect(cleanRecord([1, 2])).toEqual(emptyRecord())
    expect(cleanRecord({ seen: 5, attempts: 'x', current: 7, certificate: [], name: 4 })).toEqual(emptyRecord())
  })

  it('remembers answers and the questions they were for', () => {
    const plan = sample()
    let record = begin(emptyRecord(), plan)
    record = recordAnswer(record, plan.main[0], 2)
    record = recordAnswer(record, plan.main[1], 0)
    expect(record.current?.answers).toEqual([2, 0])
    expect(record.seen).toEqual({ [plan.main[0]]: 1, [plan.main[1]]: 1 })
    expect(cleanRecord(JSON.parse(JSON.stringify(record)))).toEqual(record)
    // An answer with no exam in progress is ignored.
    expect(recordAnswer(emptyRecord(), 'x', 1)).toEqual(emptyRecord())
  })

  it('records a finished exam and clears the one in progress', () => {
    const plan = sample()
    const record = finish(recordAnswer(begin(emptyRecord(), plan), plan.main[0], 1), { correct: 30, asked: 40, passed: true }, '2026-10-04T12:00:00.000Z')
    expect(record.current).toBeNull()
    expect(record.attempts).toEqual([{ at: '2026-10-04T12:00:00.000Z', correct: 30, asked: 40, passed: true }])
    expect(abandon(begin(emptyRecord(), plan)).current).toBeNull()
  })

  it('keeps the last twenty exams', () => {
    let record = emptyRecord()
    for (let i = 0; i < 25; i++) record = finish(record, { correct: i, asked: 40, passed: false }, `2026-10-04T12:00:${String(i).padStart(2, '0')}.000Z`)
    expect(record.attempts).toHaveLength(20)
    expect(record.attempts[0].correct).toBe(5)
    expect(cleanRecord(JSON.parse(JSON.stringify(record))).attempts).toHaveLength(20)
  })

  it('drops an exam in progress that cannot be right, and keeps the rest', () => {
    const plan = sample()
    const good = recordAnswer(begin(emptyRecord(), plan), plan.main[0], 1)
    const stored = JSON.parse(JSON.stringify(good))
    stored.current.main = stored.current.main.slice(1)
    expect(cleanRecord(stored).current).toBeNull()
    expect(cleanRecord(stored).seen).toEqual(good.seen)
    const wild = JSON.parse(JSON.stringify(good))
    wild.current.answers = [9]
    expect(cleanRecord(wild).current).toBeNull()
    const long = JSON.parse(JSON.stringify(good))
    long.current.answers = new Array(60).fill(0)
    expect(cleanRecord(long).current).toBeNull()
  })

  it('keeps a certificate and a name, and limits the length of the name', () => {
    const record = withCertificate(emptyRecord(), { name: 'Sam Rivera', id: 'TOCF-ABCD-2345', at: '2026-10-04T12:00:00.000Z', correct: 34, asked: 40 })
    expect(record.name).toBe('Sam Rivera')
    expect(cleanRecord(JSON.parse(JSON.stringify(record)))).toEqual(record)
    expect(withName(emptyRecord(), 'x'.repeat(200)).name).toHaveLength(NAME_MAX)
    expect(cleanRecord({ certificate: { name: 'A', id: 'B', at: 'C', correct: 41, asked: 40 } }).certificate).toBeNull()
  })

  it('ignores stored attempts that make no sense', () => {
    const record = cleanRecord({
      attempts: [
        { at: 'a', correct: 3, asked: 2, passed: true },
        { at: 'b', correct: 2, asked: 40, passed: 'yes' },
        { at: 'c', correct: 28, asked: 40, passed: true },
        null,
      ],
    })
    expect(record.attempts).toEqual([{ at: 'c', correct: 28, asked: 40, passed: true }])
  })
})
