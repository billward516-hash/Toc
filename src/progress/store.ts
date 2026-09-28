export type ProgressEvent =
  | { type: 'started'; levelId: string }
  | { type: 'answered'; levelId: string; answer: string; correct: boolean }
  | { type: 'ran'; levelId: string; choices: Record<string, string>; shipped: number; met: boolean; stars: number }
  | { type: 'predicted'; levelId: string; option: string; correct: boolean }
  | { type: 'completed'; levelId: string }

// Every stored event carries who and when, so a later server-side or instructor view can consume
// the same stream without a data-model change.
export type StoredEvent = ProgressEvent & { learnerId: string; at: string }

export interface ProgressStore {
  saveProgress(learnerId: string, event: ProgressEvent): Promise<StoredEvent>
  loadProgress(learnerId: string): Promise<StoredEvent[]>
}

export type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

const PREFIX = 'toc-factory'

export function localProgressStore(storage: KeyValue | null = browserStorage(), now = () => new Date()): ProgressStore {
  // Write-through cache: if storage writes fail, this session still sees its own progress.
  const cache = new Map<string, StoredEvent[]>()
  const key = (learnerId: string) => `${PREFIX}:progress:${learnerId}`

  const read = (learnerId: string): StoredEvent[] => {
    const cached = cache.get(learnerId)
    if (cached) return cached
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(key(learnerId)) ?? '[]')
      return Array.isArray(parsed) ? (parsed as StoredEvent[]) : []
    } catch {
      return []
    }
  }

  return {
    async saveProgress(learnerId, event) {
      const stored: StoredEvent = { ...event, learnerId, at: now().toISOString() }
      const events = [...read(learnerId), stored]
      cache.set(learnerId, events)
      try {
        storage?.setItem(key(learnerId), JSON.stringify(events))
      } catch {
        // Private browsing or a full quota: progress still lasts for this session.
      }
      return stored
    },
    async loadProgress(learnerId) {
      return read(learnerId)
    },
  }
}

export interface Learner {
  id: string
  nickname: string | null
}

export function loadOrCreateLearner(storage: KeyValue | null = browserStorage()): Learner {
  const key = `${PREFIX}:learner`
  try {
    const parsed = JSON.parse(storage?.getItem(key) ?? 'null') as Partial<Learner> | null
    if (typeof parsed?.id === 'string') return { id: parsed.id, nickname: parsed.nickname ?? null }
  } catch {
    // Fall through and create a fresh learner.
  }
  const learner: Learner = { id: randomId(), nickname: null }
  try {
    storage?.setItem(key, JSON.stringify(learner))
  } catch {
    // The learner lives for this session only.
  }
  return learner
}

export function completedLevels(events: readonly StoredEvent[]): Set<string> {
  return new Set(events.filter((e) => e.type === 'completed').map((e) => e.levelId))
}

export function bestStars(events: readonly StoredEvent[]): Map<string, number> {
  const best = new Map<string, number>()
  for (const event of events) {
    if (event.type === 'ran') best.set(event.levelId, Math.max(best.get(event.levelId) ?? 0, event.stars))
  }
  return best
}

function browserStorage(): KeyValue | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

// crypto.randomUUID needs a secure context; getRandomValues also works over plain http on a LAN.
function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
