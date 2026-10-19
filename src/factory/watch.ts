import type { Schedule } from './sim.ts'

// Where every order is at one moment of a run: waiting in front of a step, being worked on at a step (and
// on which tool), or shipped. Orders are numbered from 1 in the order they arrive.
export interface Placed {
  order: number
  // Hours since the order arrived.
  age: number
  tool: number
  // Good units the order asks for.
  units: number
}

export interface Frame {
  clock: number
  // For each step, the orders waiting for it (longest waiting first) and the orders being worked on.
  waiting: Placed[][]
  working: Placed[][]
  // Orders held back by the rope in front of its workgroup.
  held: Placed[]
  arrived: number
  shipped: number
  // Good units asked for by the orders arrived so far, and by those shipped.
  requested: number
  shippedUnits: number
  // Average hours from arrival to leaving the last step, over the orders shipped so far; null before any.
  cycle: number | null
}

export function frame(run: Schedule, t: number): Frame {
  const steps = run.ready.length
  const waiting: Placed[][] = Array.from({ length: steps }, () => [])
  const working: Placed[][] = Array.from({ length: steps }, () => [])
  const held: Placed[] = []
  let arrived = 0
  let requested = 0
  let shippedUnits = 0
  let shipped = 0
  let total = 0
  run.arrive.forEach((arrival, k) => {
    if (arrival > t) return
    arrived++
    requested += run.sizes[k]
    const last = run.done[steps - 1][k]
    if (last <= t) {
      shipped++
      shippedUnits += run.sizes[k]
      total += last - arrival
      return
    }
    for (let s = 0; s < steps; s++) {
      if (t < run.ready[s][k]) break
      if (s === run.ropeAt && t < run.ready[s][k] + run.held[k]) held.push({ order: k + 1, age: t - arrival, tool: 0, units: run.sizes[k] })
      else if (t < run.start[s][k]) waiting[s].push({ order: k + 1, age: t - arrival, tool: 0, units: run.sizes[k] })
      else if (t < run.done[s][k]) working[s].push({ order: k + 1, age: t - arrival, tool: run.tool[s][k], units: run.sizes[k] })
      else continue
      break
    }
  })
  return { clock: t, waiting, working, held, arrived, shipped, requested, shippedUnits, cycle: shipped > 0 ? total / shipped : null }
}

// When the last order of the run ships.
export const endOf = (run: Schedule): number => Math.max(...run.done[run.done.length - 1])
