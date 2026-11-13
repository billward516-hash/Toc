import { describe, expect, it } from 'vitest'
import '../rules.js'
import '../data/shapes.js'
import '../data/durham.js'
import '../data/salisbury.js'
import '../data/notredame.js'

const R = globalThis.CBRules
const cathedrals = globalThis.CATHEDRALS

describe('cathedral data', () => {
  it('has three cathedrals with two phases each', () => {
    expect(cathedrals.map((c) => c.id)).toEqual(['durham', 'salisbury', 'notredame'])
    for (const c of cathedrals) expect(c.phases.length).toBe(2)
  })

  for (const c of cathedrals) {
    describe(c.name, () => {
      it('uses each id once across all phases, pieces and decoys', () => {
        const ids = c.phases.flatMap((p) => [...p.pieces, ...p.decoys].map((q) => q.id))
        expect(new Set(ids).size).toBe(ids.length)
      })

      c.phases.forEach((phase, idx) => {
        const prior = c.phases.slice(0, idx).flatMap((p) => p.pieces.map((q) => q.id))

        describe(phase.name, () => {
          it('is complex: many pieces, and decoys that are about half the tray', () => {
            expect(phase.pieces.length).toBeGreaterThanOrEqual(9)
            expect(phase.decoys.length).toBeGreaterThanOrEqual(7)
            expect(phase.decoys.length / (phase.pieces.length + phase.decoys.length)).toBeGreaterThan(0.3)
          })

          it('is hard: no boxes marking the open places, and later phases have no silhouette or labels', () => {
            expect(phase.slotStyle).toBe('none')
            if (idx > 0) {
              expect(phase.silhouette).toBe(false)
              expect(phase.labels).toBe(false)
            }
          })

          it('lists supports that exist earlier, in this phase or a previous one', () => {
            phase.pieces.forEach((p, i) => {
              for (const n of p.needs) {
                const inPhase = phase.pieces.findIndex((q) => q.id === n)
                expect(inPhase >= 0 ? inPhase < i : prior.includes(n), `${p.id} needs ${n}`).toBe(true)
              }
            })
          })

          it('has a drawable shape and box for everything', () => {
            for (const p of [...phase.pieces, ...phase.decoys]) {
              expect(p.d).toMatch(/^M/)
              expect(p.d).not.toContain('NaN')
              expect(p.box).toHaveLength(4)
              expect(p.name).toBeTruthy()
            }
            for (const d of phase.decoys) expect(d.reaction).toBeTruthy()
          })

          it('has decoys that look like real pieces (same footprint scale)', () => {
            for (const d of phase.decoys) {
              const [, , w, h] = d.box
              const similar = phase.pieces.some((p) => Math.abs(p.box[2] - w) < 0.45 * Math.max(w, p.box[2]) + 6 && Math.abs(p.box[3] - h) < 0.45 * Math.max(h, p.box[3]) + 8)
              expect(similar, d.name).toBe(true)
            }
          })

          it('accepts the authored order, refuses decoys, wrong places and early pieces', () => {
            const placed = [...prior]
            for (const p of phase.pieces) {
              expect(R.nextPiece(phase, placed)).toBe(p)
              if (p.needs.some((n) => !prior.includes(n))) {
                expect(R.canPlace(phase, prior, p.id, p.id)).toMatchObject({ ok: false, reason: 'unsupported' })
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

          it('has real ordering choices: several pieces open at the same time', () => {
            const placed = [...prior]
            let widest = 0
            for (const p of phase.pieces) {
              widest = Math.max(widest, phase.pieces.filter((q) => !placed.includes(q.id) && q.needs.every((n) => placed.includes(n))).length)
              placed.push(p.id)
            }
            expect(widest).toBeGreaterThan(1)
          })
        })
      })
    })
  }
})

describe('rules helpers', () => {
  const phase = cathedrals[0].phases[0]
  it('cleans a stale save', () => {
    expect(R.cleanPlaced(phase, ['pierL', 'baseL', 'nope'])).toEqual(['baseL', 'pierL'])
    expect(R.cleanPlaced(phase, 'junk')).toEqual([])
  })
  it('treats earlier phases as in place when cleaning a save', () => {
    const tower = cathedrals[0].phases[1]
    const prior = phase.pieces.map((p) => p.id)
    expect(R.cleanPlaced(tower, ['towerLow'], prior)).toEqual(['towerLow'])
    expect(R.cleanPlaced(tower, ['towerLow'], [])).toEqual([])
  })
  it('words hint counts, and says nothing when none were used', () => {
    expect(R.hintSummary({ requested: 0, accepted: 0, declined: 3 })).toBeNull()
    expect(R.hintSummary({ requested: 3, accepted: 1 })).toBe('Hints: 3 requested, 1 offered and accepted')
  })
})
