import { Component, type ErrorInfo, type ReactNode } from 'react'

interface CrashGuardProps {
  children: ReactNode
}

interface CrashGuardState {
  crashed: boolean
}

// If a screen fails while drawing, React would leave a blank page, a dead end on a shared tablet with
// no reload button. Say what happened instead, and start again from the levels: progress is already
// saved on the device.
export class CrashGuard extends Component<CrashGuardProps, CrashGuardState> {
  state: CrashGuardState = { crashed: false }

  static getDerivedStateFromError(): CrashGuardState {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="screen">
        <div className="card crashed" role="alert">
          <h1>Something went wrong</h1>
          <p>This screen stopped working. Your progress is saved on this device.</p>
          <button className="btn primary big" onClick={() => window.location.reload()}>
            Start again
          </button>
        </div>
      </div>
    )
  }
}
