// "My factory": a line of workgroups that a lot, an order, or a batch of units moves through in turn,
// described by the person using it. The numbers here are examples. A person's real numbers are typed
// into the screen and kept only on their device (see progress/store.ts); none belong in the code.

export interface Step {
  name: string
  // Tools in the workgroup.
  tools: number
  // Units an hour one tool makes when it runs full loads.
  rate: number
  // Units a tool takes in one run (1 when it works on one at a time). A run takes the same time however
  // full it is, so a part-full run wastes some of the tool's time.
  load: number
  // Whether the workgroup can be divided, one tool to an order. Otherwise the whole fleet is dedicated to
  // one order at a time, which keeps orders from mixing.
  divided: boolean
}

export type Variation = 'low' | 'medium' | 'high'

export interface Factory {
  steps: Step[]
  // Good units wanted a day (24 hours). Always kept per day; `perWeek` only changes how it is shown and typed.
  demand: number
  // Whether demand and capacity are shown and typed per week, and the days in the person's week (1 to 7).
  perWeek: boolean
  weekDays: number
  // Units in an order, or the batch that moves together: from the smallest to the largest.
  sizeMin: number
  sizeMax: number
  // Share of started units that come out good, 1 to 100.
  yieldPct: number
  // How much times and arrivals vary around their averages.
  variation: Variation
  // The cycle time wanted, in hours, from an order's arrival to its leaving the last step.
  target: number
}

export const LIMITS = {
  steps: { min: 1, max: 12 },
  tools: { min: 1, max: 200, step: 1 },
  rate: { min: 0.1, max: 100000, step: 1 },
  load: { min: 1, max: 100000, step: 1 },
  demand: { min: 1, max: 10000000, step: 10 },
  size: { min: 1, max: 1000000, step: 10 },
  yieldPct: { min: 1, max: 100, step: 1 },
  target: { min: 0.1, max: 100000, step: 1 },
  weekDays: { min: 1, max: 7, step: 1 },
}

// How much a time swings from order to order around its average (a share of it, either way), and how
// unevenly orders arrive.
export const SPREAD: Record<Variation, { service: number; arrival: number }> = {
  low: { service: 0.15, arrival: 0.3 },
  medium: { service: 0.4, arrival: 0.6 },
  high: { service: 0.75, arrival: 0.9 },
}

// A made-up factory to start from: five workgroups, orders of 100 to 400 units.
export const EXAMPLE: Factory = {
  steps: [
    { name: 'Prepare', tools: 3, rate: 40, load: 20, divided: false },
    { name: 'Process', tools: 4, rate: 25, load: 25, divided: false },
    { name: 'Inspect', tools: 2, rate: 60, load: 10, divided: true },
    { name: 'Finish', tools: 3, rate: 35, load: 1, divided: false },
  ],
  demand: 1500,
  perWeek: false,
  weekDays: 7,
  sizeMin: 100,
  sizeMax: 400,
  yieldPct: 90,
  variation: 'medium',
  target: 24,
}

export const NEW_STEP: Step = { name: 'New step', tools: 2, rate: 30, load: 1, divided: false }

// How many days a shown amount covers, and what to call it.
export const periodDays = (f: Factory): number => (f.perWeek ? f.weekDays : 1)
export const periodName = (f: Factory): string => (f.perWeek ? 'week' : 'day')

export const meanSize = (f: Factory): number => (f.sizeMin + f.sizeMax) / 2

const inRange = (value: unknown, { min, max }: { min: number; max: number }): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

function cleanStep(value: unknown): Step | null {
  if (typeof value !== 'object' || value === null) return null
  const { name, tools, rate, load, divided } = value as Record<string, unknown>
  if (typeof name !== 'string' || name.length > 40 || typeof divided !== 'boolean') return null
  if (!inRange(tools, LIMITS.tools) || !Number.isInteger(tools) || !inRange(rate, LIMITS.rate) || !inRange(load, LIMITS.load) || !Number.isInteger(load)) return null
  return { name, tools, rate, load, divided }
}

// A factory kept on the device, checked field by field: anything unexpected gives null, and the person
// starts again from the example.
export function cleanFactory(value: unknown): Factory | null {
  if (typeof value !== 'object' || value === null) return null
  const { steps, demand, sizeMin, sizeMax, yieldPct, variation, target } = value as Record<string, unknown>
  if (!Array.isArray(steps) || steps.length < LIMITS.steps.min || steps.length > LIMITS.steps.max) return null
  const clean = steps.map(cleanStep)
  if (!clean.every((step) => step !== null)) return null
  if (!inRange(demand, LIMITS.demand) || !inRange(sizeMin, LIMITS.size) || !inRange(sizeMax, LIMITS.size) || sizeMax < sizeMin) return null
  if (!inRange(yieldPct, LIMITS.yieldPct) || !inRange(target, LIMITS.target)) return null
  if (variation !== 'low' && variation !== 'medium' && variation !== 'high') return null
  // Saved before the week view existed: shown per day.
  const { perWeek, weekDays } = value as Record<string, unknown>
  const week = inRange(weekDays, LIMITS.weekDays) && Number.isInteger(weekDays) ? weekDays : 7
  return { steps: clean, demand, perWeek: perWeek === true, weekDays: week, sizeMin, sizeMax, yieldPct, variation, target }
}
