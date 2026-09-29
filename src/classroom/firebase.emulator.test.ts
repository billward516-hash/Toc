import { deleteApp, getApp } from 'firebase/app'
import { endAt, get, getDatabase, goOffline, goOnline, orderByKey, query, ref, set } from 'firebase/database'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NoSuchClass, type ClassBackend, type Unsubscribe } from './backend.ts'
import { EMULATOR_SETTINGS } from './config.ts'
import { firebaseBackend } from './firebase.ts'
import type { ClassEvent, ClassMeta, ClassRoom } from './room.ts'

// These run against Firebase's emulators, rules and all: `npm run test:class`. Plain `npm test` skips them.
const emulator: string | undefined = import.meta.env.VITE_FIREBASE_EMULATOR

// The first value a watcher reports that passes the check.
function until<T>(watch: (onChange: (value: T) => void, onError: (error: Error) => void) => Unsubscribe, check: (value: T) => boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    let stop: Unsubscribe = () => undefined
    const timer = setTimeout(() => {
      stop()
      reject(new Error('Timed out waiting for the database'))
    }, 8000)
    const finish = (settle: () => void) => {
      clearTimeout(timer)
      stop()
      settle()
    }
    stop = watch(
      (value) => {
        if (check(value)) finish(() => resolve(value))
      },
      (error) => finish(() => reject(error)),
    )
  })
}

const answered = (at: number, answer: string, correct: boolean): ClassEvent => ({ type: 'answered', levelId: 'tier0-pileup', at, answer, correct })

describe.runIf(emulator)('classes on Firebase, against the emulators', { timeout: 20000 }, () => {
  const run = Date.now().toString(36)
  const names = ['host', 'amy', 'ben', 'guest'].map((who) => `${who}-${run}`)
  let host: ClassBackend
  let amy: ClassBackend
  let ben: ClassBackend
  let guest: ClassBackend
  // The raw database, as each device's rules see it.
  const raw = (who: number) => getDatabase(getApp(names[who]))
  let code: string
  const room = (check: (room: ClassRoom | null) => boolean) => until<ClassRoom | null>((f, e) => host.watchClass(code, f, e), check)
  const player = (name: string) => (r: ClassRoom | null) => r?.players.find((p) => p.name === name)

  beforeAll(() => {
    ;[host, amy, ben, guest] = names.map((name) => firebaseBackend(EMULATOR_SETTINGS, emulator!, name))
  })

  afterAll(async () => {
    await Promise.all(names.map((name) => deleteApp(getApp(name))))
  })

  it('opens a class with a six-digit code, for its host to watch', async () => {
    code = await host.createClass()
    expect(code).toMatch(/^\d{6}$/)
    const opened = await room((r) => r !== null)
    expect(opened).toMatchObject({ code, players: [], meta: { focus: null } })
    expect(opened!.createdAt).toBeGreaterThan(0)
  })

  it("won't let a student join a class that isn't open", async () => {
    const missing = code === '000000' ? '000001' : '000000'
    await expect(amy.join(missing, { name: 'Amy', progress: {} })).rejects.toBeInstanceOf(NoSuchClass)
  })

  it('shows students to the host as they join, with their progress, online', async () => {
    await amy.join(code, { name: 'Amy', progress: { 'tier0-pileup': 0, 'tier1-one-upgrade': 1 } })
    await ben.join(code, { name: 'Ben', progress: {} })
    const joined = await room((r) => r?.players.length === 2)
    expect(joined!.players.map((p) => [p.name, p.online])).toEqual([
      ['Amy', true],
      ['Ben', true],
    ])
    expect(joined!.players[0].progress).toEqual({ 'tier0-pileup': 0, 'tier1-one-upgrade': 1 })
    expect(await until<boolean>((f, e) => amy.watchMembership(code, f, e), (member) => member)).toBe(true)
  })

  it('passes on results once each, however often they are sent', async () => {
    const results = { '100_answered': answered(100, 'cut', false), '200_answered': answered(200, 'paint', true) }
    await amy.sendResults(code, results)
    await amy.sendResults(code, results)
    await amy.sendNow(code, 'tier0-pileup')
    await amy.sendProgress(code, { 'tier0-pileup': 0, 'tier1-one-upgrade': 1, 'tier2-dice': 0 })
    const sent = await room((r) => player('Amy')(r)?.events.length === 2 && player('Amy')(r)?.now === 'tier0-pileup')
    expect(player('Amy')(sent)?.events).toEqual([answered(100, 'cut', false), answered(200, 'paint', true)])
    expect(Object.keys(player('Amy')(sent)!.progress)).toHaveLength(3)
    await amy.sendNow(code, null)
    await room((r) => player('Amy')(r)?.now === null)
  })

  it("keeps each student's entry to themselves and the host", async () => {
    const [, amyDb] = [raw(0), raw(1)]
    const benId = player('Ben')(await room((r) => r !== null))!.id
    await expect(get(ref(amyDb, `classes/${code}`))).rejects.toThrow(/permission/i)
    await expect(get(ref(amyDb, `classes/${code}/players/${benId}`))).rejects.toThrow(/permission/i)
    await expect(set(ref(amyDb, `classes/${code}/players/${benId}/name`), 'Not Ben')).rejects.toThrow(/permission/i)
    await expect(set(ref(amyDb, `classes/${code}/meta/focus`), 'tier3-read')).rejects.toThrow(/permission/i)
    await expect(set(ref(amyDb, `classes/${code}/host`), 'me')).rejects.toThrow(/permission/i)
    await expect(get(ref(amyDb, 'opened'))).rejects.toThrow(/permission/i)
  })

  it('refuses malformed entries', async () => {
    const amyDb = raw(1)
    const amyId = player('Amy')(await room((r) => r !== null))!.id
    const mine = `classes/${code}/players/${amyId}`
    await expect(set(ref(amyDb, `${mine}/events/1_hacked`), { type: 'hacked', levelId: 'x', at: 1 })).rejects.toThrow(/permission/i)
    await expect(set(ref(amyDb, `${mine}/name`), 'A name far too long for any nickname box')).rejects.toThrow(/permission/i)
    await expect(set(ref(amyDb, `${mine}/secret`), 'x')).rejects.toThrow(/permission/i)
    await expect(set(ref(amyDb, `${mine}/progress/tier0-pileup`), 99)).rejects.toThrow(/permission/i)
  })

  it('sends everyone to a level, and lets them go again', async () => {
    await host.setFocus(code, 'tier1-one-upgrade')
    const sent = await until<ClassMeta | null>((f, e) => ben.watchMeta(code, f, e), (meta) => meta?.focus === 'tier1-one-upgrade')
    expect(sent!.focusAt).toBeGreaterThan(0)
    await host.setFocus(code, null)
    await until<ClassMeta | null>((f, e) => ben.watchMeta(code, f, e), (meta) => meta !== null && meta.focus === null)
  })

  it('shows a student offline when their connection drops, and online again when it comes back', async () => {
    let reconnects = 0
    const stop = amy.stayOnline(code, () => reconnects++)
    await until(
      (f) => {
        const timer = setInterval(() => f(reconnects), 50)
        return () => clearInterval(timer)
      },
      (n: number) => n === 1,
    )
    goOffline(raw(1))
    await room((r) => player('Amy')(r)?.online === false)
    goOnline(raw(1))
    await room((r) => player('Amy')(r)?.online === true)
    stop()
  })

  it("removes a student, who then can't write to the class", async () => {
    const benId = player('Ben')(await room((r) => r !== null))!.id
    await host.removePlayer(code, benId)
    await until<boolean>((f, e) => ben.watchMembership(code, f, e), (member) => !member)
    await expect(ben.sendResults(code, { '300_answered': answered(300, 'box', false) })).rejects.toThrow(/permission/i)
    await expect(ben.sendProgress(code, { 'tier0-pileup': 0 })).rejects.toThrow(/permission/i)
    const after = await room((r) => r !== null)
    expect(after!.players.map((p) => p.name)).toEqual(['Amy'])
  })

  it('lets a student leave, taking their entry with them', async () => {
    await amy.leave(code)
    await room((r) => r?.players.length === 0)
  })

  const admin = async (path: string, value?: unknown) => {
    const response = await fetch(`http://${emulator}:9000/${path}.json?ns=demo-toc-default-rtdb`, {
      method: value === undefined ? 'GET' : 'PUT',
      headers: { Authorization: 'Bearer owner' },
      body: value === undefined ? undefined : JSON.stringify(value),
    })
    expect(response.ok).toBe(true)
    return response.json() as Promise<unknown>
  }

  it('lists each class by when it began, for nobody to read until it is old', async () => {
    const listed = (await admin('opened')) as Record<string, string>
    const created = (await admin(`classes/${code}/createdAt`)) as number
    expect(listed[`${created}_${code}`]).toBe(code)
    const guestDb = raw(3)
    await expect(get(ref(guestDb, 'opened'))).rejects.toThrow(/permission/i)
    await expect(get(query(ref(guestDb, 'opened'), orderByKey(), endAt(String(Date.now()))))).rejects.toThrow(/permission/i)
    await expect(set(ref(guestDb, `opened/1000_${code}`), code)).rejects.toThrow(/permission/i)
    await expect(set(ref(guestDb, `opened/${created}_${code}`), null)).rejects.toThrow(/permission/i)
  })

  it('clears away classes nobody ended, once they are old, when someone hosts again', async () => {
    const old = '123456'
    const longAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
    await admin(`classes/${old}`, { host: 'someone', createdAt: longAgo, meta: { since: longAgo }, players: { x: { name: 'X', joinedAt: longAgo } } })
    await admin(`opened/${longAgo}_${old}`, old)
    const newer = await guest.createClass()
    expect(await admin(`classes/${old}`)).toBeNull()
    expect(await admin(`opened/${longAgo}_${old}`)).toBeNull()
    await guest.endClass(newer)
  })

  it('refuses to clear away a class that is still young', async () => {
    await expect(set(ref(raw(3), `classes/${code}`), null)).rejects.toThrow(/permission/i)
  })

  it('ends the class, deleting everything in it, and tells the students', async () => {
    const watching = until<ClassMeta | null>((f, e) => amy.watchMeta(code, f, e), (meta) => meta === null)
    await host.endClass(code)
    expect(await watching).toBeNull()
    const everything = (await admin('')) as { classes?: Record<string, unknown>; opened?: Record<string, unknown> } | null
    expect(everything?.classes?.[code]).toBeUndefined()
    expect(Object.values(everything?.opened ?? {})).not.toContain(code)
  })
})
