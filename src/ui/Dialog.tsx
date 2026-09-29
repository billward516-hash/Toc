import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

interface DialogProps {
  kicker: string
  title: string
  tone?: 'info' | 'good' | 'retry'
  children: ReactNode
  actions: ReactNode
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [href], summary, [tabindex]:not([tabindex="-1"])'

export function Dialog({ kicker, title, tone = 'info', children, actions }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Focus the main action without scrolling to it, so a long dialog opens at its title, or a field
  // marked data-autofocus, for a dialog that asks for something. On closing, focus goes back to where
  // it was, if that's still on the page.
  useEffect(() => {
    const before = document.activeElement
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('.dialog-actions button')
    first?.focus({ preventScroll: true })
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true })
    }
  }, [])

  // Tab and Shift+Tab stay inside the dialog, like the page behind it isn't there.
  const keepFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !ref.current) return
    const stops = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (stops.length === 0) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="overlay">
      <div ref={ref} className={`dialog ${tone}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keepFocus}>
        <p className="kicker">{kicker}</p>
        <h2 id={titleId}>{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  )
}
