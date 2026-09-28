// On a short screen, such as a laptop's, the factory floor and the controls below it don't fit at
// once, so starting a shift scrolls up to the floor, and a form the player needs scrolls into view.
const behavior = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth')

// Up to the factory floor, at the top of every play screen, to watch a shift that just started.
export function showFloor() {
  window.scrollTo({ top: 0, behavior: behavior() })
}

// An element into view with as little scrolling as possible, once the screen has redrawn.
export function reveal(element: HTMLElement | null | undefined) {
  requestAnimationFrame(() => element?.scrollIntoView({ behavior: behavior(), block: 'nearest' }))
}
