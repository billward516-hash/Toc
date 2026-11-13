import { describe, expect, it } from 'vitest'
import '../rules.js'
import '../data/durham.js'
import '../data/salisbury.js'
import '../data/notredame.js'

const R = globalThis.CBRules
const cathedrals = globalThis.CATHEDRALS

describe('cathedral data', () => {
  it('has three cathedrals', () => {
    expect(cathedrals.map((c) => c.id)).toEqual(['durham', 'salisbury', 'notredame'])
  })

  for (const c of cathedrals) {
    describe(c.name, () => {
      for (const phase of c.phases) {
        it(`${phase.name}: about a dozen pieces and three decoys`, () => {
          expect(phase.pieces.length).toBe(12)
          expect(phase.decoys.length).toBe(3)
        })

        it('has unique ids and every piece lists supports that come earlier', () => {
          const ids = [...phase.pieces, ...phase.decoys].map((p) => p.id)
          expect(new Set(ids).size).toBe(ids.length)
          phase.pieces.forEach((p, i) => {
            for (const n of p.needs) expect(phase.pieces.findIndex((q) => q.id === n)).toBeLessThan(i)
          })
        })

        it('has a drawable shape and box for everything', () => {
          for (const p of [...phase.pieces, ...phase.decoys]) {
            expect(p.d).toMatch(/^M/)
            expect(p.box).toHaveLength(4)
            expect(p.name).toBeTruthy()
          }
          for (const d of phase.decoys) expect(d.reaction).toBeTruthy()
        })

        it('gives decoys the same footprint scale as a real piece (plausible)', () => {
          for (const d of phase.decoys) {
            const [, , w, h] = d.box
            const similar = phase.pieces.some((p) => Math.abs(p.box[2] - w) < 0.4 * w && Math.abs(p.box[3] - h) < 0.4 * h + 12)
            expect(similar, d.name).toBe(true)
          }
        })

        it('accepts the authored order, refuses decoys, wrong places and early pieces', () => {
          const placed = []
          for (const p of phase.pieces) {
            expect(R.nextPiece(phase, placed)).toBe(p)
            if (p.needs.length) {
              expect(R.canPlace(phase, [], p.id, p.id)).toMatchObject({ ok: false, reason: 'unsupported' })
            }
            const other = phase.pieces.find((q) => q.id !== p.id)
            expect(R.canPlace(phase, placed, p.id, other.id)).toMatchObject({ ok: false, reason: 'wrong-slot' })
            expect(R.canPlace(phase, placed, p.id, p.id).ok).toBe(true)
            placed.push(p.id)
          }
          expect(R.isComplete(phase, placed)).toBe(true)
          expect(R.nextPiece(phase, placed)).toBeNull()
          for (const d of phase.decoys) expect(R.canPlace(phase, placed, d.id, phase.pieces[0].id).reason).toBe('decoy')
        })

        it('has real ordering choices: some pieces are open at the same time', () => {
          const placed = []
          let widest = 0
          for (const p of phase.pieces) {
            widest = Math.max(widest, phase.pieces.filter((q) => !placed.includes(q.id) && q.needs.every((n) => placed.includes(n))).length)
            placed.push(p.id)
          }
          expect(widest).toBeGreaterThan(1)
        })
      }
    })
  }
})

describe('rules helpers', () => {
  const phase = cathedrals[0].phases[0]
  it('cleans a stale save', () => {
    expect(R.cleanPlaced(phase, ['pierL', 'baseL', 'nope'])).toEqual(['baseL', 'pierL'])
    expect(R.cleanPlaced(phase, 'junk')).toEqual([])
  })
  it('words hint counts, and says nothing when none were used', () => {
    expect(R.hintSummary({ requested: 0, accepted: 0, declined: 3 })).toBeNull()
    expect(R.hintSummary({ requested: 3, accepted: 1 })).toBe('Hints: 3 requested, 1 offered and accepted')
  })
})
