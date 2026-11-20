// The Play Store edition (`npm run build:play`, or `npm run dev:play`) is the game for one learner on one
// device: no class mode, no trainer's guide, no My factory, and none of the print, full-screen, or
// shared-device controls. The mode is fixed when the app is built, so this switches things off for good,
// and vite.config.ts leaves the screens this edition drops out of the build altogether, not just hidden.
// The web edition keeps everything.
export const PLAY = import.meta.env.MODE === 'play'

// What the game is called: the Play edition is "Factory Fun", so someone browsing an app store sees a name
// that says what it is, and the web edition stays "TOC Factory". The android app's own name is set in
// capacitor.config.ts and android/app/src/main/res/values/strings.xml, which must be kept the same.
export const GAME_NAME = PLAY ? 'Factory Fun' : 'TOC Factory'
