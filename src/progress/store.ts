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

const LEARNER_KEY = `${PREFIX}:learner`
const PLAYERS_KEY = `${PREFIX}:learners`

export function loadOrCreateLearner(storage: KeyValue | null = browserStorage()): Learner {
  try {
    const parsed = JSON.parse(storage?.getItem(LEARNER_KEY) ?? 'null') as Partial<Learner> | null
    if (typeof parsed?.id === 'string') return { id: parsed.id, nickname: parsed.nickname ?? null }
  } catch {
    // Fall through and create a fresh learner.
  }
  const learner: Learner = { id: randomId(), nickname: null }
  write(storage, LEARNER_KEY, learner)
  return learner
}

// Nicknames are free text (spec §8.3): no validation beyond trimming and a length cap.
export const NICKNAME_MAX = 24

export function cleanNickname(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, NICKNAME_MAX).trim()
}

// Everyone with a nickname who has played on this device, so a shared tablet can switch players.
export function devicePlayers(storage: KeyValue | null = browserStorage()): Learner[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(PLAYERS_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is Learner => typeof p?.id === 'string' && typeof p?.nickname === 'string')
  } catch {
    return []
  }
}

// Who plays next on this device. A nickname already played here picks up that player's progress.
// Otherwise the current learner takes the nickname if they have none yet, keeping their progress,
// or a new learner starts fresh. Nicknames never leave the device.
export function chooseLearner(current: Learner, nickname: string, storage: KeyValue | null = browserStorage()): Learner {
  const name = cleanNickname(nickname)
  if (!name) return current
  const players = devicePlayers(storage)
  const known = players.find((p) => p.nickname?.toLowerCase() === name.toLowerCase())
  const next = known ?? (current.nickname === null ? { ...current, nickname: name } : { id: randomId(), nickname: name })
  write(storage, LEARNER_KEY, next)
  write(storage, PLAYERS_KEY, [...players.filter((p) => p.id !== next.id), next])
  return next
}

function write(storage: KeyValue | null, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing or a full quota: this lasts for the session only.
  }
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
