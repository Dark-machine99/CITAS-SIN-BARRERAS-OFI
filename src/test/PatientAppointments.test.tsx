import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../app/providers/AuthProvider'
import { BookingProvider, useBooking } from '../app/providers/BookingProvider'
import { AppointmentDetailPage, AppointmentsPage } from '../features/appointments/AppointmentsPages'
import type { AccessibilityPreferencesRow, PatientAccountAdapter, PatientProfile } from '../services/supabase/patientAccountAdapter'
import { PatientAppointmentsError, type PatientAppointment, type PatientAppointmentsAdapter } from '../services/supabase/patientAppointmentsAdapter'
import { PatientAvailabilityError, type PatientAvailabilityAdapter, type PatientAvailabilityData } from '../services/supabase/patientAvailabilityAdapter'
import type { PatientReservationAdapter, PatientReservationData } from '../services/supabase/patientReservationAdapter'

const patientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondPatientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const appointmentId = '11111111-1111-4111-8111-111111111111'
const doctorId = '22222222-2222-4222-8222-222222222222'
const specialtyId = '33333333-3333-4333-8333-333333333333'
const session = (id = patientId) => ({ user: { id, email: 'paciente@pilot.local' } } as unknown as Session)
const profile = (id = patientId): PatientProfile => ({ id, first_name: 'Ana', last_name: 'Pérez', phone: null, role: 'patient', must_change_password: false, created_at: '2026-01-01', updated_at: '2026-01-01' })
const preferences: AccessibilityPreferencesRow = { user_id: patientId, preset: 'standard', font_scale: 1, high_contrast: false, large_cursor: false, magnifier_enabled: false, guided_reading: false, reduced_motion: false, simple_mode: false, colorblind_mode: false, keyboard_enhancements: false, voice_control: false, updated_at: '2026-01-01' }
const appointment = (overrides: Partial<PatientAppointment> = {}): PatientAppointment => ({
  id: appointmentId, code: 'CMA-REAL-01', doctorId, specialtyId, date: '2026-11-05', time: '09:30:00',
  durationMinutes: 45, reason: 'Control', status: 'confirmed', doctorName: 'Lucía Torres', specialtyName: 'Cardiología', ...overrides,
})

function accountAdapter(initialSession: Session | null = session(), listener?: (callback: (event: AuthChangeEvent, next: Session | null) => void) => void): PatientAccountAdapter {
  return {
    getSession: vi.fn().mockResolvedValue(initialSession),
    onAuthStateChange: vi.fn((callback) => { listener?.(callback); return () => undefined }),
    signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined), requestPasswordReset: vi.fn(), updatePassword: vi.fn(),
    loadAccount: vi.fn((id: string) => Promise.resolve({ profile: profile(id), preferences: { ...preferences, user_id: id } })),
    updateProfile: vi.fn(), updatePreferences: vi.fn(),
  }
}

function appointmentsAdapter(overrides: Partial<PatientAppointmentsAdapter> = {}): PatientAppointmentsAdapter {
  return {
    list: vi.fn().mockResolvedValue([appointment()]),
    cancel: vi.fn().mockResolvedValue({ ...appointment(), status: 'cancelled' }),
    reschedule: vi.fn().mockResolvedValue({ ...appointment(), date: '2026-11-06', time: '10:15:00' }),
    ...overrides,
  }
}

function availabilityAdapter(slots = [{ time: '10:15:00', durationMinutes: 45 }]): PatientAvailabilityAdapter {
  return { load: vi.fn(async ({ date }) => ({ doctorId, specialtyId, date, timeZone: 'America/Lima' as const, slots })) }
}

function renderCloud(children: React.ReactNode, adapter: PatientAppointmentsAdapter, authAdapter = accountAdapter(), reservationAdapter?: PatientReservationAdapter) {
  return render(<MemoryRouter initialEntries={[`/paciente/citas/${appointmentId}`]}><AuthProvider adapter={authAdapter}><BookingProvider appointmentsAdapter={adapter} reservationAdapter={reservationAdapter}><Routes><Route path="/paciente/citas/:id" element={children} /></Routes></BookingProvider></AuthProvider></MemoryRouter>)
}

function StateProbe() {
  const { appointments, appointmentsState, confirm, updateDraft } = useBooking()
  const auth = useAuth()
  return <><output data-testid="state">{appointmentsState.status}:{appointments.map((item) => item.code).join(',')}</output><button onClick={() => void auth.signOut()}>salir</button><button onClick={() => { updateDraft({ doctorId, specialtyId, date: '2026-11-05', time: '09:30:00', reason: '' }); void confirm() }}>reservar</button></>
}

function ConfirmationProbe() {
  const { appointments, confirm, draft, updateDraft } = useBooking()
  const [outcome, setOutcome] = useState('idle')
  const reserve = async () => {
    const result = await confirm()
    setOutcome(result.ok ? 'done' : 'error')
  }
  return <><output data-testid="confirmation-state">{outcome}:{appointments.map((item) => item.code).join(',')}:{draft.time ?? 'empty'}</output><button onClick={() => updateDraft({ doctorId, specialtyId, date: '2026-11-05', time: '09:30:00', reason: '' })}>preparar</button><button onClick={() => void reserve()}>confirmar una vez</button></>
}

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((next) => { resolve = next }); return { promise, resolve } }

afterEach(cleanup)

describe('estado cloud de citas Paciente', () => {
  it('distingue loading, ready y empty sin datos demo', async () => {
    const pending = deferred<PatientAppointment[]>()
    renderCloud(<AppointmentsPage />, appointmentsAdapter({ list: vi.fn(() => pending.promise) }))
    expect(screen.getByRole('heading', { name: /cargando tus citas/i })).toBeInTheDocument()
    await act(async () => pending.resolve([]))
    expect(await screen.findByRole('heading', { name: /aún no tienes citas/i })).toBeInTheDocument()
    expect(screen.queryByText(/demo|no registrado/i)).not.toBeInTheDocument()
  })

  it('muestra error seguro y permite reintentar', async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error('private SQL')).mockResolvedValueOnce([appointment()])
    const user = userEvent.setup()
    renderCloud(<AppointmentsPage />, appointmentsAdapter({ list }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus citas')
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(await screen.findByRole('heading', { name: 'Cardiología' })).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('limpia citas al cerrar sesión e ignora la respuesta obsoleta del usuario anterior', async () => {
    let listener!: (event: AuthChangeEvent, next: Session | null) => void
    const slow = deferred<PatientAppointment[]>()
    const list = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValueOnce([appointment({ code: 'CMA-B' })])
    const auth = accountAdapter(session(), (callback) => { listener = callback })
    const user = userEvent.setup()
    renderCloud(<StateProbe />, appointmentsAdapter({ list }), auth)
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    await act(async () => { listener('SIGNED_IN', session(secondPatientId)) })
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready:CMA-B'))
    await act(async () => slow.resolve([appointment({ code: 'CMA-OBSOLETA' })]))
    expect(screen.getByTestId('state')).toHaveTextContent('ready:CMA-B')
    await user.click(screen.getByRole('button', { name: 'salir' }))
    expect(await screen.findByTestId('state')).toHaveTextContent('ready:')
  })

  it('refresca después de reservar y no duplica la cita real', async () => {
    const real = appointment()
    const list = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([real])
    const reservation: PatientReservationData = { id: appointmentId, code: real.code, doctorId, specialtyId, date: real.date, time: real.time, durationMinutes: real.durationMinutes, status: 'confirmed' }
    const reserve = vi.fn().mockResolvedValue(reservation)
    const user = userEvent.setup()
    renderCloud(<StateProbe />, appointmentsAdapter({ list }), accountAdapter(), { reserve })
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready:'))
    await user.click(screen.getByRole('button', { name: 'reservar' }))
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready:CMA-REAL-01'))
    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('state').textContent?.match(/CMA-REAL-01/g)).toHaveLength(1)
  })

  it('hace una sola recarga posreserva y conserva las citas previas si falla', async () => {
    const list = vi.fn().mockResolvedValueOnce([appointment()]).mockRejectedValueOnce(new Error('network detail'))
    const reservation: PatientReservationData = {
      id: appointmentId, code: 'CMA-REAL-01', doctorId, specialtyId, date: '2026-11-05', time: '09:30:00', durationMinutes: 45, status: 'confirmed',
    }
    const reserve = vi.fn().mockResolvedValue(reservation)
    const user = userEvent.setup()
    renderCloud(<ConfirmationProbe />, appointmentsAdapter({ list }), accountAdapter(), { reserve })
    await waitFor(() => expect(screen.getByTestId('confirmation-state')).toHaveTextContent('idle:CMA-REAL-01:empty'))

    await user.click(screen.getByRole('button', { name: 'preparar' }))
    await waitFor(() => expect(screen.getByTestId('confirmation-state')).toHaveTextContent('09:30:00'))
    await user.click(screen.getByRole('button', { name: 'confirmar una vez' }))

    await waitFor(() => expect(screen.getByTestId('confirmation-state')).toHaveTextContent('done:CMA-REAL-01:09:30:00'))
    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('confirmation-state').textContent?.match(/CMA-REAL-01/g)).toHaveLength(1)
  })
})

describe('detalle y mutaciones cloud', () => {
  it('cancela, espera la RPC y refresca el estado real', async () => {
    const cancelled = appointment({ status: 'cancelled' })
    const adapter = appointmentsAdapter({ list: vi.fn().mockResolvedValueOnce([appointment()]).mockResolvedValueOnce([cancelled]) })
    const user = userEvent.setup()
    renderCloud(<AppointmentDetailPage />, adapter)
    await screen.findByRole('heading', { name: 'Cardiología' })
    await user.click(screen.getByRole('button', { name: /cancelar cita/i }))
    await user.click(screen.getByRole('button', { name: /sí, cancelar cita/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('quedó cancelada')
    expect(adapter.cancel).toHaveBeenCalledWith(appointmentId)
    expect(adapter.list).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
  })

  it('preserva la cita original cuando cancelar falla', async () => {
    const adapter = appointmentsAdapter({ cancel: vi.fn().mockRejectedValue(new PatientAppointmentsError('INVALID_APPOINTMENT_STATE')) })
    const user = userEvent.setup()
    renderCloud(<AppointmentDetailPage />, adapter)
    await screen.findByRole('heading', { name: 'Cardiología' })
    await user.click(screen.getByRole('button', { name: /cancelar cita/i }))
    await user.click(screen.getByRole('button', { name: /sí, cancelar cita/i }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
    expect(adapter.list).toHaveBeenCalledTimes(1)
  })

  it('reprograma mediante RPC y refresca fecha/hora', async () => {
    const moved = appointment({ date: '2026-11-06', time: '10:15:00' })
    const adapter = appointmentsAdapter({ list: vi.fn().mockResolvedValueOnce([appointment()]).mockResolvedValueOnce([moved]) })
    const availability = availabilityAdapter()
    const user = userEvent.setup()
    const view = renderCloud(<AppointmentDetailPage availabilityAdapter={availability} />, adapter)
    await screen.findByRole('heading', { name: 'Cardiología' })
    await user.click(screen.getByRole('button', { name: /^reprogramar$/i }))
    expect(view.container.querySelector('input[type="time"]')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar cambio/i })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-11-06' } })
    await user.click(await screen.findByRole('button', { name: /10:15.*45 minutos/i }))
    await user.click(screen.getByRole('button', { name: /guardar cambio/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('quedó reprogramada')
    expect(availability.load).toHaveBeenLastCalledWith({ doctorId, specialtyId, date: '2026-11-06' })
    expect(adapter.reschedule).toHaveBeenCalledWith(appointmentId, '2026-11-06', '10:15:00')
    expect(screen.getByText(/10:15 · 45 minutos/)).toBeInTheDocument()
  })

  it('conserva fecha y hora originales cuando el nuevo slot falla', async () => {
    const adapter = appointmentsAdapter({ reschedule: vi.fn().mockRejectedValue(new PatientAppointmentsError('SLOT_UNAVAILABLE')) })
    const user = userEvent.setup()
    renderCloud(<AppointmentDetailPage availabilityAdapter={availabilityAdapter()} />, adapter)
    await screen.findByRole('heading', { name: 'Cardiología' })
    await user.click(screen.getByRole('button', { name: /^reprogramar$/i }))
    await user.click(await screen.findByRole('button', { name: /10:15.*45 minutos/i }))
    await user.click(screen.getByRole('button', { name: /guardar cambio/i }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(screen.getByText(/09:30 · 45 minutos/)).toBeInTheDocument()
    expect(adapter.list).toHaveBeenCalledTimes(1)
  })

  it('limpia la hora al cambiar fecha y solo habilita Guardar con un slot real', async () => {
    const availability = availabilityAdapter()
    const user = userEvent.setup()
    renderCloud(<AppointmentDetailPage availabilityAdapter={availability} />, appointmentsAdapter())
    await screen.findByRole('heading', { name: 'Cardiología' })
    await user.click(screen.getByRole('button', { name: /^reprogramar$/i }))
    await user.click(await screen.findByRole('button', { name: /10:15.*45 minutos/i }))
    expect(screen.getByRole('button', { name: /guardar cambio/i })).toBeEnabled()

    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-11-07' } })
    expect(screen.getByRole('button', { name: /guardar cambio/i })).toBeDisabled()
    await screen.findByRole('button', { name: /10:15.*45 minutos/i })
    expect(screen.getByRole('button', { name: /guardar cambio/i })).toBeDisabled()
  })

  it('muestra error y reintento de disponibilidad sin alterar la cita original', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new PatientAvailabilityError('NETWORK_ERROR'))
      .mockResolvedValueOnce({ doctorId, specialtyId, date: '2026-11-05', timeZone: 'America/Lima', slots: [] } satisfies PatientAvailabilityData)
    const user = userEvent.setup()
    renderCloud(<AppointmentDetailPage availabilityAdapter={{ load }} />, appointmentsAdapter())
    await screen.findByRole('heading', { name: 'Cardiología' })
    await user.click(screen.getByRole('button', { name: /^reprogramar$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La cita original se conserva')
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('No hay horarios disponibles')
    expect(load).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/09:30 · 45 minutos/)).toBeInTheDocument()
  })

  it('ignora horarios obsoletos cuando la fecha cambia durante la consulta', async () => {
    const first = deferred<PatientAvailabilityData>()
    const second = deferred<PatientAvailabilityData>()
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const user = userEvent.setup()
    renderCloud(<AppointmentDetailPage availabilityAdapter={{ load }} />, appointmentsAdapter())
    await screen.findByRole('heading', { name: 'Cardiología' })
    await user.click(screen.getByRole('button', { name: /^reprogramar$/i }))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-11-07' } })
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))

    await act(async () => second.resolve({ doctorId, specialtyId, date: '2026-11-07', timeZone: 'America/Lima', slots: [{ time: '11:00:00', durationMinutes: 45 }] }))
    expect(await screen.findByRole('button', { name: /11:00.*45 minutos/i })).toBeInTheDocument()
    await act(async () => first.resolve({ doctorId, specialtyId, date: '2026-11-05', timeZone: 'America/Lima', slots: [{ time: '08:00:00', durationMinutes: 45 }] }))
    expect(screen.queryByRole('button', { name: /08:00.*45 minutos/i })).not.toBeInTheDocument()
  })
})
