import { describe, expect, it } from 'vitest'
import { mulberry32, stream } from './random.ts'

const take = (rng: () => number, count: number) => Array.from({ length: count }, () => rng())

describe('mulberry32', () => {
  it('repeats exactly for the same seed', () => {
    expect(take(mulberry32(42), 5)).toEqual(take(mulberry32(42), 5))
  })

  it('stays in [0, 1) and averages about one half', () => {
    const draws = take(mulberry32(7), 20000)
    expect(draws.every((u) => u >= 0 && u < 1)).toBe(true)
    expect(draws.reduce((a, b) => a + b, 0) / draws.length).toBeCloseTo(0.5, 1)
  })
})

describe('stream', () => {
  it('is reproducible for a seed and name', () => {
    expect(take(stream(3, 'cycle:paint'), 5)).toEqual(take(stream(3, 'cycle:paint'), 5))
  })

  it('gives each source its own draws', () => {
    expect(take(stream(3, 'cycle:paint'), 5)).not.toEqual(take(stream(3, 'cycle:cut'), 5))
  })

  it('changes with the seed', () => {
    expect(take(stream(3, 'cycle:paint'), 5)).not.toEqual(take(stream(4, 'cycle:paint'), 5))
  })
})
