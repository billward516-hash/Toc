import { sample } from './distributions.ts'
import { EventQueue } from './eventQueue.ts'
import { canRun, lotSize, machinesOf, onBreak, productOf, timeFor, validateModel, type FactoryModel } from './model.ts'
import { stream } from './random.ts'

export type SimEvent =
  | { t: number; type: 'release'; job: number }
  // With a changeover, the machine starts working on the job at `ready`, not at `t`.
  | { t: number; type: 'start'; job: number; station: number; machine: number; end: number; ready?: number }
  | { t: number; type: 'finish'; job: number; station: number }
  // Finished units leaving a station's cart for the next station, when it moves work in batches.
  | { t: number; type: 'move'; station: number; jobs: number[] }
  | { t: number; type: 'jam'; station: number; until: number }

export interface StationStats {
  id: string
  // Present when the station moves finished work on in batches of this size.
  transfer?: number
  // Minutes spent changing over between products.
  changeoverTime: number
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
  // The product of each released unit, by job number, when the line makes several.
  products?: string[]
  output: number
  avgWip: number
  avgLeadTime: number | null
  stations: StationStats[]
}

type Pending =
  | { kind: 'release' }
  | { kind: 'finish'; station: number; machine: number; job: number }
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
  const changeoverDraws = stations.map((s) => stream(seed, `changeover:${s.id}`))
  const lot = lotSize(release)
  const constraint = release.kind === 'rope' ? stations.findIndex((s) => s.id === release.constraint) : -1
  const machines = stations.map(machinesOf)

  const queues: number[][] = stations.map(() => [])
  // The job each machine is working on, if any.
  const holding: (number | null)[][] = machines.map((ms) => ms.map(() => null))
  const products: string[] = []
  // The product each machine last ran, so switching costs a changeover.
  const lastProduct: (string | undefined)[][] = machines.map((ms) => ms.map(() => undefined))
  // Finished units waiting to move on together.
  const carts: number[][] = stations.map(() => [])
  const changeoverTime = stations.map(() => 0)
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
    const product = productOf(model, job)
    if (product !== undefined) products.push(product)
    wip++
    if (constraint >= 0) aheadOfConstraint++
    events.push({ t: now, type: 'release', job })
    return job
  }

  // Each free machine, in order, takes the oldest waiting job it can run. With saturate release the
  // first station never waits: it starts new work whenever a machine is free.
  const tryStart = (i: number) => {
    const station = stations[i]
    if (onBreak(station, now) || now < jammedUntil[i]) return
    machines[i].forEach((machine, m) => {
      if (holding[i][m] !== null) return
      const k = queues[i].findIndex((waiting) => canRun(machine, productOf(model, waiting)))
      let job: number
      if (k >= 0) [job] = queues[i].splice(k, 1)
      else if (i === 0 && release.kind === 'saturate') job = newJob()
      else return
      holding[i][m] = job
      busy[i]++
      const product = productOf(model, job)
      const switching = station.changeover && lastProduct[i][m] !== undefined && lastProduct[i][m] !== product
      const ready = switching ? now + sample(station.changeover!, changeoverDraws[i]()) : now
      if (switching) changeoverTime[i] += Math.min(ready, horizon) - now
      lastProduct[i][m] = product
      const end = ready + sample(timeFor(station, machine, product), cycleDraws[i]())
      events.push({ t: now, type: 'start', job, station: i, machine: m, end, ...(switching ? { ready } : {}) })
      agenda.push(end, { kind: 'finish', station: i, machine: m, job })
    })
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

  const finish = (i: number, m: number, job: number) => {
    holding[i][m] = null
    busy[i]--
    completed[i]++
    events.push({ t: now, type: 'finish', job, station: i })
    const transfer = stations[i].transfer ?? 1
    if (i + 1 < n && transfer > 1) {
      // The cart leaves when it's full, or when the last unit of a multi-unit lot is done.
      carts[i].push(job)
      if (carts[i].length >= transfer || (lot > 1 && (job + 1) % lot === 0)) {
        const jobs = carts[i]
        carts[i] = []
        events.push({ t: now, type: 'move', station: i, jobs })
        for (const moving of jobs) arrive(i + 1, moving)
      }
    } else if (i + 1 < n) {
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
      finish(payload.station, payload.machine, payload.job)
    } else if (payload.kind === 'resume') {
      tryStart(payload.station)
    } else if (payload.kind === 'jam') {
      jam(payload.station)
    } else if (release.kind === 'interval') {
      for (let k = 0; k < lot; k++) arrive(0, newJob())
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
    ...(model.mix ? { products } : {}),
    output: shipped,
    avgWip: wipArea / horizon,
    avgLeadTime: shipped > 0 ? leadTimeTotal / shipped : null,
    stations: stations.map((station, i) => ({
      id: station.id,
      ...((station.transfer ?? 1) > 1 && i + 1 < n ? { transfer: station.transfer } : {}),
      changeoverTime: changeoverTime[i],
      completed: completed[i],
      utilization: busyArea[i] / (machines[i].length * horizon),
      avgQueue: queueArea[i] / horizon,
      maxQueue: maxQueue[i],
    })),
  }
}

export function runBatch(model: FactoryModel, seeds: number[]): SimResult[] {
  return seeds.map((seed) => simulate(model, seed))
}
