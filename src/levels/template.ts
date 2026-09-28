import type { FactoryModel } from '../engine/model.ts'
import type { Snapshot } from '../engine/timeline.ts'

// Pop-up text can quote the learner's own run: {shipped}, {made:<station>}, {waiting:<station>}.
export function fillTemplate(text: string, model: FactoryModel, snapshot: Snapshot): string {
  return text.replace(/\{(shipped|made|waiting)(?::([\w-]+))?\}/g, (token, what: string, id?: string) => {
    if (what === 'shipped') return String(snapshot.shipped)
    const i = model.stations.findIndex((s) => s.id === id)
    if (i < 0) return token
    return String(what === 'made' ? snapshot.completed[i] : snapshot.queues[i])
  })
}
