import { describe, expect, it } from 'vitest'
import { EventQueue } from './eventQueue.ts'
import { mulberry32 } from './random.ts'

const drain = <P>(queue: EventQueue<P>) => {
  const out: { t: number; payload: P }[] = []
  for (let next = queue.pop(); next; next = queue.pop()) out.push(next)
  return out
}

describe('EventQueue', () => {
  it('pops in time order', () => {
    const queue = new EventQueue<string>()
    for (const [t, name] of [[5, 'e'], [1, 'a'], [3, 'c'], [2, 'b'], [4, 'd']] as const) queue.push(t, name)
    expect(drain(queue).map((e) => e.payload)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('keeps scheduling order for simultaneous events', () => {
    const queue = new EventQueue<number>()
    for (let i = 0; i < 10; i++) queue.push(1, i)
    expect(drain(queue).map((e) => e.payload)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('agrees with a sorted reference under interleaved pushes and pops', () => {
    const rng = mulberry32(99)
    const queue = new EventQueue<number>()
    const reference: { t: number; id: number }[] = []
    let id = 0
    for (let step = 0; step < 2000; step++) {
      if (reference.length === 0 || rng() < 0.6) {
        const t = Math.floor(rng() * 50)
        queue.push(t, id)
        reference.push({ t, id: id++ })
        reference.sort((a, b) => a.t - b.t || a.id - b.id)
      } else {
        expect(queue.pop()?.payload).toBe(reference.shift()?.id)
      }
    }
    expect(queue.size).toBe(reference.length)
  })
})
