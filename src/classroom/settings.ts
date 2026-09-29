import { EMULATOR_SETTINGS, readFirebaseSettings, type FirebaseSettings } from './config.ts'

// Set VITE_FIREBASE_EMULATOR=127.0.0.1 to run class mode against Firebase's emulators on this machine.
export const emulatorHost: string | null = import.meta.env.VITE_FIREBASE_EMULATOR || null

export const firebaseSettings: FirebaseSettings | null =
  readFirebaseSettings(import.meta.env.VITE_FIREBASE_CONFIG) ?? (emulatorHost ? EMULATOR_SETTINGS : null)

// Class mode appears in the game only once the build knows where to connect.
export const classModeReady = firebaseSettings !== null
