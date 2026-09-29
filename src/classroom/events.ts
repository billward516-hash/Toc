import { bestStars, completedLevels, type StoredEvent } from '../progress/store.ts'
import type { ClassEvent } from './room.ts'

// The results a class sees: each answer, prediction, and run. Opening and finishing levels reach the
// instructor as the student's progress instead.
export function toClassEvent(event: StoredEvent): ClassEvent | null {
  const at = Date.parse(event.at)
  if (!Number.isFinite(at)) return null
  const { levelId } = event
  switch (event.type) {
    case 'answered':
      return { type: 'answered', levelId, at, answer: event.answer, correct: event.correct }
    case 'predicted':
      return { type: 'predicted', levelId, at, option: event.option, correct: event.correct }
    case 'ran':
      return { type: 'ran', levelId, at, choices: event.choices, shipped: event.shipped, met: event.met, stars: event.stars }
    default:
      return null
  }
}

// The same result always gets the same key, so sending it again after a dropped connection never
// makes a copy.
export const eventKey = (event: ClassEvent) => `${event.at}_${event.type}`

// The results to send to a class: everything since the student joined, by key.
export function eventsSince(events: readonly StoredEvent[], since: number): Record<string, ClassEvent> {
  const sent: Record<string, ClassEvent> = {}
  for (const stored of events) {
    const event = toClassEvent(stored)
    if (event && event.at >= since) sent[eventKey(event)] = event
  }
  return sent
}

// Every level the student has finished, with the best stars each earned (0 where a level gives none).
export function progressSummary(events: readonly StoredEvent[]): Record<string, number> {
  const stars = bestStars(events)
  return Object.fromEntries([...completedLevels(events)].map((id) => [id, stars.get(id) ?? 0]))
}

// A class result in the shape of the student's own history, for the level logic written for that.
export function asStored(event: ClassEvent, learnerId: string): StoredEvent {
  const at = new Date(event.at).toISOString()
  switch (event.type) {
    case 'answered':
      return { type: 'answered', levelId: event.levelId, answer: event.answer, correct: event.correct, learnerId, at }
    case 'predicted':
      return { type: 'predicted', levelId: event.levelId, option: event.option, correct: event.correct, learnerId, at }
    case 'ran':
      return { type: 'ran', levelId: event.levelId, choices: event.choices, shipped: event.shipped, met: event.met, stars: event.stars, learnerId, at }
  }
}
