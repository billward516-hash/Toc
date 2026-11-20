import type { CapacitorConfig } from '@capacitor/cli'

// The Android app wraps the Play Store edition of the game (`npm run build:play`, see src/edition.ts).
// The app id is the app's permanent name on Google Play: it can't change once an upload is published.
const config: CapacitorConfig = {
  appId: 'com.tocfactory.game',
  appName: 'Factory Fun',
  webDir: 'dist-play',
  backgroundColor: '#fff7e6',
  android: {
    // Nothing in the game leaves the device, and every page it loads is its own.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#fff7e6' },
    // The game draws edge to edge and keeps clear of the bars itself (env(safe-area-inset-*) in index.css).
    // The bars are the game's cream, so their icons are dark.
    SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover', style: 'LIGHT' },
  },
}

export default config
