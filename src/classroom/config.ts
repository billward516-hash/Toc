// Where class mode connects: a Firebase project's web settings. The owner pastes them from the
// Firebase console into the repository's FIREBASE_CONFIG variable, and the build reads that as
// VITE_FIREBASE_CONFIG. They aren't secret: every copy of the game carries them, and the database's
// rules decide who may read or write what.
export interface FirebaseSettings {
  apiKey: string
  authDomain: string
  databaseURL: string
  projectId: string
  appId?: string
}

// The console hands out JavaScript, not JSON (const firebaseConfig = { apiKey: "…", … };), so the
// quoted values are read by name instead of parsed. Null means class mode isn't set up.
export function readFirebaseSettings(text: string | undefined): FirebaseSettings | null {
  if (!text) return null
  const values = new Map<string, string>()
  for (const match of text.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']*)["']/g)) values.set(match[1], match[2].trim())
  const apiKey = values.get('apiKey')
  const projectId = values.get('projectId')
  if (!apiKey || !projectId) return null
  return {
    apiKey,
    projectId,
    authDomain: values.get('authDomain') || `${projectId}.firebaseapp.com`,
    // The console includes the database's address once the database exists; one in the United States
    // has this one.
    databaseURL: values.get('databaseURL') || `https://${projectId}-default-rtdb.firebaseio.com`,
    appId: values.get('appId') || undefined,
  }
}

// Stand-in settings for Firebase's emulators on this machine: a "demo-" project never reaches Google.
export const EMULATOR_SETTINGS: FirebaseSettings = {
  apiKey: 'demo-key',
  authDomain: 'demo-toc.firebaseapp.com',
  databaseURL: 'https://demo-toc-default-rtdb.firebaseio.com',
  projectId: 'demo-toc',
}
