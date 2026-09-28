import { sample } from './distributions.ts'
import { EventQueue } from './eventQueue.ts'
import { onBreak, validateModel, type FactoryModel } from './model.ts'
import { stream } from './random.ts'

export type SimEvent =
  | { t: number; type: 'release'; job: number }
  | { t: number; type: 'start'; job: number; station: number; end: number }
  | { t: number; type: 'finish'; job: number; station: number }
  | { t: number; type: 'jam'; station: number; until: number }

export interface StationStats {
  id: string
  completed: number
  utilization: number
  avgQueue: number
  maxQueue: number
}

export interface SimResult {
  seed: number
  horizon: number
  events: SimEvent[]
  released: number
  output: number
  avgWip: number
  avgLeadTime: number | null
  stations: StationStats[]
}

type Pending =
  | { kind: 'release' }
  | { kind: 'finish'; station: number; job: number }
  | { kind: 'resume'; station: number }
  | { kind: 'jam'; station: number }

export function simulate(model: FactoryModel, seed: number): SimResult {
  const problems = validateModel(model)
  if (problems.length > 0) throw new Error(`Invalid factory model: ${problems.join('; ')}`)

  const { stations, release, horizon } = model
  const n = stations.length
  const cycleDraws = stations.map((s) => stream(seed, `cycle:${s.id}`))
  const jamDraws = stations.map((s) => stream(seed, `jam:${s.id}`))
  const releaseDraws = stream(seed, 'release')
  const constraint = release.kind === 'rope' ? stations.findIndex((s) => s.id === release.constraint) : -1

  const queues: number[][] = stations.map(() => [])
  const busy = stations.map(() => 0)
  const completed = stations.map(() => 0)
  const busyArea = stations.map(() => 0)
  const queueArea = stations.map(() => 0)
  const maxQueue = stations.map(() => 0)
  const jammedUntil = stations.map(() => 0)
  const releasedAt: number[] = []
  const events: SimEvent[] = []
  const agenda = new EventQueue<Pending>()
  let now = 0
  let wip = 0
  let wipArea = 0
  let leadTimeTotal = 0
  let aheadOfConstraint = 0

  const advance = (to: number) => {
    const dt = to - now
    for (let i = 0; i < n; i++) {
      busyArea[i] += busy[i] * dt
      queueArea[i] += queues[i].length * dt
    }
    wipArea += wip * dt
    now = to
  }

  const newJob = () => {
    const job = releasedAt.length
    releasedAt.push(now)
    wip++
    if (constraint >= 0) aheadOfConstraint++
    events.push({ t: now, type: 'release', job })
    return job
  }

  const tryStart = (i: number) => {
    const station = stations[i]
    if (onBreak(station, now) || now < jammedUntil[i]) return
    while (busy[i] < (station.servers ?? 1)) {
      let job = queues[i].shift()
      if (job === undefined) {
        if (i > 0 || release.kind !== 'saturate') return
        job = newJob()
      }
      busy[i]++
      const end = now + sample(station.cycleTime, cycleDraws[i]())
      events.push({ t: now, type: 'start', job, station: i, end })
      agenda.push(end, { kind: 'finish', station: i, job })
    }
  }

  const arrive = (i: number, job: number) => {
    queues[i].push(job)
    tryStart(i)
    maxQueue[i] = Math.max(maxQueue[i], queues[i].length)
  }

  const fillRope = () => {
    if (release.kind !== 'rope') return
    while (aheadOfConstraint < release.buffer) arrive(0, newJob())
  }

  // Jam times depend only on the seed, not on the flow, so a station jams at the same moments in every plan.
  const jam = (i: number) => {
    const { jams } = stations[i]
    if (!jams) return
    jammedUntil[i] = now + sample(jams.lasts, jamDraws[i]())
    events.push({ t: now, type: 'jam', station: i, until: jammedUntil[i] })
    agenda.push(jammedUntil[i], { kind: 'resume', station: i })
    agenda.push(jammedUntil[i] + sample(jams.every, jamDraws[i]()), { kind: 'jam', station: i })
  }

  const finish = (i: number, job: number) => {
    busy[i]--
    completed[i]++
    events.push({ t: now, type: 'finish', job, station: i })
    if (i + 1 < n) {
      arrive(i + 1, job)
    } else {
      wip--
      leadTimeTotal += now - releasedAt[job]
    }
    tryStart(i)
    if (i === constraint) {
      aheadOfConstraint--
      fillRope()
    }
  }

  stations.forEach((station, i) => {
    for (const b of station.breaks ?? []) agenda.push(b.to, { kind: 'resume', station: i })
    if (station.jams) agenda.push(sample(station.jams.every, jamDraws[i]()), { kind: 'jam', station: i })
  })
  if (release.kind === 'rope') fillRope()
  else if (release.kind === 'interval') agenda.push(0, { kind: 'release' })
  else tryStart(0)

  for (let next = agenda.peekTime(); next !== undefined && next <= horizon; next = agenda.peekTime()) {
    const { t, payload } = agenda.pop()!
    advance(t)
    if (payload.kind === 'finish') {
      finish(payload.station, payload.job)
    } else if (payload.kind === 'resume') {
      tryStart(payload.station)
    } else if (payload.kind === 'jam') {
      jam(payload.station)
    } else if (release.kind === 'interval') {
      arrive(0, newJob())
      agenda.push(now + sample(release.every, releaseDraws()), { kind: 'release' })
    }
  }
  advance(horizon)

  const shipped = completed[n - 1]
  return {
    seed,
    horizon,
    events,
    released: releasedAt.length,
    output: shipped,
    avgWip: wipArea / horizon,
    avgLeadTime: shipped > 0 ? leadTimeTotal / shipped : null,
    stations: stations.map((station, i) => ({
      id: station.id,
      completed: completed[i],
      utilization: busyArea[i] / ((station.servers ?? 1) * horizon),
      avgQueue: queueArea[i] / horizon,
      maxQueue: maxQueue[i],
    })),
  }
}

export function runBatch(model: FactoryModel, seeds: number[]): SimResult[] {
  return seeds.map((seed) => simulate(model, seed))
}
