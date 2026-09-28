import { sample } from './distributions.ts'
import { EventQueue } from './eventQueue.ts'
import { canRun, lotSize, machinesOf, onBreak, timeFor, validateModel, type FactoryModel, type Machine } from './model.ts'
import { stream } from './random.ts'

export type SimEvent =
  // Rush orders come on top of the normal flow.
  | { t: number; type: 'release'; job: number; rush?: true }
  // With a changeover, the machine starts working on the job at `ready`, not at `t`.
  | { t: number; type: 'start'; job: number; station: number; machine: number; end: number; ready?: number }
  // A scrapped unit leaves the line here instead of moving on.
  | { t: number; type: 'finish'; job: number; station: number; scrap?: true }
  // Finished units leaving a station's cart for the next station, when it moves work in batches.
  | { t: number; type: 'move'; station: number; jobs: number[] }
  // A stop until `until`: a jam, or a long breakdown.
  | { t: number; type: 'jam'; station: number; until: number; outage?: true }
  // Direct materials reaching the stockroom.
  | { t: number; type: 'delivery'; amount: number; due: number }

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
  // Units shipped of each product, when the line makes several.
  shippedBy?: Record<string, number>
  // Materials in the stockroom at the start and on average, when the line uses them.
  supply?: { onHand: number; avgStock: number }
  // Units scrapped at inspection, and defective units shipped all the same, when the line makes defects.
  scrapped?: number
  escaped?: number
  // Job numbers of rush orders, when there are any.
  rush?: number[]
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
  | { kind: 'outage'; station: number; until: number }
  | { kind: 'delivery'; amount: number; due: number }
  | { kind: 'rush'; count: number; product?: string }

export function simulate(model: FactoryModel, seed: number): SimResult {
  const problems = validateModel(model)
  if (problems.length > 0) throw new Error(`Invalid factory model: ${problems.join('; ')}`)

  const { stations, release, horizon } = model
  const n = stations.length
  const cycleDraws = stations.map((s) => stream(seed, `cycle:${s.id}`))
  const jamDraws = stations.map((s) => stream(seed, `jam:${s.id}`))
  const releaseDraws = stream(seed, 'release')
  const changeoverDraws = stations.map((s) => stream(seed, `changeover:${s.id}`))
  const outageDraws = stations.map((s) => stream(seed, `outage:${s.id}`))
  const defectDraws = stations.map((s) => stream(seed, `defect:${s.id}`))
  const supplyDraws = stream(seed, 'supply')
  const incidentDraws = stream(seed, 'incident')
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
  let shipped = 0
  const defective: boolean[] = []
  let scrapped = 0
  let escaped = 0
  const rushJobs: number[] = []
  const isRush: boolean[] = []
  const { supply } = model
  let stock = supply ? supply.onHand : Infinity
  let stockArea = 0
  // The order pattern in force, and how many normal orders came before it took over.
  const mixChanges = [...(model.mixChanges ?? [])].sort((a, b) => a.at - b.at)
  let mix = model.mix
  let mixFrom = 0
  let normal = 0
  let nextChange = 0
  const priorityChanges = stations.map((s) => [...(s.priorityChanges ?? [])].sort((a, b) => a.at - b.at))

  const advance = (to: number) => {
    const dt = to - now
    for (let i = 0; i < n; i++) {
      busyArea[i] += busy[i] * dt
      queueArea[i] += queues[i].length * dt
    }
    wipArea += wip * dt
    if (supply) stockArea += stock * dt
    now = to
  }

  // A rush order has its own product, or else the next one in the pattern without taking its turn.
  const newJob = (rush?: { product?: string }) => {
    const job = releasedAt.length
    releasedAt.push(now)
    while (nextChange < mixChanges.length && mixChanges[nextChange].at <= now) {
      mix = mixChanges[nextChange++].mix
      mixFrom = normal
    }
    const product = rush?.product ?? mix?.[(normal - mixFrom) % mix.length]
    if (!rush) normal++
    if (product !== undefined) products.push(product)
    wip++
    if (constraint >= 0) aheadOfConstraint++
    if (rush) {
      isRush[job] = true
      rushJobs.push(job)
    }
    events.push({ t: now, type: 'release', job, ...(rush ? { rush: true as const } : {}) })
    return job
  }

  const priorityAt = (i: number): string[] => {
    let order = stations[i].priority ?? []
    for (const change of priorityChanges[i]) if (change.at <= now) order = change.order
    return order
  }

  // The waiting job a machine takes next: a rush order where the station expedites, then the oldest
  // it can run of the station's first-priority product, then more of the product it last ran where
  // the station keeps products together, then the oldest it can run.
  const pick = (i: number, m: number, machine: Machine): number => {
    const runnable = (job: number) => canRun(machine, products[job])
    if (stations[i].expedite) {
      const k = queues[i].findIndex((job) => isRush[job] && runnable(job))
      if (k >= 0) return k
    }
    for (const product of priorityAt(i)) {
      const k = queues[i].findIndex((job) => products[job] === product && runnable(job))
      if (k >= 0) return k
    }
    if (stations[i].keepProduct && lastProduct[i][m] !== undefined) {
      const k = queues[i].findIndex((job) => products[job] === lastProduct[i][m] && runnable(job))
      if (k >= 0) return k
    }
    return queues[i].findIndex(runnable)
  }

  // Each free machine, in order, takes its pick of the waiting jobs. With saturate release the
  // first station never waits: it starts new work whenever a machine is free.
  const tryStart = (i: number) => {
    const station = stations[i]
    if (onBreak(station, now) || now < jammedUntil[i]) return
    machines[i].forEach((machine, m) => {
      if (holding[i][m] !== null) return
      // The first station needs material from the stockroom for every job it starts.
      if (i === 0 && stock <= 0) return
      const k = pick(i, m, machine)
      let job: number
      if (k >= 0) [job] = queues[i].splice(k, 1)
      else if (i === 0 && release.kind === 'saturate') job = newJob()
      else return
      if (i === 0 && supply) stock--
      holding[i][m] = job
      busy[i]++
      const product = products[job]
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
    jammedUntil[i] = Math.max(jammedUntil[i], now + sample(jams.lasts, jamDraws[i]()))
    events.push({ t: now, type: 'jam', station: i, until: jammedUntil[i] })
    agenda.push(jammedUntil[i], { kind: 'resume', station: i })
    agenda.push(jammedUntil[i] + sample(jams.every, jamDraws[i]()), { kind: 'jam', station: i })
  }

  const breakDown = (i: number, until: number) => {
    jammedUntil[i] = Math.max(jammedUntil[i], until)
    events.push({ t: now, type: 'jam', station: i, until: jammedUntil[i], outage: true })
    agenda.push(jammedUntil[i], { kind: 'resume', station: i })
  }

  const finish = (i: number, m: number, job: number) => {
    holding[i][m] = null
    busy[i]--
    completed[i]++
    const station = stations[i]
    if (station.defects && defectDraws[i]() < station.defects) defective[job] = true
    const scrap = station.inspects === true && defective[job] === true
    events.push({ t: now, type: 'finish', job, station: i, ...(scrap ? { scrap: true as const } : {}) })
    const transfer = station.transfer ?? 1
    if (scrap) {
      wip--
      scrapped++
    } else if (i + 1 < n && transfer > 1) {
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
      shipped++
      if (defective[job]) escaped++
      leadTimeTotal += now - releasedAt[job]
    }
    tryStart(i)
    // The rope counts work until the constraint finishes it, or until it's scrapped before getting there.
    if (i === constraint || (scrap && i < constraint)) {
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
  // Breakdowns and late deliveries depend only on the seed, like jams.
  stations.forEach((station, i) => {
    for (const outage of station.outages ?? []) {
      const at = sample(outage.at, outageDraws[i]())
      agenda.push(at, { kind: 'outage', station: i, until: at + sample(outage.lasts, outageDraws[i]()) })
    }
  })
  for (const incident of model.incidents ?? []) {
    const at = sample(incident.at, incidentDraws())
    for (const outage of incident.outages) {
      const i = stations.findIndex((st) => st.id === outage.station)
      agenda.push(at, { kind: 'outage', station: i, until: at + sample(outage.lasts, incidentDraws()) })
    }
  }
  for (const delivery of supply?.deliveries ?? []) {
    const at = delivery.due + (delivery.late ? sample(delivery.late, supplyDraws()) : 0)
    agenda.push(at, { kind: 'delivery', amount: delivery.amount, due: delivery.due })
  }
  for (const rush of model.rush ?? []) agenda.push(rush.at, { kind: 'rush', count: rush.count, product: rush.product })

  for (let next = agenda.peekTime(); next !== undefined && next <= horizon; next = agenda.peekTime()) {
    const { t, payload } = agenda.pop()!
    advance(t)
    if (payload.kind === 'finish') {
      finish(payload.station, payload.machine, payload.job)
    } else if (payload.kind === 'resume') {
      tryStart(payload.station)
    } else if (payload.kind === 'jam') {
      jam(payload.station)
    } else if (payload.kind === 'outage') {
      breakDown(payload.station, payload.until)
    } else if (payload.kind === 'delivery') {
      stock += payload.amount
      events.push({ t: now, type: 'delivery', amount: payload.amount, due: payload.due })
      tryStart(0)
    } else if (payload.kind === 'rush') {
      for (let k = 0; k < payload.count; k++) arrive(0, newJob({ product: payload.product }))
    } else if (release.kind === 'interval') {
      for (let k = 0; k < lot; k++) arrive(0, newJob())
      agenda.push(now + sample(release.every, releaseDraws()), { kind: 'release' })
    }
  }
  advance(horizon)

  const shippedBy: Record<string, number> = {}
  for (const event of events) {
    if (event.type === 'finish' && event.station === n - 1 && !event.scrap && model.mix) {
      const product = products[event.job]
      shippedBy[product] = (shippedBy[product] ?? 0) + 1
    }
  }
  const makesDefects = stations.some((s) => s.defects !== undefined || s.inspects)
  return {
    seed,
    horizon,
    events,
    released: releasedAt.length,
    ...(model.mix ? { products, shippedBy } : {}),
    ...(supply ? { supply: { onHand: supply.onHand, avgStock: stockArea / horizon } } : {}),
    ...(makesDefects ? { scrapped, escaped } : {}),
    ...(rushJobs.length > 0 ? { rush: rushJobs } : {}),
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
