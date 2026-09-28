import type { FactoryModel } from '../engine/model.ts'
import type { Snapshot } from '../engine/timeline.ts'

// Text can quote the learner's own run: {shipped}, {made:<station>}, {waiting:<station>},
// {scrapped:<station>}, plus any named value passed in, such as {baseline} or {target}. Numbers of a
// thousand or more get commas.
export function fillTemplate(text: string, model: FactoryModel, snapshot: Snapshot, values: Record<string, number> = {}): string {
  return text.replace(/\{(\w+)(?::([\w-]+))?\}/g, (token, name: string, id?: string) => {
    if (id === undefined) {
      if (name === 'shipped') return String(snapshot.shipped)
      return name in values ? number(values[name]) : token
    }
    const i = model.stations.findIndex((s) => s.id === id)
    if (i < 0) return token
    if (name === 'made') return String(snapshot.completed[i])
    if (name === 'waiting') return String(snapshot.queues[i])
    if (name === 'scrapped') return String(snapshot.scrapped[i])
    return token
  })
}

function number(value: number): string {
  return Math.abs(value) >= 1000 ? value.toLocaleString('en-US') : String(value)
}
