import type { ClassBackend } from './backend.ts'
import { emulatorHost, firebaseSettings } from './settings.ts'

let loading: Promise<ClassBackend> | null = null

// Firebase's code loads the first time someone hosts or joins a class, so the game itself stays small.
export function classBackend(): Promise<ClassBackend> {
  const settings = firebaseSettings
  if (!settings) return Promise.reject(new Error('Class mode is not set up.'))
  loading ??= import('./firebase.ts')
    .then(({ firebaseBackend }) => firebaseBackend(settings, emulatorHost))
    .catch((error: unknown) => {
      loading = null
      throw error
    })
  return loading
}

// Gives up on a request after a while, so a lost connection shows a message instead of a spinner.
export function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The class service took too long to answer.')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
