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
