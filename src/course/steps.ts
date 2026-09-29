import type { Step } from './types.ts'

// Short ways to write the steps of a script.
export const say = (text: string, note?: string): Step => ({ kind: 'say', text, note })
export const ask = (text: string, note?: string): Step => ({ kind: 'ask', text, note })
export const act = (text: string, note?: string): Step => ({ kind: 'do', text, note })
export const look = (text: string, note?: string): Step => ({ kind: 'look', text, note })
export const tip = (text: string, note?: string): Step => ({ kind: 'tip', text, note })
