import { Capacitor } from '@capacitor/core'
import { useEffect, useRef } from 'react'

// The Android app's back button. The game moves between screens by state, not by address, so the system's
// back would close the app from anywhere. `goBack` steps out of the screen that is open and says whether
// it did; from the home screen it says no, and the app closes. Nothing happens in a browser.
export function useAndroidBack(goBack: () => boolean) {
  const latest = useRef(goBack)
  useEffect(() => {
    latest.current = goBack
  })

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let gone = false
    let remove: (() => Promise<void>) | null = null
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('backButton', () => {
        if (!latest.current()) void App.exitApp()
      })
      if (gone) void handle.remove()
      else remove = () => handle.remove()
    })
    return () => {
      gone = true
      void remove?.()
    }
  }, [])
}
