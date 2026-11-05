import { useCallback, useEffect, useRef, useState } from 'react'

export const PATIENT_SESSION_TIMEOUT_MS = 15 * 60 * 1000
export const PATIENT_SESSION_WARNING_MS = 2 * 60 * 1000

export type PatientSessionEndReason = 'manual' | 'timeout'

interface EndPatientSessionOptions {
  reason: PatientSessionEndReason
  resetSensitive: () => void
  leaveDemo: () => void
  signOut: () => Promise<void>
  navigateToLogin: (reason: PatientSessionEndReason) => void
}

export async function endPatientSession({ reason, resetSensitive, leaveDemo, signOut, navigateToLogin }: EndPatientSessionOptions) {
  resetSensitive()
  leaveDemo()
  try { await signOut() }
  catch { /* El cierre local continúa sin exponer detalles del proveedor. */ }
  finally { navigateToLogin(reason) }
}

export interface SessionTimeoutClock {
  now: () => number
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout: (timerId: number) => void
}

const browserClock: SessionTimeoutClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (timerId) => window.clearTimeout(timerId),
}

interface SessionTimeoutControllerOptions {
  clock?: SessionTimeoutClock
  onWarning: () => void
  onActive: () => void
  onEnd: (reason: PatientSessionEndReason) => void
}

type SessionTimingState = 'active' | 'warning' | 'ended'

export class PatientSessionTimeoutController {
  private readonly clock: SessionTimeoutClock
  private readonly onWarning: () => void
  private readonly onActive: () => void
  private readonly onEnd: (reason: PatientSessionEndReason) => void
  private deadline: number | null = null
  private timerId: number | null = null
  private warningOpen = false
  private ended = false

  constructor({ clock = browserClock, onWarning, onActive, onEnd }: SessionTimeoutControllerOptions) {
    this.clock = clock
    this.onWarning = onWarning
    this.onActive = onActive
    this.onEnd = onEnd
  }

  start() {
    this.ended = false
    this.warningOpen = false
    this.deadline = this.clock.now() + PATIENT_SESSION_TIMEOUT_MS
    this.scheduleNextTransition()
  }

  recordActivity() {
    if (this.ended || this.deadline === null) return
    const now = this.clock.now()
    if (this.scheduleNextTransition(now) !== 'active') return
    this.deadline = now + PATIENT_SESSION_TIMEOUT_MS
    this.scheduleNextTransition(now)
  }

  continueSession() {
    if (this.ended || this.deadline === null) return
    const warningWasOpen = this.warningOpen
    const now = this.clock.now()
    if (this.scheduleNextTransition(now) !== 'warning' || !warningWasOpen) return
    this.warningOpen = false
    this.deadline = now + PATIENT_SESSION_TIMEOUT_MS
    this.onActive()
    this.scheduleNextTransition(now)
  }

  evaluateElapsedTime() {
    if (this.ended || this.deadline === null) return
    this.scheduleNextTransition()
  }

  end(reason: PatientSessionEndReason) {
    if (this.ended || this.deadline === null) return
    this.ended = true
    this.deadline = null
    this.clearTimer()
    this.onEnd(reason)
  }

  stop() {
    this.ended = true
    this.deadline = null
    this.clearTimer()
  }

  private scheduleNextTransition(now = this.clock.now()): SessionTimingState {
    this.clearTimer()
    if (this.deadline === null || this.ended) return 'ended'

    const remaining = this.deadline - now
    if (remaining <= 0) {
      this.end('timeout')
      return 'ended'
    }

    if (remaining <= PATIENT_SESSION_WARNING_MS) {
      if (!this.warningOpen) {
        this.warningOpen = true
        this.onWarning()
      }
      this.timerId = this.clock.setTimeout(() => this.evaluateElapsedTime(), remaining)
      return 'warning'
    }

    this.timerId = this.clock.setTimeout(
      () => this.evaluateElapsedTime(),
      remaining - PATIENT_SESSION_WARNING_MS,
    )
    return 'active'
  }

  private clearTimer() {
    if (this.timerId === null) return
    this.clock.clearTimeout(this.timerId)
    this.timerId = null
  }
}

interface UsePatientSessionTimeoutOptions {
  enabled: boolean
  sessionKey: string | null
  onEnd: (reason: PatientSessionEndReason) => void
  clock?: SessionTimeoutClock
}

export function usePatientSessionTimeout({ enabled, sessionKey, onEnd, clock = browserClock }: UsePatientSessionTimeoutOptions) {
  const [warningSessionKey, setWarningSessionKey] = useState<string | null>(null)
  const controllerRef = useRef<PatientSessionTimeoutController | null>(null)
  const onEndRef = useRef(onEnd)

  useEffect(() => { onEndRef.current = onEnd }, [onEnd])

  useEffect(() => {
    if (!enabled || !sessionKey) return

    const controller = new PatientSessionTimeoutController({
      clock,
      onWarning: () => setWarningSessionKey(sessionKey),
      onActive: () => setWarningSessionKey(null),
      onEnd: (reason) => {
        setWarningSessionKey(null)
        onEndRef.current(reason)
      },
    })
    controllerRef.current = controller
    controller.start()

    const recordActivity = () => controller.recordActivity()
    const evaluateVisibleTab = () => {
      if (document.visibilityState === 'visible') controller.evaluateElapsedTime()
    }

    window.addEventListener('pointerdown', recordActivity, { passive: true })
    window.addEventListener('keydown', recordActivity)
    document.addEventListener('visibilitychange', evaluateVisibleTab)

    return () => {
      window.removeEventListener('pointerdown', recordActivity)
      window.removeEventListener('keydown', recordActivity)
      document.removeEventListener('visibilitychange', evaluateVisibleTab)
      controller.stop()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [clock, enabled, sessionKey])

  const continueSession = useCallback(() => controllerRef.current?.continueSession(), [])
  const endSession = useCallback((reason: PatientSessionEndReason = 'manual') => controllerRef.current?.end(reason), [])

  return { warningOpen: enabled && sessionKey !== null && warningSessionKey === sessionKey, continueSession, endSession }
}
