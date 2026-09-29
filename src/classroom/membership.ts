import { browserStorage, type KeyValue } from '../progress/store.ts'

// A student's place in a class, kept on the device so a reload doesn't drop them: the class's code,
// and when the class began, so only results from then on are sent.
export interface Membership {
  code: string
  since: number
}

const memberKey = (learnerId: string) => `toc-factory:class:${learnerId}`
const HOSTING_KEY = 'toc-factory:hosting'

function read(storage: KeyValue | null, key: string): unknown {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function write(storage: KeyValue | null, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing or a full quota: this lasts for the session only.
  }
}

export function loadMembership(learnerId: string, storage: KeyValue | null = browserStorage()): Membership | null {
  const saved = read(storage, memberKey(learnerId)) as Partial<Membership> | null
  return typeof saved?.code === 'string' && typeof saved.since === 'number' ? { code: saved.code, since: saved.since } : null
}

export function saveMembership(learnerId: string, membership: Membership | null, storage: KeyValue | null = browserStorage()) {
  write(storage, memberKey(learnerId), membership)
}

// The class this device hosts, if any, so its host gets back to it after a reload.
export function loadHosting(storage: KeyValue | null = browserStorage()): string | null {
  const saved = read(storage, HOSTING_KEY)
  return typeof saved === 'string' ? saved : null
}

export function saveHosting(code: string | null, storage: KeyValue | null = browserStorage()) {
  write(storage, HOSTING_KEY, code)
}
