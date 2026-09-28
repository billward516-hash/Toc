import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  kicker: string
  title: string
  tone?: 'info' | 'good' | 'retry'
  children: ReactNode
  actions: ReactNode
}

export function Dialog({ kicker, title, tone = 'info', children, actions }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('.dialog-actions button')?.focus()
  }, [])

  return (
    <div className="overlay">
      <div ref={ref} className={`dialog ${tone}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <p className="kicker">{kicker}</p>
        <h2 id={titleId}>{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  )
}
