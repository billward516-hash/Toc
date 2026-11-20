import { Capacitor } from '@capacitor/core'

// Saving, sharing, and copying: the trainer's script, and a learner's certificate.
export function downloadFile(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(name: string, text: string) {
  downloadFile(name, new Blob([text], { type: 'text/markdown;charset=utf-8' }))
}

// Hands a file to the device's share sheet where there is one (Save to Files, Mail, AirDrop on an iPad),
// and saves it as a download where there is not. A closed share sheet is not an error. Call it straight
// from a tap, with the file already made: some browsers refuse to share after a wait.
export async function shareOrSave(file: File): Promise<'shared' | 'cancelled' | 'saved'> {
  // In the Android app a download link does nothing, and the browser's share sheet isn't there. The file is
  // written to the app's cache and handed to Android's own share sheet, which also offers Save to Drive.
  if (Capacitor.isNativePlatform()) {
    try {
      return await shareNative(file)
    } catch {
      // Falls through to what a browser would do, which at least doesn't leave the tap without an answer.
    }
  }
  try {
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
  }
  downloadFile(file.name, file)
  return 'saved'
}

// Whether the text reached the clipboard; browsers refuse it outside a tap, or on an insecure page.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Plugins load when the Android app first needs one, so the web game doesn't carry them.
async function shareNative(file: File): Promise<'shared' | 'cancelled'> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
  const written = await Filesystem.writeFile({ path: file.name, data: await toBase64(file), directory: Directory.Cache })
  try {
    await Share.share({ title: file.name, files: [written.uri] })
    return 'shared'
  } catch (error) {
    // Closing the share sheet without choosing anything is not an error.
    if (error instanceof Error && /cancel/i.test(error.message)) return 'cancelled'
    throw error
  }
}

async function toBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
