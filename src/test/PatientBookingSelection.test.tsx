import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccessibilityProvider } from '../app/providers/AccessibilityProvider'
import { BookingProvider, useBooking } from '../app/providers/BookingProvider'
import { BookingPage } from '../features/booking/BookingPage'
import { PatientAvailabilityError, type PatientAvailabilityAdapter, type PatientAvailabilityData } from '../services/supabase/patientAvailabilityAdapter'
import type { PatientDirectoryAdapter, PatientDirectoryData } from '../services/supabase/patientDirectoryAdapter'
import { PatientReservationError, type PatientReservationAdapter, type PatientReservationData } from '../services/supabase/patientReservationAdapter'

const cardioId = '11111111-1111-4111-8111-111111111111'
const neuroId = '22222222-2222-4222-8222-222222222222'
const doctorId = '33333333-3333-4333-8333-333333333333'
const secondDoctorId = '44444444-4444-4444-8444-444444444444'
const appointmentId = '55555555-5555-4555-8555-555555555555'
const directoryData: PatientDirectoryData = {
  specialties: [
    { id: cardioId, name: 'Cardiología', description: 'Atención cardiovascular.' },
    { id: neuroId, name: 'Neurología', description: 'Atención neurológica.' },
  ],
  doctors: [
    { id: doctorId, name: 'Lucía Torres', initials: 'LT', specialtyIds: [cardioId] },
    { id: secondDoctorId, name: 'Mateo Rivas', initials: 'MR', specialtyIds: [neuroId] },
  ],
}
const now = new Date('2026-10-28T16:00:00.000Z')

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

function availability(date: string, slots: PatientAvailabilityData['slots'] = [{ time: '09:30:00', durationMinutes: 45 }]): PatientAvailabilityData {
  return { doctorId, specialtyId: cardioId, date, timeZone: 'America/Lima', slots }
}

function DraftProbe() {
  const { draft } = useBooking()
  return <output data-testid="draft">{JSON.stringify(draft)}</output>
}

function renderBooking(directoryAdapter: PatientDirectoryAdapter, availabilityAdapter: PatientAvailabilityAdapter, reservationAdapter?: PatientReservationAdapter) {
  return render(<MemoryRouter><AccessibilityProvider><BookingProvider reservationAdapter={reservationAdapter}><BookingPage directoryAdapter={directoryAdapter} availabilityAdapter={availabilityAdapter} now={now} /><DraftProbe /></BookingProvider></AccessibilityProvider></MemoryRouter>)
}

function adapters(loadSlots: PatientAvailabilityAdapter['load']) {
  return {
    directory: { load: vi.fn().mockResolvedValue(directoryData) },
    availability: { load: vi.fn(loadSlots) },
  }
}

async function chooseDoctorAndReachDate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /cardiología/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(await screen.findByRole('button', { name: /lucía torres/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
}

function reservation(date = '2026-10-29'): PatientReservationData {
  return { id: appointmentId, code: 'CMA-OPACO-01', doctorId, specialtyId: cardioId, date, time: '09:30:00', durationMinutes: 45, status: 'confirmed' }
}

async function reachConfirmation(user: ReturnType<typeof userEvent.setup>, simple: boolean) {
  if (simple) await user.click(screen.getByRole('checkbox', { name: /modo simple/i }))
  await user.click(await screen.findByRole('button', { name: /cardiología/i }))
  if (!simple) await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(await screen.findByRole('button', { name: /lucía torres/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(screen.getByRole('button', { name: /29.*oct/i }))
  if (!simple) await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(await screen.findByRole('button', { name: /09:30.*45 minutos/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  if (!simple) {
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))
  }
  expect(screen.getByRole('heading', { name: /todo listo para confirmar/i })).toBeInTheDocument()
}

afterEach(cleanup)

describe('selección cloud del wizard Paciente', () => {
  it('usa directorio cloud y muestra únicamente hora y duración devueltas por la RPC', async () => {
    const user = userEvent.setup()
    const mocked = adapters(async ({ date }) => availability(date))
    renderBooking(mocked.directory, mocked.availability)
    await chooseDoctorAndReachDate(user)
    await user.click(screen.getByRole('button', { name: /29.*oct/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(await screen.findByRole('button', { name: /09:30.*45 minutos/i })).toBeInTheDocument()
    expect(mocked.availability.load).toHaveBeenCalledWith({ doctorId, specialtyId: cardioId, date: '2026-10-29' })
    expect(screen.queryByText('10:30')).not.toBeInTheDocument()
  })

  it('comparte la misma carga en modo simple y conserva la agrupación de tres pasos', async () => {
    const user = userEvent.setup()
    const mocked = adapters(async ({ date }) => availability(date))
    renderBooking(mocked.directory, mocked.availability)
    await user.click(screen.getByRole('checkbox', { name: /modo simple/i }))
    await user.click(await screen.findByRole('button', { name: /cardiología/i }))
    await user.click(screen.getByRole('button', { name: /lucía torres/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(screen.getByRole('button', { name: /29.*oct/i }))

    expect(await screen.findByRole('button', { name: /09:30.*45 minutos/i })).toBeInTheDocument()
    expect(screen.getByText(/paso 2 de 3/i)).toBeInTheDocument()
    expect(mocked.directory.load).toHaveBeenCalledTimes(1)
  })

  it('prepara en el mismo draft una propuesta de voz resuelta contra datos cloud', async () => {
    const user = userEvent.setup()
    const mocked = adapters(async ({ date }) => availability(date))
    renderBooking(mocked.directory, mocked.availability)
    await user.click(screen.getByRole('button', { name: /reserva asistida por voz/i }))
    await user.type(screen.getByRole('textbox', { name: /tu solicitud/i }), 'reservar cita mañana de cardiología con doctora Lucía Torres a las nueve y treinta por dolor de cabeza')
    await user.click(screen.getByRole('button', { name: /^preparar$/i }))

    await waitFor(() => expect(screen.getByTestId('draft')).toHaveTextContent(`"specialtyId":"${cardioId}"`))
    expect(screen.getByTestId('draft')).toHaveTextContent(`"doctorId":"${doctorId}"`)
    expect(screen.getByTestId('draft')).not.toHaveTextContent('"date":null')
    expect(screen.getByTestId('draft')).toHaveTextContent('"time":"09:30:00"')
    expect(screen.getByTestId('draft')).toHaveTextContent('"reason":"dolor de cabeza"')
    expect(screen.getByText(/revisa el resumen y confirma con el botón visible/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: /resumen/i })).toBeInTheDocument()
    expect(mocked.availability.load).toHaveBeenCalled()
  })

  it('limpia médico, fecha y hora cuando cambia la especialidad', async () => {
    const user = userEvent.setup()
    const mocked = adapters(async ({ date }) => availability(date))
    renderBooking(mocked.directory, mocked.availability)
    await chooseDoctorAndReachDate(user)
    await user.click(screen.getByRole('button', { name: /29.*oct/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(await screen.findByRole('button', { name: /09:30.*45 minutos/i }))
    await user.click(screen.getByRole('button', { name: /anterior/i }))
    await user.click(screen.getByRole('button', { name: /anterior/i }))
    await user.click(screen.getByRole('button', { name: /anterior/i }))
    await user.click(screen.getByRole('button', { name: /neurología/i }))

    expect(screen.getByTestId('draft')).toHaveTextContent(`"specialtyId":"${neuroId}"`)
    expect(screen.getByTestId('draft')).toHaveTextContent('"doctorId":null')
    expect(screen.getByTestId('draft')).toHaveTextContent('"date":null')
    expect(screen.getByTestId('draft')).toHaveTextContent('"time":null')
  })

  it('distingue sin slots de error de sesión y permite un único reintento', async () => {
    const user = userEvent.setup()
    const load = vi.fn()
      .mockRejectedValueOnce(new PatientAvailabilityError('UNAUTHORIZED'))
      .mockResolvedValueOnce(availability('2026-10-29', []))
    const mocked = adapters(load)
    renderBooking(mocked.directory, mocked.availability)
    await chooseDoctorAndReachDate(user)
    await user.click(screen.getByRole('button', { name: /29.*oct/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/sesión no permite consultar horarios/i)
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(await screen.findByText(/no hay horarios disponibles para esta fecha/i)).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('ignora la respuesta obsoleta de una fecha anterior', async () => {
    const user = userEvent.setup()
    const first = deferred<PatientAvailabilityData>()
    const second = deferred<PatientAvailabilityData>()
    const mocked = adapters(vi.fn(({ date }) => date === '2026-10-29' ? first.promise : second.promise))
    renderBooking(mocked.directory, mocked.availability)
    await chooseDoctorAndReachDate(user)
    await user.click(screen.getByRole('button', { name: /29.*oct/i }))
    await user.click(screen.getByRole('button', { name: /30.*oct/i }))
    await act(async () => second.resolve(availability('2026-10-30', [{ time: '11:00:00', durationMinutes: 30 }])))
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(await screen.findByRole('button', { name: /11:00.*30 minutos/i })).toBeInTheDocument()

    await act(async () => first.resolve(availability('2026-10-29', [{ time: '08:00:00', durationMinutes: 20 }])))
    await waitFor(() => expect(screen.queryByRole('button', { name: /08:00.*20 minutos/i })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /11:00.*30 minutos/i })).toBeInTheDocument()
  })

  it('inicia una generación nueva al volver A→B→A y no reutiliza los slots A anteriores', async () => {
    const user = userEvent.setup()
    const secondA = deferred<PatientAvailabilityData>()
    const pendingB = deferred<PatientAvailabilityData>()
    let aCalls = 0
    const load = vi.fn(({ date }: { date: string }) => {
      if (date === '2026-10-29') {
        aCalls += 1
        return aCalls === 1 ? Promise.resolve(availability(date)) : secondA.promise
      }
      return pendingB.promise
    })
    const mocked = adapters(load)
    renderBooking(mocked.directory, mocked.availability)
    await chooseDoctorAndReachDate(user)
    await user.click(screen.getByRole('button', { name: /29.*oct/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(await screen.findByRole('button', { name: /09:30.*45 minutos/i }))
    await user.click(screen.getByRole('button', { name: /anterior/i }))

    await user.click(screen.getByRole('button', { name: /30.*oct/i }))
    await user.click(screen.getByRole('button', { name: /29.*oct/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByText(/consultando horarios disponibles/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /09:30.*45 minutos/i })).not.toBeInTheDocument()
    await act(async () => secondA.resolve(availability('2026-10-29', [])))
    expect(await screen.findByText(/no hay horarios disponibles para esta fecha/i)).toBeInTheDocument()
    expect(screen.getByTestId('draft')).toHaveTextContent('"time":null')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/elige una hora disponible/i)
    expect(screen.getByRole('heading', { level: 1, name: /hora/i })).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['estándar', false],
    ['simple', true],
  ] as const)('usa la misma confirmación cloud y datos reales en modo %s', async (_label, simple) => {
    const user = userEvent.setup()
    const mocked = adapters(async ({ date }) => availability(date))
    const reserve = vi.fn().mockResolvedValue(reservation())
    renderBooking(mocked.directory, mocked.availability, { reserve })
    await reachConfirmation(user, simple)

    await user.click(screen.getByRole('button', { name: /^confirmar cita$/i }))

    expect(await screen.findByRole('heading', { name: /tu cita está confirmada/i })).toBeInTheDocument()
    expect(screen.getByText('CMA-OPACO-01')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(appointmentId))).toBeInTheDocument()
    expect(screen.getByText(/45 minutos/i)).toBeInTheDocument()
    expect(screen.getByText(/^Confirmada$/i)).toBeInTheDocument()
    expect(reserve).toHaveBeenCalledTimes(1)
    expect(reserve).toHaveBeenCalledWith({ doctorId, specialtyId: cardioId, date: '2026-10-29', time: '09:30:00', reason: '' })
  })

  it('conserva selecciones válidas y recarga horarios cuando el slot entra en conflicto', async () => {
    const user = userEvent.setup()
    const load = vi.fn()
      .mockResolvedValueOnce(availability('2026-10-29'))
      .mockResolvedValueOnce(availability('2026-10-29', []))
    const mocked = adapters(load)
    const reserve = vi.fn().mockRejectedValue(new PatientReservationError('SLOT_UNAVAILABLE'))
    renderBooking(mocked.directory, mocked.availability, { reserve })
    await reachConfirmation(user, true)

    await user.click(screen.getByRole('button', { name: /^confirmar cita$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/acaba de dejar de estar disponible/i)
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('draft')).toHaveTextContent(`"specialtyId":"${cardioId}"`)
    expect(screen.getByTestId('draft')).toHaveTextContent(`"doctorId":"${doctorId}"`)
    expect(screen.getByTestId('draft')).toHaveTextContent('"date":"2026-10-29"')
    expect(screen.getByTestId('draft')).toHaveTextContent('"time":null')
    expect(screen.queryByRole('heading', { name: /tu cita está confirmada/i })).not.toBeInTheDocument()
  })

  it('presenta el error de identidad sin inventar una confirmación', async () => {
    const user = userEvent.setup()
    const mocked = adapters(async ({ date }) => availability(date))
    const reserve = vi.fn().mockRejectedValue(new PatientReservationError('UNAUTHORIZED'))
    renderBooking(mocked.directory, mocked.availability, { reserve })
    await reachConfirmation(user, true)

    await user.click(screen.getByRole('button', { name: /^confirmar cita$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/sesión no permite confirmar/i)
    expect(screen.queryByRole('heading', { name: /tu cita está confirmada/i })).not.toBeInTheDocument()
    expect(reserve).toHaveBeenCalledTimes(1)
  })
})
