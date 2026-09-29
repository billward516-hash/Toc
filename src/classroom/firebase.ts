import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import {
  connectDatabaseEmulator,
  endAt,
  get,
  getDatabase,
  onDisconnect,
  onValue,
  orderByKey,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type DataSnapshot,
} from 'firebase/database'
import { NoSuchClass, type ClassBackend, type Unsubscribe } from './backend.ts'
import { newClassCode } from './code.ts'
import type { FirebaseSettings } from './config.ts'
import { readMeta, readRoom } from './room.ts'

// A class nobody ended gets cleared away once it's this old, the next time anyone hosts a class. The
// database's rules hold the same number.
export const CLASS_HOURS = 12
const HOUR = 60 * 60 * 1000

// Class mode on Firebase: a Realtime Database for the class, and anonymous sign-in, which gives each
// device a private ID without asking the student for anything. `name` keeps separate instances apart
// when one page plays several devices, as the tests do.
export function firebaseBackend(settings: FirebaseSettings, emulator: string | null, name?: string): ClassBackend {
  const app = initializeApp(settings, name)
  const auth = getAuth(app)
  const db = getDatabase(app)
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true })
    connectDatabaseEmulator(db, emulator, 9000)
  }

  // Signs in the first time it's needed. A device keeps its ID from visit to visit, so a host can
  // still end their class after the page reloads.
  let signingIn: Promise<string> | null = null
  const me = () => {
    signingIn ??= auth
      .authStateReady()
      .then(async () => auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid)
      .catch((error: unknown) => {
        signingIn = null
        throw error
      })
    return signingIn
  }

  // Listens once signed in, since the rules only let signed-in devices read.
  const listen = (path: (uid: string) => string, onChange: (snapshot: DataSnapshot) => void, onError: (error: Error) => void): Unsubscribe => {
    let stop: Unsubscribe | null = null
    let stopped = false
    me().then((uid) => {
      if (!stopped) stop = onValue(ref(db, path(uid)), onChange, onError)
    }, onError)
    return () => {
      stopped = true
      stop?.()
    }
  }

  const player = (code: string, uid: string) => `classes/${code}/players/${uid}`
  // Each open class is also listed under opened/, by when it began, so an old one can be found
  // without anyone being able to list the classes still running.
  const listing = (createdAt: number, code: string) => `opened/${createdAt}_${code}`

  // Clears away classes that began over CLASS_HOURS ago and were never ended, with an hour's slack
  // for a device whose clock runs a little fast.
  const clearOld = async () => {
    const old = await get(query(ref(db, 'opened'), orderByKey(), endAt(String(Date.now() - (CLASS_HOURS + 1) * HOUR))))
    const gone: Record<string, null> = {}
    old.forEach((entry) => {
      const code = entry.val()
      if (entry.key && typeof code === 'string') {
        gone[`classes/${code}`] = null
        gone[`opened/${entry.key}`] = null
      }
    })
    if (Object.keys(gone).length > 0) await update(ref(db), gone)
  }

  return {
    async createClass() {
      const uid = await me()
      await clearOld().catch(() => undefined)
      // A code someone else is using is refused by the rules; try another.
      for (let attempt = 1; ; attempt++) {
        const code = newClassCode()
        try {
          await set(ref(db, `classes/${code}`), { host: uid, createdAt: serverTimestamp(), meta: { since: serverTimestamp() } })
        } catch (error) {
          if (attempt >= 5 || !refused(error)) throw error
          continue
        }
        // Listing it can only fail if the connection drops; the class still works then, and its host
        // can end it as usual.
        const createdAt = (await get(ref(db, `classes/${code}/createdAt`))).val()
        if (typeof createdAt === 'number') await set(ref(db, listing(createdAt, code)), code).catch(() => undefined)
        return code
      }
    },

    watchClass(code, onChange, onError) {
      return listen(() => `classes/${code}`, (snapshot) => onChange(readRoom(code, snapshot.val())), onError)
    },

    async setFocus(code, levelId) {
      await me()
      await update(ref(db, `classes/${code}/meta`), levelId === null ? { focus: null } : { focus: levelId, focusAt: serverTimestamp() })
    },

    async removePlayer(code, playerId) {
      await me()
      await remove(ref(db, player(code, playerId)))
    },

    async endClass(code) {
      await me()
      const createdAt = (await get(ref(db, `classes/${code}/createdAt`))).val()
      const gone: Record<string, null> = { [`classes/${code}`]: null }
      if (typeof createdAt === 'number') gone[listing(createdAt, code)] = null
      await update(ref(db), gone)
    },

    async join(code, { name, progress }) {
      const uid = await me()
      const meta = readMeta((await get(ref(db, `classes/${code}/meta`))).val())
      if (!meta) throw new NoSuchClass(code)
      await set(ref(db, player(code, uid)), { name, joinedAt: serverTimestamp(), online: true, progress })
      return meta
    },

    watchMeta(code, onChange, onError) {
      return listen(() => `classes/${code}/meta`, (snapshot) => onChange(readMeta(snapshot.val())), onError)
    },

    watchMembership(code, onChange, onError) {
      return listen((uid) => `${player(code, uid)}/joinedAt`, (snapshot) => onChange(snapshot.exists()), onError)
    },

    stayOnline(code, onConnect) {
      let stop: Unsubscribe | null = null
      let stopped = false
      me().then(
        (uid) => {
          if (stopped) return
          const online = ref(db, `${player(code, uid)}/online`)
          stop = onValue(ref(db, '.info/connected'), (snapshot) => {
            if (snapshot.val() !== true) return
            // Refused once the student is no longer in the class; there's nothing to send then.
            onDisconnect(online)
              .set(false)
              .then(() => set(online, true))
              .then(onConnect, () => undefined)
          })
        },
        () => undefined,
      )
      return () => {
        stopped = true
        stop?.()
      }
    },

    async sendResults(code, events) {
      if (Object.keys(events).length === 0) return
      const uid = await me()
      await update(ref(db, `${player(code, uid)}/events`), events)
    },

    async sendProgress(code, progress) {
      const uid = await me()
      await set(ref(db, `${player(code, uid)}/progress`), progress)
    },

    async sendNow(code, levelId) {
      const uid = await me()
      await set(ref(db, `${player(code, uid)}/now`), levelId)
    },

    async leave(code) {
      const uid = await me()
      await onDisconnect(ref(db, `${player(code, uid)}/online`)).cancel()
      await remove(ref(db, player(code, uid)))
    },
  }
}

function refused(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
  return [code, message].some((text) => typeof text === 'string' && /permission.denied/i.test(text))
}
