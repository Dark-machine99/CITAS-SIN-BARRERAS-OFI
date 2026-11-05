import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccessibilityProvider } from '../app/providers/AccessibilityProvider'
import { BookingProvider, useBooking } from '../app/providers/BookingProvider'
import { BookingPage } from '../features/booking/BookingPage'
import { PatientTutorialProvider, usePatientTutorial } from '../features/tutorial/PatientTutorialProvider'
import { PatientTutorialVoicePractice } from '../features/tutorial/PatientTutorialVoicePractice'
import { BookingDictationPanel } from '../features/voice/BookingDictationPanel'
import type { RecognitionConstructor, RecognitionEventLike, RecognitionLike } from '../features/voice/speechRecognition'
import { patientTutorialAvailabilityAdapter, patientTutorialDirectoryAdapter, tutorialDoctorId, tutorialSpecialtyId } from '../services/tutorial/patientTutorialBookingAdapter'
import type { PatientAvailabilityAdapter } from '../services/supabase/patientAvailabilityAdapter'
import type { PatientDirectoryAdapter } from '../services/supabase/patientDirectoryAdapter'
import type { PatientReservationAdapter } from '../services/supabase/patientReservationAdapter'
import type { PatientTutorialProgress, PatientTutorialProgressAdapter, PatientTutorialProgressWrite } from '../services/supabase/patientTutorialProgressAdapter'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const userA = '11111111-1111-4111-8111-111111111111'
const userB = '22222222-2222-4222-8222-222222222222'
const tutorialTime = '2026-11-04T12:00:00.000Z'

function progress(status: PatientTutorialProgress['status'], currentStep: number, userId: string): PatientTutorialProgress {
  return { userId, tutorialVersion: 1, status, currentStep, startedAt: tutorialTime, finishedAt: status === 'completed' ? tutorialTime : null, createdAt: tutorialTime, updatedAt: tutorialTime }
}

function savedProgress(userId: string, write: PatientTutorialProgressWrite): PatientTutorialProgress {
  return { userId, tutorialVersion: write.tutorialVersion, status: write.status, currentStep: write.currentStep, startedAt: write.startedAt, finishedAt: write.finishedAt, createdAt: tutorialTime, updatedAt: tutorialTime }
}

function tutorialProgressAdapter(): PatientTutorialProgressAdapter {
  return {
    load: vi.fn(async (userId) => userId === userA ? progress('in_progress', 3, userId) : progress('completed', 12, userId)),
    create: vi.fn(async (userId, write) => savedProgress(userId, write)),
    update: vi.fn(async (userId, write) => savedProgress(userId, write)),
  }
}

function ExitTutorialButton() {
  const tutorial = usePatientTutorial()
  return <button onClick={tutorial.exit}>Salir de la práctica</button>
}

function BookingDraftProbe() {
  const booking = useBooking()
  return <output data-testid="booking-drafts">{JSON.stringify({ live: booking.draft, tutorial: booking.tutorialDraft })}</output>
}

function TutorialBookingHarness({ activeUserId, adapter, reservationAdapter }: { activeUserId: string; adapter: PatientTutorialProgressAdapter; reservationAdapter: PatientReservationAdapter }) {
  return <MemoryRouter initialEntries={['/paciente/reservar']}><AccessibilityProvider><BookingProvider reservationAdapter={reservationAdapter}>
    <PatientTutorialProvider userId={activeUserId} adapter={adapter} now={() => tutorialTime}>
      <BookingPage directoryAdapter={patientTutorialDirectoryAdapter} availabilityAdapter={patientTutorialAvailabilityAdapter} now={new Date('2026-11-04T16:00:00Z')} />
      <ExitTutorialButton /><BookingDraftProbe />
    </PatientTutorialProvider>
  </BookingProvider></AccessibilityProvider></MemoryRouter>
}

async function completeTutorialBooking(user: ReturnType<typeof userEvent.setup>) {
  expect(await screen.findByText('MODO PRÁCTICA')).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: /medicina general/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(await screen.findByRole('button', { name: /elena práctica/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(document.querySelector<HTMLButtonElement>('.date-grid button')!)
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(await screen.findByRole('button', { name: /09:00.*30 minutos/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(screen.getByRole('button', { name: /continuar/i }))
  await user.click(screen.getByRole('button', { name: /^confirmar cita$/i }))
  expect(await screen.findByRole('heading', { name: /la simulación terminó correctamente/i })).toBeInTheDocument()
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

function DictationScope({ scope, directoryAdapter, availabilityAdapter, onProposal }: { scope: string; directoryAdapter: PatientDirectoryAdapter; availabilityAdapter: PatientAvailabilityAdapter; onProposal?: () => void }) {
  const booking = useBooking()
  return <>
    <BookingDictationPanel key={scope} draft={booking.tutorialDraft} directoryAdapter={directoryAdapter} availabilityAdapter={availabilityAdapter} onProposal={(draft) => { onProposal?.(); booking.updateTutorialDraft(draft) }} />
    <output data-testid="dictation-draft">{JSON.stringify(booking.tutorialDraft)}</output>
  </>
}

function TutorialBookingProbe() {
  const booking = useBooking()
  const confirm = async () => {
    const result = await booking.confirmTutorial()
    document.getElementById('tutorial-result')!.textContent = result.appointment.code
  }
  return <>
    <span data-testid="live-reason">{booking.draft.reason || 'vacío'}</span>
    <span data-testid="tutorial-reason">{booking.tutorialDraft.reason || 'vacío'}</span>
    <span id="tutorial-result" />
    <button onClick={() => booking.updateTutorialDraft({ specialtyId: tutorialSpecialtyId, doctorId: tutorialDoctorId, date: '2026-11-05', time: '09:00:00', reason: 'motivo ficticio' })}>Preparar práctica</button>
    <button onClick={() => void confirm()}>Confirmar práctica</button>
    <button onClick={booking.resetTutorialDraft}>Limpiar práctica</button>
  </>
}

describe('reserva aislada del tutorial Paciente', () => {
  it('usa catálogo y horarios sintéticos sin invocar el adapter de reserva live', async () => {
    const reserve = vi.fn<PatientReservationAdapter['reserve']>()
    const user = userEvent.setup()
    render(<BookingProvider reservationAdapter={{ reserve }}><TutorialBookingProbe /></BookingProvider>)

    const directory = await patientTutorialDirectoryAdapter.load()
    const availability = await patientTutorialAvailabilityAdapter.load({ doctorId: tutorialDoctorId, specialtyId: tutorialSpecialtyId, date: '2026-11-05' })
    expect(directory.doctors[0]?.name).toBe('Dra. Elena Práctica')
    expect(availability.slots).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Preparar práctica' }))
    expect(screen.getByTestId('tutorial-reason')).toHaveTextContent('motivo ficticio')
    expect(screen.getByTestId('live-reason')).toHaveTextContent('vacío')
    await user.click(screen.getByRole('button', { name: 'Confirmar práctica' }))

    await waitFor(() => expect(document.getElementById('tutorial-result')).toHaveTextContent('PRÁCTICA-LOCAL'))
    expect(reserve).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Limpiar práctica' }))
    expect(screen.getByTestId('tutorial-reason')).toHaveTextContent('vacío')
  })

  it('elimina resultado y wizard al salir de práctica sin confirmar una cita live', async () => {
    const reserve = vi.fn<PatientReservationAdapter['reserve']>()
    const adapter = tutorialProgressAdapter()
    const user = userEvent.setup()
    render(<TutorialBookingHarness activeUserId={userA} adapter={adapter} reservationAdapter={{ reserve }} />)

    await completeTutorialBooking(user)
    await user.click(screen.getByRole('button', { name: 'Salir de la práctica' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Especialidad' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /simulación terminó/i })).not.toBeInTheDocument()
    expect(screen.queryByText('PRÁCTICA-LOCAL')).not.toBeInTheDocument()
    expect(screen.getByTestId('booking-drafts')).toHaveTextContent('"tutorial":{"specialtyId":null')
    expect(reserve).not.toHaveBeenCalled()
  })

  it('elimina resultado y reinicia wizard al cambiar de identidad sin confirmación live', async () => {
    const reserve = vi.fn<PatientReservationAdapter['reserve']>()
    const adapter = tutorialProgressAdapter()
    const user = userEvent.setup()
    const view = render(<TutorialBookingHarness activeUserId={userA} adapter={adapter} reservationAdapter={{ reserve }} />)

    await completeTutorialBooking(user)
    view.rerender(<TutorialBookingHarness activeUserId={userB} adapter={adapter} reservationAdapter={{ reserve }} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Especialidad' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /simulación terminó/i })).not.toBeInTheDocument()
    expect(screen.queryByText('PRÁCTICA-LOCAL')).not.toBeInTheDocument()
    expect(reserve).not.toHaveBeenCalled()
  })
})

describe('ciclo de vida del dictado asistido', () => {
  it('ignora una resolución tardía tras cambiar de identidad visual', async () => {
    const directory = deferred<Awaited<ReturnType<PatientDirectoryAdapter['load']>>>()
    const directoryAdapter: PatientDirectoryAdapter = { load: vi.fn(() => directory.promise) }
    const onProposal = vi.fn()
    const user = userEvent.setup()
    const view = render(<BookingProvider><DictationScope scope="usuario-a:tutorial" directoryAdapter={directoryAdapter} availabilityAdapter={patientTutorialAvailabilityAdapter} onProposal={onProposal} /></BookingProvider>)

    await user.click(screen.getByRole('button', { name: /reserva asistida por voz/i }))
    await user.type(screen.getByRole('textbox', { name: /tu solicitud/i }), 'reservar una cita de medicina general mañana a las 9')
    await user.click(screen.getByRole('button', { name: /^preparar$/i }))
    view.rerender(<BookingProvider><DictationScope scope="usuario-b:live" directoryAdapter={directoryAdapter} availabilityAdapter={patientTutorialAvailabilityAdapter} onProposal={onProposal} /></BookingProvider>)
    await act(async () => directory.resolve(await patientTutorialDirectoryAdapter.load()))

    await waitFor(() => expect(onProposal).not.toHaveBeenCalled())
    expect(screen.getByTestId('dictation-draft')).toHaveTextContent('"specialtyId":null')
    await user.click(screen.getByRole('button', { name: /reserva asistida por voz/i }))
    expect(screen.getByRole('textbox', { name: /tu solicitud/i })).toHaveValue('')
  })

  it('detiene y desacopla el reconocimiento al desmontar el alcance', async () => {
    const recognition: RecognitionLike = {
      lang: '',
      continuous: false,
      interimResults: false,
      start: vi.fn(),
      stop: vi.fn(),
      onresult: null as ((event: RecognitionEventLike) => void) | null,
      onerror: null,
      onend: null,
    }
    const FakeRecognition = function () { return recognition } as unknown as RecognitionConstructor
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    const onProposal = vi.fn()
    const user = userEvent.setup()
    const view = render(<BookingProvider><DictationScope scope="usuario-a:tutorial" directoryAdapter={patientTutorialDirectoryAdapter} availabilityAdapter={patientTutorialAvailabilityAdapter} onProposal={onProposal} /></BookingProvider>)

    await user.click(screen.getByRole('button', { name: /reserva asistida por voz/i }))
    await user.click(screen.getByRole('button', { name: /dictar solicitud/i }))
    expect(recognition.start).toHaveBeenCalledOnce()
    const queuedResult = recognition.onresult
    view.rerender(<BookingProvider><DictationScope scope="usuario-b:live" directoryAdapter={patientTutorialDirectoryAdapter} availabilityAdapter={patientTutorialAvailabilityAdapter} onProposal={onProposal} /></BookingProvider>)

    expect(recognition.stop).toHaveBeenCalledOnce()
    expect(recognition.onresult).toBeNull()
    expect(recognition.onerror).toBeNull()
    expect(recognition.onend).toBeNull()
    queuedResult?.({ results: { 0: { 0: { transcript: 'reservar una cita de medicina general mañana a las 9' } } } })
    await act(async () => { await Promise.resolve() })
    expect(onProposal).not.toHaveBeenCalled()
    expect(screen.getByTestId('dictation-draft')).toHaveTextContent('"specialtyId":null')
  })
})

describe('práctica transitoria de voz', () => {
  it('acepta navegación con el parser real sin cambiar de ruta', async () => {
    const complete = vi.fn()
    const user = userEvent.setup()
    render(<PatientTutorialVoicePractice kind="voice-navigation" onComplete={complete} />)

    await user.type(screen.getByLabelText('Comando de práctica'), 'ir a mis citas')
    await user.click(screen.getByRole('button', { name: /Probar texto/ }))
    expect(await screen.findByText(/Comando reconocido: abrir Mis citas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar tutorial' }))
    expect(complete).toHaveBeenCalledOnce()
  })

  it('resuelve una propuesta detallada solo contra datos sintéticos', async () => {
    const complete = vi.fn()
    const user = userEvent.setup()
    render(<PatientTutorialVoicePractice kind="voice-booking" onComplete={complete} />)

    await user.type(screen.getByLabelText('Comando de práctica'), 'reservar una cita de medicina general mañana a las 9 por control')
    await user.click(screen.getByRole('button', { name: /Probar texto/ }))
    expect(await screen.findByText(/Esta propuesta no modificó ningún borrador/)).toBeInTheDocument()
    expect(screen.getAllByText(/Dra. Elena Práctica/)).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Continuar tutorial' }))
    expect(complete).toHaveBeenCalledOnce()
  })
})
