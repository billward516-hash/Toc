import { describe, expect, it } from 'vitest'
import { simulate } from '../engine/simulate.ts'
import { maxStars, starsFor } from '../levels/graph.ts'
import { allPlans, applyLevers, planCost, overBudget } from '../levels/levers.ts'
import { levels, tierNames } from '../levels/index.ts'
import { principleNames } from '../levels/principles.ts'
import type { Level } from '../levels/types.ts'
import { answerLines } from './answers.ts'
import { levelFiller } from './facts.ts'
import { glossary } from './glossary.ts'
import { scriptMarkdown } from './markdown.ts'
import { levelNumber } from './numbering.ts'
import { branches, formats, overview } from './overview.ts'
import { clockAt, resolveSession } from './resolve.ts'
import { sessions } from './sessions/index.ts'
import { courseNumbers, fillCourse, formatMinutes, isPlay, segmentFor, sessionMinutes } from './summary.ts'
import { tierInfo, tierInfoFor } from './tiers.ts'
import type { PlaySegment, Step } from './types.ts'

const stepText = (steps: Step[]) => steps.flatMap((step) => (step.note ? [step.text, step.note] : [step.text]))

// Every piece of text a play segment shows, for checking numbers and words.
const playTexts = (segment: PlaySegment) => [segment.idea, ...stepText(segment.setup), ...segment.watch, ...segment.mistakes, ...stepText(segment.debrief)]

const playSegments = sessions.flatMap((session) => session.segments.filter(isPlay))
const levelOf = (segment: PlaySegment): Level => levels.find((level) => level.id === segment.levelId)!

describe('the course covers the game', () => {
  it('has a session for every tier, in order', () => {
    const tiers = [...new Set(levels.map((level) => level.tier))].sort((a, b) => a - b)
    expect(sessions.map((session) => session.tier)).toEqual(tiers)
    expect(tierInfo.map((info) => info.tier)).toEqual(tiers)
    for (const tier of tiers) expect(tierNames[tier], `tier ${tier}`).toBeDefined()
  })

  it('plays every level exactly once, in the level order, in the session for its tier', () => {
    for (const session of sessions) {
      const played = session.segments.filter(isPlay).map((segment) => segment.levelId)
      expect(played, `tier ${session.tier}`).toEqual(levels.filter((level) => level.tier === session.tier).map((level) => level.id))
    }
    expect(playSegments).toHaveLength(levels.length)
  })

  it('gives every session an opening, a close, and words for saving time', () => {
    for (const session of sessions) {
      const talks = session.segments.filter((segment) => segment.kind === 'talk')
      expect(talks.length, `tier ${session.tier}`).toBeGreaterThanOrEqual(2)
      expect(session.segments.at(-1)?.kind, `tier ${session.tier}`).toBe('talk')
      expect(session.short.length, `tier ${session.tier}`).toBeGreaterThan(0)
      expect(session.extend.length, `tier ${session.tier}`).toBeGreaterThan(0)
      expect(session.before.length, `tier ${session.tier}`).toBeGreaterThan(0)
    }
  })

  it('runs each session for a sensible time, with time for the play inside each level', () => {
    for (const session of sessions) {
      const { core } = sessionMinutes(session)
      expect(core, `tier ${session.tier}`).toBeGreaterThanOrEqual(40)
      expect(core, `tier ${session.tier}`).toBeLessThanOrEqual(110)
    }
    for (const segment of playSegments) {
      expect(segment.play, segment.levelId).toBeGreaterThan(0)
      expect(segment.minutes, segment.levelId).toBeGreaterThan(segment.play + 4)
    }
  })

  it('tells learners what each tier will teach and asks them to reflect, in the same words as the trainer closes with', () => {
    for (const info of tierInfo) {
      expect(info.objectives.length, `tier ${info.tier}`).toBeGreaterThanOrEqual(3)
      expect(info.reflect.length, `tier ${info.tier}`).toBeGreaterThan(0)
      const close = sessions.find((s) => s.tier === info.tier)!.segments.at(-1)!
      const said = close.kind === 'talk' ? stepText(close.steps).join(' ') : ''
      expect(said, `tier ${info.tier}`).toContain(info.reflect[0])
      expect(said, `tier ${info.tier}`).toContain(info.bridge)
    }
    expect(() => tierInfoFor(99)).toThrow()
  })
})

describe('the script quotes the game, not a memory of it', () => {
  it('fills in every number it quotes, for the level it is about', () => {
    for (const segment of playSegments) {
      const fill = levelFiller(levelOf(segment), segment.answer)
      for (const text of playTexts(segment)) {
        expect(fill(text), `${segment.levelId}: ${text}`).not.toMatch(/[{}]/)
      }
    }
  })

  it('keeps braces out of the talks and the overview, other than the course numbers', () => {
    for (const session of sessions) {
      for (const segment of session.segments) {
        if (segment.kind === 'talk') for (const text of stepText(segment.steps)) expect(text).not.toMatch(/[{}]/)
      }
      for (const text of [...session.before, ...session.short, ...session.extend, session.summary]) expect(text).not.toMatch(/[{}]/)
    }
    const words = overview.flatMap((section) =>
      section.blocks.flatMap((block) => (block.kind === 'p' ? [block.text] : block.kind === 'list' ? block.items : stepText(block.steps))),
    )
    for (const text of words) expect(fillCourse(text), text).not.toMatch(/[{}]/)
    expect(courseNumbers().levels).toBe(String(levels.length))
  })

  it("quotes the right numbers: the answer plan's shipped count and the untouched factory's", () => {
    const fill = levelFiller(levels.find((l) => l.id === 'tier1-one-upgrade')!, { tool: 'assemble' })
    expect(fill('{baseline} to {shipped}, target {target}, gain {gain}')).toBe('117 to 147, target 140, gain 30')
    const dice = levelFiller(levels.find((l) => l.id === 'tier2-dice')!)
    expect(dice('{first} then {second}, {gap} fewer')).toBe('116 then 102, 14 fewer')
  })
})

// The plan the script calls the answer must be the one that earns every star, on days it has not seen.
describe.each(playSegments.filter((segment) => levelOf(segment).goal.kind !== 'identifyBottleneck' && levelOf(segment).goal.kind !== 'predict'))(
  'the answer to $levelId',
  (segment) => {
    const level = levelOf(segment)
    const { goal, levers } = level
    const plan = segment.answer

    it('is a complete plan the level accepts', () => {
      expect(plan, 'a planning level needs an answer').toBeDefined()
      expect(Object.keys(plan!).sort()).toEqual(levers.map((lever) => lever.id).sort())
      expect(allPlans(levers).some((p) => levers.every((lever) => p[lever.id] === plan![lever.id]))).toBe(true)
      expect(overBudget(levers, plan!, goal.kind === 'elevate' ? goal.budget : undefined)).toBe(0)
    })

    it('earns every star, week after week', () => {
      const baseline = simulate(level.model, level.seed)
      const fresh = 'freshDays' in goal ? goal.freshDays : 0
      const planned = applyLevers(level.model, levers, plan!)
      for (let week = 0; week < 5; week++) {
        const days = Array.from({ length: fresh }, (_, d) => simulate(planned, 2000 + week * fresh + d))
        const stars = starsFor(goal, simulate(planned, level.seed), days, { spend: planCost(levers, plan!), baseline: baseline.output })
        expect(stars, `week ${week}`).toBe(maxStars(level))
      }
    })

    it('reads out as one line for every choice', () => {
      expect(answerLines(level, plan)).toHaveLength(levers.length)
    })
  },
)

describe('answer keys for the other levels', () => {
  it('name the station and the prediction the level is looking for', () => {
    const pileup = levels.find((l) => l.id === 'tier0-pileup')!
    expect(answerLines(pileup)).toEqual(['The constraint is Paint.'])
    const dice = levels.find((l) => l.id === 'tier2-dice')!
    expect(answerLines(dice)).toEqual(['The right prediction: Fewer than 116'])
    expect(segmentFor(pileup)?.levelId).toBe('tier0-pileup')
  })
})

describe('the levels have numbers, and the trainer can find them', () => {
  it('numbers levels by tier and place, as the class screen does', () => {
    expect(levelNumber(levels[0])).toBe('0.1')
    expect(levelNumber(levels.find((l) => l.id === 'tier3-read')!)).toBe('3.3')
    expect(new Set(levels.map(levelNumber)).size).toBe(levels.length)
  })
})

describe('the glossary', () => {
  it('has each term once, in a tier the game has, with a meaning', () => {
    const terms = glossary.map((entry) => entry.term.toLowerCase())
    expect(new Set(terms).size).toBe(terms.length)
    const tiers = new Set(levels.map((l) => l.tier))
    for (const entry of glossary) {
      expect(tiers.has(entry.tier), entry.term).toBe(true)
      expect(entry.meaning.length, entry.term).toBeGreaterThan(20)
    }
  })

  it('brings up something new in most tiers', () => {
    const covered = new Set(glossary.map((entry) => entry.tier))
    expect([...covered].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('ways to run the course', () => {
  it('give sensible lengths', () => {
    const minutes = Object.fromEntries(formats.map((format) => [format.name, formatMinutes(format)]))
    expect(minutes.Taster).toBeGreaterThanOrEqual(45)
    expect(minutes.Taster).toBeLessThanOrEqual(100)
    expect(minutes.Foundations).toBeGreaterThan(minutes.Taster)
    expect(minutes['The full course']).toBeGreaterThan(minutes.Foundations)
    expect(minutes['The full course']).toBe(sessions.reduce((sum, session) => sum + sessionMinutes(session).core, 0))
  })

  it('point at levels and tiers that exist', () => {
    for (const format of formats) {
      for (const id of format.levels ?? []) expect(levels.some((l) => l.id === id), id).toBe(true)
      for (const tier of format.sessions ?? []) expect(sessions.some((s) => s.tier === tier), String(tier)).toBe(true)
    }
    expect(branches.length).toBeGreaterThan(0)
  })
})

describe('principles', () => {
  it('appear in the script by the words the game uses', () => {
    // The trainer names each principle in the game's own words, so learners meet the same words again.
    const spoken = sessions
      .flatMap((session) => session.segments.flatMap((segment) => (segment.kind === 'talk' ? stepText(segment.steps) : playTexts(segment))))
      .join(' ')
      .toLowerCase()
    const named = [1, 4, 5, 16, 17, 18, 28, 31, 32, 33, 37, 40, 41, 42].map((p) => principleNames[p])
    // At least a few of the game's own principle sentences are quoted, or nearly.
    const quoted = named.filter((sentence) => spoken.includes(sentence.toLowerCase().replace(/[.,]/g, '').split(' ').slice(0, 4).join(' ')))
    expect(quoted.length).toBeGreaterThanOrEqual(6)
  })
})

describe('the session as the trainer reads it', () => {
  it('has the numbers filled in and a clock that adds up', () => {
    for (const session of sessions) {
      const resolved = resolveSession(session)
      expect(resolved.segments).toHaveLength(session.segments.length)
      const clocked = resolved.starts.filter((start): start is number => start !== null)
      expect(clocked[0]).toBe(0)
      expect([...clocked].sort((a, b) => a - b)).toEqual(clocked)
      for (const segment of resolved.segments) {
        if (segment.kind !== 'play') continue
        const all = [segment.idea, ...segment.watch, ...segment.mistakes, ...stepText(segment.setup), ...stepText(segment.debrief), ...segment.answer]
        for (const text of all) expect(text, `${segment.number}: ${text}`).not.toMatch(/[{}]/)
        // Every level has the steps that are the same for all: sending the class to it, and the tally or plans table.
        expect(stepText(segment.setup)[0]).toContain(`${segment.number} ${segment.title}`)
        expect(segment.answer.length, segment.number).toBeGreaterThan(0)
        expect(segment.debrief.length, segment.number).toBeGreaterThanOrEqual(3)
      }
    }
    expect(clockAt(0)).toBe('0:00')
    expect(clockAt(65)).toBe('1:05')
  })

  it('reads the class screen the way the game shows it', () => {
    const pileup = resolveSession(sessions[0]).segments.find((s) => s.kind === 'play')
    const rope = resolveSession(sessions[3]).segments.find((s) => s.kind === 'play')
    expect(pileup?.kind === 'play' && pileup.answers).toBe('pick')
    expect(rope?.kind === 'play' && rope.answers).toBe('plans')
  })
})

describe('the printable script', () => {
  const text = scriptMarkdown()

  it('has every session, every level, and its answer', () => {
    for (const session of sessions) expect(text).toContain(`## Session ${session.tier}: ${tierNames[session.tier]}`)
    for (const level of levels) expect(text).toContain(`#### ${levelNumber(level)} ${level.title}`)
    expect(text).toContain('The constraint is Paint.')
    expect(text).toContain('Tie the rope to: Paint')
  })

  it('has no numbers left unfilled, and says the words rather than showing the markup', () => {
    expect(text).not.toMatch(/[{}]/)
    expect(text).toContain('**Say:** "')
    expect(text).toContain('## Start here'.replace('Start here', 'What this course is'))
  })
})
