import { useEffect, useRef, useState } from 'react'
import { certificateFileName, cleanName, makeCertificate, renameCertificate } from '../exam/certificate.ts'
import { canvasBlob, renderCertificate } from '../exam/certificateImage.ts'
import { jpegToPdf } from '../exam/pdf.ts'
import { NAME_MAX, type CertificateRecord } from '../exam/record.ts'
import { percentOf } from '../exam/rules.ts'
import { Icon } from './icons.tsx'
import { ScreenHeader } from './parts.tsx'
import { shareOrSave } from './share.ts'

interface CertificateScreenProps {
  // The certificate already made, if there is one.
  certificate: CertificateRecord | null
  // The exam that was just passed, when there is a new certificate to make.
  result: { correct: number; asked: number; seed: number; at: string } | null
  // The name last used on a certificate.
  name: string
  onSave: (certificate: CertificateRecord) => void
  onBack: () => void
}

interface Made {
  // Which certificate this is for, so a picture drawn for an earlier name is never shown for a later one.
  key: string
  // A picture of the certificate to show on screen, and the two files to save or share.
  url: string
  png: File
  pdf: File
}

const keyOf = (certificate: CertificateRecord | null): string => (certificate ? `${certificate.id}|${certificate.name}` : '')

// The page for a certificate: the name to put on it, the certificate itself, and a way to keep it. It is
// drawn on the device, and kept there; the name goes nowhere else.
export function CertificateScreen({ certificate, result, name, onSave, onBack }: CertificateScreenProps) {
  // A new pass starts with a blank certificate to name; opening the one already made shows it.
  const [current, setCurrent] = useState<CertificateRecord | null>(result ? null : certificate)
  const [typed, setTyped] = useState(certificate?.name ?? name)
  const [editing, setEditing] = useState(false)
  const [made, setMade] = useState<Made | null>(null)
  const [problem, setProblem] = useState('')
  const [note, setNote] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  // Draw the certificate whenever there is a new one or its name changes. The files are made now, ahead
  // of any tap, because some browsers refuse to share a file that took a while to make.
  useEffect(() => {
    if (!current) return
    let cancelled = false
    let url = ''
    void (async () => {
      try {
        const icon = new URL(`${import.meta.env.BASE_URL}icon-512.png`, document.baseURI).href
        const canvas = await renderCertificate(current, icon)
        const [png, jpeg] = await Promise.all([canvasBlob(canvas, 'image/png'), canvasBlob(canvas, 'image/jpeg', 0.92)])
        const pdf = jpegToPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height, { title: `Certificate of Completion: ${current.name}` })
        if (cancelled) return
        const base = certificateFileName(current.name)
        url = URL.createObjectURL(png)
        setMade({ key: keyOf(current), url, png: new File([png], `${base}.png`, { type: 'image/png' }), pdf: new File([pdf], `${base}.pdf`, { type: 'application/pdf' }) })
      } catch {
        if (!cancelled) setProblem('This browser could not draw the certificate. Try again, or use a different browser.')
      }
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [current])

  const form = current === null || editing
  const cleaned = cleanName(typed)
  const ready = made && made.key === keyOf(current) ? made : null

  const make = () => {
    if (!cleaned) {
      inputRef.current?.focus()
      return
    }
    const fresh = current ? renameCertificate(current, cleaned) : result ? makeCertificate(cleaned, result, result.seed, result.at) : null
    if (!fresh) return
    setCurrent(fresh)
    setEditing(false)
    setProblem('')
    setNote('')
    onSave(fresh)
  }

  const keep = async (file: File) => {
    const how = await shareOrSave(file)
    setNote(how === 'saved' ? 'Saved. On an iPad, look in the Downloads list in Safari, or in the Files app.' : '')
  }

  return (
    <div className="screen exam">
      <ScreenHeader
        chip="Certificate"
        title="Your certificate"
        stats={current ? [{ label: 'Score', value: `${percentOf(current.correct, current.asked)}%` }] : []}
        onExit={onBack}
      />
      <section className="card guide-card certificate-card" aria-labelledby="certificate-title">
        <h2 id="certificate-title" tabIndex={-1} ref={headingRef}>
          {current === null ? 'Put your name on your certificate' : 'Certificate of Completion'}
        </h2>

        {current === null && !result && <p>There is no certificate yet. Pass the exam to earn one.</p>}

        {(result || certificate) && form && (
          <form
            className="certificate-form"
            onSubmit={(event) => {
              event.preventDefault()
              make()
            }}
          >
            {result && (
              <p>
                You passed with {percentOf(result.correct, result.asked)}% ({result.correct} of {result.asked} right). Well done!
              </p>
            )}
            <label htmlFor="certificate-name">Name on the certificate</label>
            <input
              id="certificate-name"
              ref={inputRef}
              type="text"
              value={typed}
              maxLength={NAME_MAX}
              autoComplete="name"
              enterKeyHint="done"
              placeholder="Your full name"
              onChange={(event) => setTyped(event.target.value)}
            />
            <p className="hint">Type it the way you want it printed. It is saved on this device only. It is not sent anywhere.</p>
            <div className="exam-actions">
              <button className="btn primary big" type="submit" disabled={!cleaned}>
                <Icon name="award" /> {current ? 'Update my certificate' : 'Make my certificate'}
              </button>
              {editing && (
                <button className="btn" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {current !== null && !form && (
          <>
            {ready ? (
              <figure className="certificate-preview">
                <img src={ready.url} alt={`Certificate of Completion for ${current.name}. Final exam score ${percentOf(current.correct, current.asked)} percent. Certificate ID ${current.id}.`} />
              </figure>
            ) : problem ? (
              <p className="exam-problem" role="alert">
                {problem}
              </p>
            ) : (
              <p className="hint" role="status">
                Drawing your certificate…
              </p>
            )}
            <div className="exam-actions">
              <button className="btn primary big" disabled={!ready} onClick={() => ready && void keep(ready.pdf)}>
                <Icon name="award" /> Save or share the PDF
              </button>
              <button className="btn" disabled={!ready} onClick={() => ready && void keep(ready.png)}>
                Save as a picture
              </button>
              <button className="btn" onClick={() => setEditing(true)}>
                Change the name
              </button>
            </div>
            {note && (
              <p className="hint" role="status">
                {note}
              </p>
            )}
            <p className="hint">Your certificate is kept on this device only. Save a copy now to be sure of keeping it. Certificate ID {current.id}.</p>
          </>
        )}
      </section>
    </div>
  )
}
