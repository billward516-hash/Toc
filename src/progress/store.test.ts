import { describe, expect, it } from 'vitest'
import { bestStars, chooseLearner, cleanNickname, completedLevels, devicePlayers, loadOrCreateLearner, loadPreferences, localProgressStore, savePreferences, type KeyValue } from './store.ts'

const memory = (): KeyValue & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  }
}

const clock = () => new Date('2026-09-28T01:00:00Z')

describe('localProgressStore', () => {
  it('stamps each event with the learner and time', async () => {
    const store = localProgressStore(memory(), clock)
    const saved = await store.saveProgress('learner-1', { type: 'started', levelId: 'tier0-pileup' })
    expect(saved).toEqual({ type: 'started', levelId: 'tier0-pileup', learnerId: 'learner-1', at: '2026-09-28T01:00:00.000Z' })
    expect(await store.loadProgress('learner-1')).toEqual([saved])
  })

  it('keeps learners apart and survives a reload', async () => {
    const storage = memory()
    const first = localProgressStore(storage, clock)
    await first.saveProgress('ana', { type: 'completed', levelId: 'a' })
    await first.saveProgress('ben', { type: 'completed', levelId: 'b' })
    const reloaded = localProgressStore(storage, clock)
    expect((await reloaded.loadProgress('ana')).map((e) => e.levelId)).toEqual(['a'])
    expect((await reloaded.loadProgress('ben')).map((e) => e.levelId)).toEqual(['b'])
  })

  it('keeps working for the session when storage refuses writes', async () => {
    const refusing: KeyValue = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    const store = localProgressStore(refusing, clock)
    await store.saveProgress('ana', { type: 'completed', levelId: 'a' })
    expect(await store.loadProgress('ana')).toHaveLength(1)
  })

  it('treats corrupted storage as empty', async () => {
    const storage = memory()
    storage.data.set('toc-factory:progress:ana', '{not json')
    expect(await localProgressStore(storage, clock).loadProgress('ana')).toEqual([])
  })
})

describe('completedLevels', () => {
  it('collects the levels with a completed event', async () => {
    const store = localProgressStore(memory(), clock)
    await store.saveProgress('ana', { type: 'started', levelId: 'a' })
    await store.saveProgress('ana', { type: 'answered', levelId: 'a', answer: 'paint', correct: true })
    await store.saveProgress('ana', { type: 'completed', levelId: 'a' })
    await store.saveProgress('ana', { type: 'started', levelId: 'b' })
    expect(completedLevels(await store.loadProgress('ana'))).toEqual(new Set(['a']))
  })
})

describe('bestStars', () => {
  it('keeps the best result for each level', async () => {
    const store = localProgressStore(memory(), clock)
    const ran = (levelId: string, stars: number) =>
      store.saveProgress('ana', { type: 'ran', levelId, choices: {}, shipped: 100, met: stars > 0, stars })
    await ran('a', 0)
    await ran('a', 1)
    await ran('a', 0)
    await ran('b', 0)
    expect(bestStars(await store.loadProgress('ana'))).toEqual(new Map([['a', 1], ['b', 0]]))
  })
})

describe('loadOrCreateLearner', () => {
  it('creates a learner once and returns the same one afterwards', () => {
    const storage = memory()
    const first = loadOrCreateLearner(storage)
    expect(first.id).toMatch(/^[0-9a-f]{32}$/)
    expect(first.nickname).toBeNull()
    expect(loadOrCreateLearner(storage)).toEqual(first)
  })
})

describe('nicknames', () => {
  it('trims and caps a nickname, and nothing else', () => {
    expect(cleanNickname('  Sam   the  Great ')).toBe('Sam the Great')
    expect(cleanNickname('x'.repeat(40))).toHaveLength(24)
    expect(cleanNickname('   ')).toBe('')
  })

  it('gives the first nickname to the learner already playing, keeping their progress', () => {
    const storage = memory()
    const learner = loadOrCreateLearner(storage)
    const named = chooseLearner(learner, 'Sam', storage)
    expect(named).toEqual({ id: learner.id, nickname: 'Sam' })
    expect(loadOrCreateLearner(storage)).toEqual(named)
    expect(devicePlayers(storage)).toEqual([named])
  })

  it('starts a new nickname fresh, and picks up a known one where it left off', () => {
    const storage = memory()
    const sam = chooseLearner(loadOrCreateLearner(storage), 'Sam', storage)
    const alex = chooseLearner(sam, 'Alex', storage)
    expect(alex.id).not.toBe(sam.id)
    expect(chooseLearner(alex, ' sam ', storage)).toEqual(sam)
    expect(loadOrCreateLearner(storage)).toEqual(sam)
    expect(devicePlayers(storage).map((p) => p.nickname)).toEqual(['Alex', 'Sam'])
  })

  it('ignores a blank nickname and unreadable player lists', () => {
    const storage = memory()
    const learner = loadOrCreateLearner(storage)
    expect(chooseLearner(learner, '  ', storage)).toBe(learner)
    storage.data.set('toc-factory:learners', '{oops')
    expect(devicePlayers(storage)).toEqual([])
  })
})

describe('preferences', () => {
  it('keeps each player their own settings, and starts from none', () => {
    const storage = memory()
    expect(loadPreferences('sam', storage)).toEqual({ pauseAtProblems: false, brief: false })
    savePreferences('sam', { pauseAtProblems: true, brief: true }, storage)
    expect(loadPreferences('sam', storage)).toEqual({ pauseAtProblems: true, brief: true })
    expect(loadPreferences('alex', storage)).toEqual({ pauseAtProblems: false, brief: false })
  })

  it('reads damaged settings as none', () => {
    const storage = memory()
    storage.data.set('toc-factory:prefs:sam', '{oops')
    expect(loadPreferences('sam', storage)).toEqual({ pauseAtProblems: false, brief: false })
  })
})
