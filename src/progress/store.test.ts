import { describe, expect, it } from 'vitest'
import { completedLevels, loadOrCreateLearner, localProgressStore, type KeyValue } from './store.ts'

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

describe('loadOrCreateLearner', () => {
  it('creates a learner once and returns the same one afterwards', () => {
    const storage = memory()
    const first = loadOrCreateLearner(storage)
    expect(first.id).toMatch(/^[0-9a-f]{32}$/)
    expect(first.nickname).toBeNull()
    expect(loadOrCreateLearner(storage)).toEqual(first)
  })
})
