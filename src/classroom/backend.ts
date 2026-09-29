import type { ClassEvent, ClassMeta, ClassRoom } from './room.ts'

export type Unsubscribe = () => void

// A class's life seen from both ends: the instructor's device hosts it, students' devices join it.
// The game talks to this, and only src/classroom/firebase.ts knows it runs on Firebase, so the rest
// loads Firebase's code only once someone hosts or joins a class.
export interface ClassBackend {
  // Opens a new class with this device as its host, and returns its code.
  createClass(): Promise<string>
  // The whole class, kept up to date, for its host; null once it has ended.
  watchClass(code: string, onChange: (room: ClassRoom | null) => void, onError: (error: Error) => void): Unsubscribe
  // Sends everyone to one level, or lets them play what they like again.
  setFocus(code: string, levelId: string | null): Promise<void>
  removePlayer(code: string, playerId: string): Promise<void>
  // Ends the class and deletes everything in it.
  endClass(code: string): Promise<void>

  // Joins as a new student and returns what every student may know about the class; fails with
  // NoSuchClass if nobody is hosting that code.
  join(code: string, entry: { name: string; progress: Record<string, number> }): Promise<ClassMeta>
  // What every student may know about the class; null once it has ended.
  watchMeta(code: string, onChange: (meta: ClassMeta | null) => void, onError: (error: Error) => void): Unsubscribe
  // Whether this device is still in the class: false once the host removes it.
  watchMembership(code: string, onChange: (member: boolean) => void, onError: (error: Error) => void): Unsubscribe
  // Marks the student online while connected, and offline when the connection drops. `onConnect` runs
  // each time the connection comes back, to send anything that couldn't go out while it was down.
  stayOnline(code: string, onConnect: () => void): Unsubscribe
  sendResults(code: string, events: Record<string, ClassEvent>): Promise<void>
  sendProgress(code: string, progress: Record<string, number>): Promise<void>
  sendNow(code: string, levelId: string | null): Promise<void>
  // Leaves the class, deleting this student's entry.
  leave(code: string): Promise<void>
}

export class NoSuchClass extends Error {
  constructor(code: string) {
    super(`No class is open with the code ${code}.`)
    this.name = 'NoSuchClass'
  }
}
