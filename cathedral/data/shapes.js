// Small helpers for authoring piece shapes. Pure functions; no DOM.
{
const f = (n) => Math.round(n * 10) / 10
const pts = (list) => list.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('')
const quad = (p0, c, p1, t) => {
  const m = 1 - t
  return [m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1]]
}
// A curve made of quadratic pieces, as a function of u in [0, 1].
const chain = (quads) => (u) => {
  const n = quads.length
  const k = Math.min(n - 1, Math.floor(u * n))
  return quad(...quads[k], u * n - k)
}
// A half circle from the left foot (u = 0) over the top to the right foot (u = 1).
const halfCircle = (cx, cy, r) => (u) => {
  const a = Math.PI * (1 - u)
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)]
}
// The stone cut from the band between curves a and b over u0..u1: its path and bounding box.
function band(a, b, u0, u1, steps = 8) {
  const up = []
  const down = []
  for (let i = 0; i <= steps; i++) {
    const u = u0 + ((u1 - u0) * i) / steps
    up.push(a(u))
    down.push(b(u))
  }
  const all = [...up, ...down]
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { d: pts([...up, ...down.reverse()]) + 'Z', box: [f(x), f(y), f(Math.max(...xs) - x), f(Math.max(...ys) - y)] }
}
// Arch stones from the left foot to the right: springer, stone, keystone, stone, springer.
const CUTS = [0, 0.28, 0.44, 0.56, 0.72, 1]
const archStones = (a, b) => CUTS.slice(0, -1).map((u0, i) => band(a, b, u0, CUTS[i + 1]))

globalThis.CBShapes = { pts, quad, chain, halfCircle, band, archStones }
}
