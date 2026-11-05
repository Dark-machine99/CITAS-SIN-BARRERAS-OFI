import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccessibilityProvider } from '../app/providers/AccessibilityProvider'
import { BookingProvider, useBooking } from '../app/providers/BookingProvider'
import { DemoSessionProvider } from '../app/providers/DemoSessionProvider'
import { BookingPage } from '../features/booking/BookingPage'
import { VoiceAssistant } from '../features/voice/VoiceAssistant'
import type { RecognitionEventLike, RecognitionLike } from '../features/voice/speechRecognition'
import type { PatientAvailabilityAdapter } from '../services/supabase/patientAvailabilityAdapter'
import type { PatientDirectoryAdapter, PatientDirectoryData } from '../services/supabase/patientDirectoryAdapter'
import type { PatientReservationAdapter, PatientReservationData, PatientReservationInput } from '../services/supabase/patientReservationAdapter'

const specialtyId = '11111111-1111-4111-8111-111111111111'
const doctorId = '33333333-3333-4333-8333-333333333333'
const secondDoctorId = '44444444-4444-4444-8444-444444444444'
const appointmentId = '55555555-5555-4555-8555-555555555555'
const command = 'reservar cita mañana de cardiología con doctora Lucía Torres a las nueve y treinta por dolor de cabeza'

const directoryData: PatientDirectoryData = {
  specialties: [{ id: specialtyId, name: 'Cardiología', description: 'Atención cardiovascular.' }],
  doctors: [{ id: doctorId, name: 'Lucía Torres', initials: 'LT', specialtyIds: [specialtyId] }],
}

function adapters(directory = directoryData) {
  const directoryAdapter: PatientDirectoryAdapter = { load: vi.fn().mockResolvedValue(directory) }
  const availabilityAdapter: PatientAvailabilityAdapter = {
    load: vi.fn(async ({ date }) => ({
      doctorId,
      specialtyId,
      date,
      timeZone: 'America/Lima' as const,
      slots: [{ time: '09:30:00', durationMinutes: 45 }],
    })),
  }
  return { directoryAdapter, availabilityAdapter }
}

function appointment(date: string): PatientReservationData {
  return {
    id: appointmentId,
    code: 'CMA-VOZ-01',
    doctorId,
    specialtyId,
    date,
    time: '09:30:00',
    durationMinutes: 45,
    status: 'confirmed',
  }
}

function StateProbe() {
  const { draft } = useBooking()
  const location = useLocation()
  return <><output data-testid="draft">{JSON.stringify(draft)}</output><output data-testid="location">{`${location.pathname}${location.search}`}</output></>
}

function renderAssistant({
  directoryAdapter,
  availabilityAdapter,
  reservationAdapter,
}: ReturnType<typeof adapters> & { reservationAdapter: PatientReservationAdapter }) {
  return render(
    <MemoryRouter initialEntries={['/paciente']}>
      <DemoSessionProvider>
        <AccessibilityProvider>
          <BookingProvider reservationAdapter={reservationAdapter}>
            <VoiceAssistant directoryAdapter={directoryAdapter} availabilityAdapter={availabilityAdapter} />
            <StateProbe />
          </BookingProvider>
        </AccessibilityProvider>
      </DemoSessionProvider>
    </MemoryRouter>,
  )
}

async function openAndWrite(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.click(screen.getByRole('button', { name: /abrir asistente por voz/i }))
  await user.type(screen.getByRole('textbox', { name: /comando escrito/i }), value)
  await user.click(screen.getByRole('button', { name: /ejecutar comando/i }))
}

function voiceStatus() {
  const region = screen.getByRole('dialog').querySelector<HTMLElement>('.voice-status')
  if (!region) throw new Error('No se encontró el estado del asistente')
  return region
}

class FakeRecognition implements RecognitionLike {
  static transcript = command
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: RecognitionEventLike) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null

  start() {
    const transcript = FakeRecognition.transcript
    window.setTimeout(() => this.onresult?.({ results: { 0: { 0: { transcript } } } }), 0)
  }

  stop() { this.onend?.() }
}

afterEach(() => {
  cleanup()
  delete window.SpeechRecognition
  FakeRecognition.transcript = command
})

describe('límite de reserva del asistente global', () => {
  it('navega con una orden escrita breve sin consultar el resolvedor cloud', async () => {
    const user = userEvent.setup()
    const cloud = adapters()
    renderAssistant({ ...cloud, reservationAdapter: { reserve: vi.fn() } })

    await openAndWrite(user, 'reservar una cita')

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/paciente/reservar'))
    expect(within(voiceStatus()).getByText(/abriendo Reservar/i)).toBeInTheDocument()
    expect(cloud.directoryAdapter.load).not.toHaveBeenCalled()
    expect(cloud.availabilityAdapter.load).not.toHaveBeenCalled()
  })

  it('navega con reconocimiento breve sin consultar el resolvedor cloud', async () => {
    FakeRecognition.transcript = 'ir a reservar'
    window.SpeechRecognition = FakeRecognition
    const user = userEvent.setup()
    const cloud = adapters()
    renderAssistant({ ...cloud, reservationAdapter: { reserve: vi.fn() } })

    await user.click(screen.getByRole('button', { name: /abrir asistente por voz/i }))
    await user.click(screen.getByRole('button', { name: /^hablar$/i }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/paciente/reservar'))
    expect(cloud.directoryAdapter.load).not.toHaveBeenCalled()
    expect(cloud.availabilityAdapter.load).not.toHaveBeenCalled()
  })

  it('prepara una propuesta real sin reservar y exige una segunda orden explícita', async () => {
    const user = userEvent.setup()
    const cloud = adapters()
    const reserve = vi.fn(async (input: PatientReservationInput) => appointment(input.date))
    renderAssistant({ ...cloud, reservationAdapter: { reserve } })

    await openAndWrite(user, command)

    await waitFor(() => expect(screen.getByTestId('draft')).toHaveTextContent(`"specialtyId":"${specialtyId}"`))
    expect(screen.getByTestId('draft')).toHaveTextContent(`"doctorId":"${doctorId}"`)
    expect(screen.getByTestId('draft')).toHaveTextContent('"time":"09:30:00"')
    expect(screen.getByTestId('draft')).toHaveTextContent('"reason":"dolor de cabeza"')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/paciente/reservar?voice=review'))
    expect(within(voiceStatus()).getByText(/propuesta está lista para revisión/i)).toBeInTheDocument()
    expect(screen.queryByDisplayValue(command)).not.toBeInTheDocument()
    expect(reserve).not.toHaveBeenCalled()

    await user.type(screen.getByRole('textbox', { name: /comando escrito/i }), 'confirmar cita')
    await user.click(screen.getByRole('button', { name: /ejecutar comando/i }))

    await waitFor(() => expect(reserve).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`/paciente/citas/${appointmentId}`))
    await waitFor(() => expect(within(voiceStatus()).getByText(/cita confirmada con código CMA-VOZ-01/i)).toBeInTheDocument())

    await user.type(screen.getByRole('textbox', { name: /comando escrito/i }), 'confirmar cita')
    await user.click(screen.getByRole('button', { name: /ejecutar comando/i }))
    await waitFor(() => expect(within(voiceStatus()).getByText(/primero prepara una propuesta completa/i)).toBeInTheDocument())
    expect(reserve).toHaveBeenCalledTimes(1)
  })

  it('mantiene la propuesta incompleta ante ambigüedad y no reserva', async () => {
    const user = userEvent.setup()
    const cloud = adapters({
      ...directoryData,
      doctors: [
        ...directoryData.doctors,
        { id: secondDoctorId, name: 'Lucía Torres Vega', initials: 'LV', specialtyIds: [specialtyId] },
      ],
    })
    const reserve = vi.fn()
    renderAssistant({ ...cloud, reservationAdapter: { reserve } })

    await openAndWrite(user, 'reservar cita mañana de cardiología a las nueve y treinta')

    await waitFor(() => expect(within(voiceStatus()).getByText(/elige un profesional de cardiología/i)).toBeInTheDocument())
    expect(within(voiceStatus()).getByText(/lucía torres.*lucía torres vega/i)).toBeInTheDocument()
    expect(screen.getByTestId('draft')).toHaveTextContent(`"specialtyId":"${specialtyId}"`)
    expect(screen.getByTestId('draft')).toHaveTextContent('"doctorId":null')
    expect(reserve).not.toHaveBeenCalled()
  })

  it('usa el mismo resolvedor para reconocimiento del navegador', async () => {
    window.SpeechRecognition = FakeRecognition
    const user = userEvent.setup()
    const cloud = adapters()
    const reserve = vi.fn()
    renderAssistant({ ...cloud, reservationAdapter: { reserve } })

    await user.click(screen.getByRole('button', { name: /abrir asistente por voz/i }))
    await user.click(screen.getByRole('button', { name: /^hablar$/i }))

    await waitFor(() => expect(screen.getByTestId('draft')).toHaveTextContent(`"doctorId":"${doctorId}"`))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/paciente/reservar?voice=review'))
    expect(cloud.directoryAdapter.load).toHaveBeenCalledTimes(1)
    expect(cloud.availabilityAdapter.load).toHaveBeenCalledTimes(1)
    expect(reserve).not.toHaveBeenCalled()
  })

  it('salta al resumen cuando la orden se emite desde el propio wizard', async () => {
    const user = userEvent.setup()
    const cloud = adapters()
    const reserve = vi.fn()
    render(
      <MemoryRouter initialEntries={['/paciente/reservar']}>
        <DemoSessionProvider>
          <AccessibilityProvider>
            <BookingProvider reservationAdapter={{ reserve }}>
              <VoiceAssistant directoryAdapter={cloud.directoryAdapter} availabilityAdapter={cloud.availabilityAdapter} />
              <BookingPage directoryAdapter={cloud.directoryAdapter} availabilityAdapter={cloud.availabilityAdapter} />
              <StateProbe />
            </BookingProvider>
          </AccessibilityProvider>
        </DemoSessionProvider>
      </MemoryRouter>,
    )

    await openAndWrite(user, command)

    expect(await screen.findByRole('heading', { level: 1, name: /resumen/i })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/paciente/reservar?voice=review')
    expect(reserve).not.toHaveBeenCalled()
  })
})
