export type Dist =
  | { kind: 'fixed'; value: number }
  | { kind: 'uniform'; min: number; max: number }
  | { kind: 'triangular'; min: number; mode: number; max: number }

// Inverse-CDF sampling from one uniform draw: with the same draw, a faster setting gives a
// proportionally shorter time, which keeps same-seed comparisons fair. Only +, -, *, / and sqrt
// are used because they give bit-identical results in every browser.
export function sample(dist: Dist, u: number): number {
  switch (dist.kind) {
    case 'fixed':
      return dist.value
    case 'uniform':
      return dist.min + u * (dist.max - dist.min)
    case 'triangular': {
      const { min, mode, max } = dist
      const split = (mode - min) / (max - min)
      return u < split
        ? min + Math.sqrt(u * (max - min) * (mode - min))
        : max - Math.sqrt((1 - u) * (max - min) * (max - mode))
    }
  }
}

// Scaling keeps the same draw mapping to a proportionally shorter or longer time.
export function scale(dist: Dist, factor: number): Dist {
  switch (dist.kind) {
    case 'fixed':
      return { kind: 'fixed', value: dist.value * factor }
    case 'uniform':
      return { kind: 'uniform', min: dist.min * factor, max: dist.max * factor }
    case 'triangular':
      return { kind: 'triangular', min: dist.min * factor, mode: dist.mode * factor, max: dist.max * factor }
  }
}

// Standard work: the same average time with much less spread. Draws keep their order.
export function steadied(dist: Dist, spread = 0.1): Dist {
  const m = mean(dist)
  return { kind: 'uniform', min: m * (1 - spread), max: m * (1 + spread) }
}

export function mean(dist: Dist): number {
  switch (dist.kind) {
    case 'fixed':
      return dist.value
    case 'uniform':
      return (dist.min + dist.max) / 2
    case 'triangular':
      return (dist.min + dist.mode + dist.max) / 3
  }
}

// Times must be positive; a delay (`zero`) may also be exactly 0, such as a delivery that's on time.
export function problemWith(dist: Dist, { zero = false } = {}): string | null {
  const low = (value: number) => (zero ? value >= 0 : value > 0)
  const least = zero ? '0 <=' : '0 <'
  switch (dist.kind) {
    case 'fixed':
      return low(dist.value) ? null : zero ? 'fixed time must be at least 0' : 'fixed time must be positive'
    case 'uniform':
      return low(dist.min) && dist.min <= dist.max ? null : `uniform needs ${least} min <= max`
    case 'triangular':
      return low(dist.min) && dist.min <= dist.mode && dist.mode <= dist.max && dist.min < dist.max
        ? null
        : `triangular needs ${least} min <= mode <= max and min < max`
  }
}
