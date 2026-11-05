import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PatientSessionTimeoutModal } from '../features/auth/PatientSessionTimeoutModal'
import {
  PATIENT_SESSION_TIMEOUT_MS,
  PATIENT_SESSION_WARNING_MS,
  PatientSessionTimeoutController,
  endPatientSession,
  type SessionTimeoutClock,
} from '../features/auth/patientSessionTimeout'

class ManualClock implements SessionTimeoutClock {
  currentTime = 0
  private sequence = 0
  private readonly callbacks = new Map<number, () => void>()

  now = () => this.currentTime
  setTimeout = (callback: () => void) => {
    const id = ++this.sequence
    this.callbacks.set(id, callback)
    return id
  }
  clearTimeout = (timerId: number) => { this.callbacks.delete(timerId) }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date('2026-10-28T12:00:00-05:00'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('timeout de sesión Paciente', () => {
  it('avisa exactamente a los 13 minutos y cierra una sola vez a los 15', () => {
    const onWarning = vi.fn()
    const onEnd = vi.fn()
    const controller = new PatientSessionTimeoutController({ onWarning, onActive: vi.fn(), onEnd })
    controller.start()

    act(() => vi.advanceTimersByTime(PATIENT_SESSION_TIMEOUT_MS - PATIENT_SESSION_WARNING_MS - 1))
    expect(onWarning).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onWarning).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(PATIENT_SESSION_WARNING_MS))
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith('timeout')
    controller.end('manual')
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('reinicia el plazo con actividad anterior al aviso', () => {
    const onWarning = vi.fn()
    const controller = new PatientSessionTimeoutController({ onWarning, onActive: vi.fn(), onEnd: vi.fn() })
    controller.start()

    act(() => vi.advanceTimersByTime(12 * 60 * 1000))
    controller.recordActivity()
    act(() => vi.advanceTimersByTime(12 * 60 * 1000 + 59 * 1000))
    expect(onWarning).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1000))
    expect(onWarning).toHaveBeenCalledTimes(1)
  })

  it('reevalúa el tiempo real transcurrido al recuperar una pestaña', () => {
    const clock = new ManualClock()
    const onWarning = vi.fn()
    const onEnd = vi.fn()
    const controller = new PatientSessionTimeoutController({ clock, onWarning, onActive: vi.fn(), onEnd })
    controller.start()

    clock.currentTime = PATIENT_SESSION_TIMEOUT_MS - PATIENT_SESSION_WARNING_MS
    controller.evaluateElapsedTime()
    expect(onWarning).toHaveBeenCalledTimes(1)

    clock.currentTime = PATIENT_SESSION_TIMEOUT_MS
    controller.evaluateElapsedTime()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith('timeout')
  })

  it('convierte actividad retrasada a los 13 minutos en aviso sin extender el deadline', () => {
    const clock = new ManualClock()
    const onWarning = vi.fn()
    const onEnd = vi.fn()
    const controller = new PatientSessionTimeoutController({ clock, onWarning, onActive: vi.fn(), onEnd })
    controller.start()

    clock.currentTime = PATIENT_SESSION_TIMEOUT_MS - PATIENT_SESSION_WARNING_MS
    controller.recordActivity()
    expect(onWarning).toHaveBeenCalledTimes(1)

    clock.currentTime = PATIENT_SESSION_TIMEOUT_MS
    controller.evaluateElapsedTime()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith('timeout')
  })

  it('cierra ante actividad retrasada a los 15 minutos sin revivir la sesión', () => {
    const clock = new ManualClock()
    const onEnd = vi.fn()
    const controller = new PatientSessionTimeoutController({ clock, onWarning: vi.fn(), onActive: vi.fn(), onEnd })
    controller.start()

    clock.currentTime = PATIENT_SESSION_TIMEOUT_MS
    controller.recordActivity()
    controller.recordActivity()

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith('timeout')
  })

  it('no permite continuar una sesión cuyo deadline ya venció', () => {
    const clock = new ManualClock()
    const onActive = vi.fn()
    const onEnd = vi.fn()
    const controller = new PatientSessionTimeoutController({ clock, onWarning: vi.fn(), onActive, onEnd })
    controller.start()
    clock.currentTime = PATIENT_SESSION_TIMEOUT_MS - PATIENT_SESSION_WARNING_MS
    controller.evaluateElapsedTime()

    clock.currentTime = PATIENT_SESSION_TIMEOUT_MS
    controller.continueSession()
    controller.continueSession()

    expect(onActive).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith('timeout')
  })

  it('no extiende por interacción incidental durante el aviso y enfoca la acción segura', () => {
    const onSessionEnd = vi.fn()
    render(<PatientSessionTimeoutModal enabled sessionKey="patient-1" onSessionEnd={onSessionEnd} />)

    act(() => vi.advanceTimersByTime(PATIENT_SESSION_TIMEOUT_MS - PATIENT_SESSION_WARNING_MS))
    const continueButton = screen.getByRole('button', { name: 'Seguir conectado' })
    expect(continueButton).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent('2 minutos')

    fireEvent.pointerDown(window)
    act(() => vi.advanceTimersByTime(PATIENT_SESSION_WARNING_MS))
    expect(onSessionEnd).toHaveBeenCalledTimes(1)
    expect(onSessionEnd).toHaveBeenCalledWith('timeout')
  })

  it('extiende solo al elegir Seguir conectado y vuelve a iniciar los 15 minutos', () => {
    const onSessionEnd = vi.fn()
    render(<PatientSessionTimeoutModal enabled sessionKey="patient-1" onSessionEnd={onSessionEnd} />)

    act(() => vi.advanceTimersByTime(PATIENT_SESSION_TIMEOUT_MS - PATIENT_SESSION_WARNING_MS))
    fireEvent.click(screen.getByRole('button', { name: 'Seguir conectado' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(PATIENT_SESSION_TIMEOUT_MS - PATIENT_SESSION_WARNING_MS))
    expect(screen.getByRole('dialog', { name: 'Tu sesión está por cerrarse' })).toBeInTheDocument()
    expect(onSessionEnd).not.toHaveBeenCalled()
  })

  it('no instala un plazo sin sesión autenticada', () => {
    const onSessionEnd = vi.fn()
    render(<PatientSessionTimeoutModal enabled={false} sessionKey={null} onSessionEnd={onSessionEnd} />)
    act(() => vi.advanceTimersByTime(PATIENT_SESSION_TIMEOUT_MS * 2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onSessionEnd).not.toHaveBeenCalled()
  })

  it('reinicia el reloj cuando cambia el usuario autenticado', () => {
    const onSessionEnd = vi.fn()
    const view = render(<PatientSessionTimeoutModal enabled sessionKey="patient-1" onSessionEnd={onSessionEnd} />)
    act(() => vi.advanceTimersByTime(12 * 60 * 1000))

    view.rerender(<PatientSessionTimeoutModal enabled sessionKey="patient-2" onSessionEnd={onSessionEnd} />)
    act(() => vi.advanceTimersByTime(60 * 1000))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(12 * 60 * 1000))
    expect(screen.getByRole('dialog', { name: 'Tu sesión está por cerrarse' })).toBeInTheDocument()
    expect(onSessionEnd).not.toHaveBeenCalled()
  })

  it('limpia datos sensibles y navega una sola vez aunque signOut falle', async () => {
    const resetSensitive = vi.fn()
    const leaveDemo = vi.fn()
    const signOut = vi.fn().mockRejectedValue(new Error('Fallo remoto'))
    const navigateToLogin = vi.fn()

    await endPatientSession({ reason: 'timeout', resetSensitive, leaveDemo, signOut, navigateToLogin })

    expect(resetSensitive).toHaveBeenCalledTimes(1)
    expect(leaveDemo).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(navigateToLogin).toHaveBeenCalledTimes(1)
    expect(navigateToLogin).toHaveBeenCalledWith('timeout')
  })
})
