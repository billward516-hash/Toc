import { describe, expect, it } from 'vitest'
import { mean, problemWith, sample, type Dist } from './distributions.ts'

const uniform: Dist = { kind: 'uniform', min: 2, max: 6 }
const triangular: Dist = { kind: 'triangular', min: 2, mode: 3, max: 6 }

describe('sample', () => {
  it('maps uniform draws linearly', () => {
    expect(sample(uniform, 0)).toBe(2)
    expect(sample(uniform, 0.5)).toBe(4)
  })

  it('reaches the triangular mode at the split point', () => {
    expect(sample(triangular, 0)).toBe(2)
    expect(sample(triangular, 0.25)).toBeCloseTo(3)
    expect(sample(triangular, 1)).toBeCloseTo(6)
  })

  it('matches the analytic mean', () => {
    for (const dist of [uniform, triangular, { kind: 'fixed', value: 4 } as const]) {
      const steps = 20000
      let total = 0
      for (let k = 0; k < steps; k++) total += sample(dist, (k + 0.5) / steps)
      expect(total / steps).toBeCloseTo(mean(dist), 3)
    }
  })

  it('maps the same draw to a shorter time on a faster setting', () => {
    const faster: Dist = { kind: 'triangular', min: 1, mode: 2, max: 4 }
    for (const u of [0.01, 0.2, 0.5, 0.8, 0.99]) {
      expect(sample(faster, u)).toBeLessThan(sample(triangular, u))
    }
  })
})

describe('problemWith', () => {
  it('accepts well-formed distributions', () => {
    expect(problemWith(uniform)).toBeNull()
    expect(problemWith(triangular)).toBeNull()
  })

  it('rejects zero or inverted times', () => {
    expect(problemWith({ kind: 'fixed', value: 0 })).not.toBeNull()
    expect(problemWith({ kind: 'uniform', min: 5, max: 2 })).not.toBeNull()
    expect(problemWith({ kind: 'triangular', min: 2, mode: 7, max: 6 })).not.toBeNull()
  })
})
