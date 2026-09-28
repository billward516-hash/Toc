import type { FactoryModel } from '../engine/model.ts'
import type { Snapshot } from '../engine/timeline.ts'

// Text can quote the learner's own run: {shipped}, {made:<station>}, {waiting:<station>},
// plus any named value passed in, such as {baseline} or {target}.
export function fillTemplate(text: string, model: FactoryModel, snapshot: Snapshot, values: Record<string, number> = {}): string {
  return text.replace(/\{(\w+)(?::([\w-]+))?\}/g, (token, name: string, id?: string) => {
    if (id === undefined) {
      if (name === 'shipped') return String(snapshot.shipped)
      return name in values ? String(values[name]) : token
    }
    const i = model.stations.findIndex((s) => s.id === id)
    if (i < 0 || (name !== 'made' && name !== 'waiting')) return token
    return String(name === 'made' ? snapshot.completed[i] : snapshot.queues[i])
  })
}
