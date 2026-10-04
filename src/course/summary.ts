import { EXAM } from '../exam/config.ts'
import { correctToPass } from '../exam/rules.ts'
import { levels } from '../levels/index.ts'
import type { Level } from '../levels/types.ts'
import { sessions } from './sessions/index.ts'
import type { PlaySegment, Segment, Session, Step } from './types.ts'

export const isPlay = (segment: Segment): segment is PlaySegment => segment.kind === 'play'

// The minutes a session runs, without its optional parts, and the optional minutes on top.
export function sessionMinutes(session: Session): { core: number; optional: number } {
  let core = 0
  let optional = 0
  for (const segment of session.segments) {
    if (segment.kind === 'talk' && segment.optional) optional += segment.minutes
    else core += segment.minutes
  }
  return { core, optional }
}

export const sessionFor = (tier: number): Session | undefined => sessions.find((session) => session.tier === tier)

// The play segment for a level.
export function segmentFor(level: Level): PlaySegment | undefined {
  for (const session of sessions) {
    for (const segment of session.segments) if (isPlay(segment) && segment.levelId === level.id) return segment
  }
  return undefined
}

// A way to run the course: whole sessions, or some levels picked out of them.
export interface Format {
  name: string
  who: string
  sessions?: number[]
  // Levels picked out of the sessions, with the minutes for a welcome and close on top.
  levels?: string[]
  extra?: number
}

export function formatMinutes(format: Format): number {
  const whole = (format.sessions ?? []).reduce((sum, tier) => sum + (sessionFor(tier) ? sessionMinutes(sessionFor(tier)!).core : 0), 0)
  const picked = (format.levels ?? []).reduce((sum, id) => {
    const level = levels.find((l) => l.id === id)
    const segment = level && segmentFor(level)
    return sum + (segment?.minutes ?? 0)
  }, 0)
  return whole + picked + (format.extra ?? 0)
}

// "1 hour 30 minutes", "about 13 hours".
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return hours === 1 ? '1 hour' : `${hours} hours`
  if (minutes >= 240) return `about ${Math.round(minutes / 30) / 2} hours`
  return `${hours} hour${hours === 1 ? '' : 's'} ${rest} minutes`
}

// The numbers the overview quotes, so its text always matches the game.
export function courseNumbers(): Record<string, string> {
  const total = sessions.reduce((sum, session) => sum + sessionMinutes(session).core, 0)
  return {
    levels: String(levels.length),
    sessions: String(sessions.length),
    tiers: String(new Set(levels.map((l) => l.tier)).size),
    hours: duration(total),
    // The exam, so the guides never disagree with it.
    examQuestions: String(EXAM.length),
    examBank: String(EXAM.bank),
    examPass: String(EXAM.passPercent),
    examToPass: String(correctToPass()),
    examExtra: String(EXAM.maxExtra),
  }
}

export const fillCourse = (text: string): string => {
  const numbers = courseNumbers()
  return text.replace(/\{(\w+)\}/g, (token, name: string) => numbers[name] ?? token)
}

// A step of the overview, with the course's numbers filled in.
export const fillStep = (step: Step): Step => ({ ...step, text: fillCourse(step.text), ...(step.note ? { note: fillCourse(step.note) } : {}) })
