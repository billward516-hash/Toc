import { useEffect, useState } from 'react'
import { Icon } from './icons.tsx'

// Safari on an iPad hides its address bar and tabs while a page is full screen; older versions name the
// calls with a webkit prefix. iPhones can't do this for a page, so there the button stays hidden.
interface WebKitDocument extends Document {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

interface WebKitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

const page = () => document as WebKitDocument
const supported = () => Boolean(page().fullscreenEnabled || page().webkitFullscreenEnabled)
const isFull = () => (page().fullscreenElement ?? page().webkitFullscreenElement ?? null) !== null
// Opened from the home screen, the game already fills the screen. A page the button made full screen
// also counts as full-screen display, so that alone doesn't mean it was opened as an app.
const installed = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true ||
  (matchMedia('(display-mode: fullscreen)').matches && !isFull())

export function FullScreenButton() {
  const [full, setFull] = useState(isFull)

  useEffect(() => {
    const update = () => setFull(isFull())
    document.addEventListener('fullscreenchange', update)
    document.addEventListener('webkitfullscreenchange', update)
    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.removeEventListener('webkitfullscreenchange', update)
    }
  }, [])

  if (!supported() || installed()) return null

  const toggle = () => {
    const root = document.documentElement as WebKitElement
    const doc = page()
    const done = full
      ? doc.exitFullscreen
        ? doc.exitFullscreen()
        : doc.webkitExitFullscreen?.()
      : root.requestFullscreen
        ? root.requestFullscreen()
        : root.webkitRequestFullscreen?.()
    // A browser that refuses just stays as it is.
    Promise.resolve(done).catch(() => {})
  }

  return (
    <button className="btn small" onClick={toggle}>
      <Icon name={full ? 'shrink' : 'expand'} /> {full ? 'Exit full screen' : 'Full screen'}
    </button>
  )
}
