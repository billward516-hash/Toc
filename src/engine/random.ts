export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One independent stream per random source, so changing one station never shifts the draws of another.
export function stream(seed: number, name: string): Rng {
  let hash = (0x811c9dc5 ^ seed) >>> 0
  for (let i = 0; i < name.length; i++) {
    hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193) >>> 0
  }
  return mulberry32(hash)
}
