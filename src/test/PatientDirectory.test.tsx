import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookingProvider, useBooking } from '../app/providers/BookingProvider'
import { AccessibilityProvider, useAccessibility } from '../app/providers/AccessibilityProvider'
import { BookingPage } from '../features/booking/BookingPage'
import { DoctorsPage, SpecialtiesPage } from '../features/patient/DirectoryPages'
import { createPatientDirectoryAdapter, type PatientDirectoryAdapter, type PatientDirectoryData } from '../services/supabase/patientDirectoryAdapter'
import type { Database } from '../types/database'
import type { PatientAvailabilityAdapter } from '../services/supabase/patientAvailabilityAdapter'

type SpecialtyResult = { data: Array<{ id: string; name: string; description: string }> | null; error: { message: string } | null }
type DoctorResult = { data: Array<{ doctor_id: string | null; first_name: string | null; last_name: string | null; specialty_id: string | null }> | null; error: { message: string } | null }

const directoryData: PatientDirectoryData = {
  specialties: [
    { id: 'specialty-cardio', name: 'Cardiología', description: 'Cuidado cardiovascular.' },
    { id: 'specialty-neuro', name: 'Neurología', description: 'Atención del sistema nervioso.' },
  ],
  doctors: [
    { id: 'doctor-lucia', name: 'Lucía Torres', initials: 'LT', specialtyIds: ['specialty-cardio', 'specialty-neuro'] },
    { id: 'doctor-mateo', name: 'Mateo Rivas', initials: 'MR', specialtyIds: ['specialty-neuro'] },
  ],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

function directoryClient(specialtyResult: Promise<SpecialtyResult> | SpecialtyResult, doctorResult: Promise<DoctorResult> | DoctorResult) {
  const order = vi.fn(() => Promise.resolve(specialtyResult))
  const eq = vi.fn(() => ({ order }))
  const specialtySelect = vi.fn(() => ({ eq }))
  const doctorSelect = vi.fn(() => Promise.resolve(doctorResult))
  const from = vi.fn((relation: string) => relation === 'specialties' ? { select: specialtySelect } : { select: doctorSelect })
  const client = { from } as unknown as SupabaseClient<Database>
  return { client, from, specialtySelect, doctorSelect, eq, order }
}

function DraftResult() {
  const { draft } = useBooking()
  const location = useLocation()
  return <div><span data-testid="draft-specialty">{draft.specialtyId ?? 'none'}</span><span data-testid="draft-doctor">{draft.doctorId ?? 'none'}</span><span data-testid="draft-date">{draft.date ?? 'none'}</span><span data-testid="draft-time">{draft.time ?? 'none'}</span><span data-testid="destination">{location.pathname}{location.search}</span></div>
}

function SeededPage({ page, adapter }: { page: 'doctors' | 'specialties'; adapter: PatientDirectoryAdapter }) {
  const { updateDraft } = useBooking()
  return <><button onClick={() => updateDraft({ specialtyId: 'specialty-neuro', doctorId: 'doctor-previous', date: '2026-11-08', time: '09:30:00' })}>Preparar borrador</button>{page === 'doctors' ? <DoctorsPage directoryAdapter={adapter} /> : <SpecialtiesPage directoryAdapter={adapter} />}</>
}

function renderDirectory(page: 'doctors' | 'specialties', adapter: PatientDirectoryAdapter) {
  const route = page === 'doctors' ? '/paciente/medicos' : '/paciente/especialidades'
  return render(<MemoryRouter initialEntries={[route]}><BookingProvider><Routes>
    <Route path={route} element={<SeededPage page={page} adapter={adapter} />} />
    <Route path="/paciente/reservar" element={<DraftResult />} />
  </Routes></BookingProvider></MemoryRouter>)
}

const unusedAvailability: PatientAvailabilityAdapter = { load: vi.fn() }

function WizardSeededDoctors({ adapter, simple }: { adapter: PatientDirectoryAdapter; simple: boolean }) {
  const { updateDraft } = useBooking()
  const { update } = useAccessibility()
  return <><button onClick={() => { updateDraft({ specialtyId: 'specialty-neuro', doctorId: 'doctor-previous', date: '2026-11-08', time: '09:30:00' }); update({ simpleMode: simple }) }}>Preparar borrador completo</button><DoctorsPage directoryAdapter={adapter} /></>
}

function renderDirectoryToWizard(simple: boolean) {
  const adapter = { load: vi.fn().mockResolvedValue(directoryData) }
  return render(<MemoryRouter initialEntries={['/paciente/medicos']}><AccessibilityProvider><BookingProvider><Routes>
    <Route path="/paciente/medicos" element={<WizardSeededDoctors adapter={adapter} simple={simple} />} />
    <Route path="/paciente/reservar" element={<BookingPage directoryAdapter={adapter} availabilityAdapter={unusedAvailability} />} />
  </Routes></BookingProvider></AccessibilityProvider></MemoryRouter>)
}

afterEach(cleanup)

describe('adapter del directorio Paciente', () => {
  it('consulta ambas proyecciones en paralelo, ordena especialidades y agrupa médicos por UUID', async () => {
    const specialties = deferred<SpecialtyResult>()
    const doctors = deferred<DoctorResult>()
    const mocked = directoryClient(specialties.promise, doctors.promise)
    const load = createPatientDirectoryAdapter(mocked.client).load()

    expect(mocked.from).toHaveBeenCalledWith('specialties')
    expect(mocked.from).toHaveBeenCalledWith('doctor_directory')
    expect(mocked.eq).toHaveBeenCalledWith('active', true)
    expect(mocked.order).toHaveBeenCalledWith('name', { ascending: true })
    expect(mocked.specialtySelect).toHaveBeenCalledWith('id, name, description')
    expect(mocked.doctorSelect).toHaveBeenCalledWith('doctor_id, first_name, last_name, specialty_id')

    specialties.resolve({ data: [
      { id: 'specialty-neuro', name: 'Neurología', description: 'Sistema nervioso' },
      { id: 'specialty-cardio', name: 'Cardiología', description: 'Corazón' },
    ], error: null })
    doctors.resolve({ data: [
      { doctor_id: 'doctor-lucia', first_name: 'Lucía', last_name: 'Torres', specialty_id: 'specialty-cardio' },
      { doctor_id: 'doctor-lucia', first_name: 'Lucía', last_name: 'Torres', specialty_id: 'specialty-neuro' },
      { doctor_id: 'doctor-lucia', first_name: 'Lucía', last_name: 'Torres', specialty_id: 'specialty-cardio' },
    ], error: null })

    await expect(load).resolves.toEqual({
      specialties: [
        { id: 'specialty-cardio', name: 'Cardiología', description: 'Corazón' },
        { id: 'specialty-neuro', name: 'Neurología', description: 'Sistema nervioso' },
      ],
      doctors: [{ id: 'doctor-lucia', name: 'Lucía Torres', initials: 'LT', specialtyIds: ['specialty-cardio', 'specialty-neuro'] }],
    })
  })

  it('normaliza errores sin filtrar detalles internos', async () => {
    const mocked = directoryClient(
      { data: null, error: { message: 'relation private.profiles leaked secret SQL' } },
      { data: [], error: null },
    )

    const load = createPatientDirectoryAdapter(mocked.client).load()
    await expect(load).rejects.toThrow('No pudimos cargar el directorio médico')
    await expect(load).rejects.not.toThrow('profiles')
  })

  it('normaliza también rechazos de transporte de cualquiera de las lecturas', async () => {
    const mocked = directoryClient(
      { data: [], error: null },
      Promise.reject(new Error('fetch failed with internal endpoint')),
    )

    await expect(createPatientDirectoryAdapter(mocked.client).load()).rejects.toThrow('No pudimos cargar el directorio médico')
  })
})

describe('páginas del directorio Paciente', () => {
  it('distingue carga y base vacía', async () => {
    const pending = deferred<PatientDirectoryData>()
    renderDirectory('specialties', { load: vi.fn(() => pending.promise) })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando especialidades')

    await act(async () => pending.resolve({ specialties: [], doctors: [] }))
    expect(await screen.findByRole('heading', { name: 'Aún no hay especialidades disponibles' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sin resultados' })).not.toBeInTheDocument()
  })

  it('muestra un error seguro y reintenta una sola carga', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('detalle SQL privado'))
      .mockResolvedValueOnce(directoryData)
    const user = userEvent.setup()
    renderDirectory('specialties', { load })

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el directorio')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Cardiología' })).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('detalle SQL privado')).not.toBeInTheDocument()
  })

  it('distingue búsqueda sin coincidencias de una base vacía', async () => {
    const user = userEvent.setup()
    renderDirectory('specialties', { load: vi.fn().mockResolvedValue(directoryData) })
    const search = await screen.findByRole('searchbox', { name: 'Buscar especialidad' })
    await user.type(search, 'pediatría')

    expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeInTheDocument()
    expect(screen.queryByText('todavía no contiene opciones activas')).not.toBeInTheDocument()
  })

  it('filtra médicos y conserva una especialidad válida al entregar UUID al draft', async () => {
    const user = userEvent.setup()
    renderDirectory('doctors', { load: vi.fn().mockResolvedValue(directoryData) })
    await screen.findByRole('heading', { name: 'Lucía Torres' })
    await user.click(screen.getByRole('button', { name: 'Preparar borrador' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar especialidad' }), 'specialty-cardio')
    expect(screen.queryByRole('heading', { name: 'Mateo Rivas' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reservar con este profesional' }))

    expect(screen.getByTestId('draft-specialty')).toHaveTextContent('specialty-cardio')
    expect(screen.getByTestId('draft-doctor')).toHaveTextContent('doctor-lucia')
    expect(screen.getByTestId('draft-date')).toHaveTextContent('none')
    expect(screen.getByTestId('draft-time')).toHaveTextContent('none')
    expect(screen.getByTestId('destination')).toHaveTextContent('/paciente/reservar?from=doctor')
  })

  it('seleccionar una especialidad elimina el médico previo del draft', async () => {
    const user = userEvent.setup()
    renderDirectory('specialties', { load: vi.fn().mockResolvedValue(directoryData) })
    await screen.findByRole('heading', { name: 'Cardiología' })
    await user.click(screen.getByRole('button', { name: 'Preparar borrador' }))
    await user.click(screen.getAllByRole('button', { name: 'Elegir especialidad' })[0]!)

    expect(screen.getByTestId('draft-specialty')).toHaveTextContent('specialty-cardio')
    expect(screen.getByTestId('draft-doctor')).toHaveTextContent('none')
    expect(screen.getByTestId('draft-date')).toHaveTextContent('none')
    expect(screen.getByTestId('draft-time')).toHaveTextContent('none')
  })

  it.each([
    { simple: true, heading: /paso 2: fecha y hora/i, progress: /paso 2 de 3/i },
    { simple: false, heading: /^fecha$/i, progress: /paso 3 de 7/i },
  ])('un médico elegido con draft completo abre el paso de fecha sin datos obsoletos ($simple)', async ({ simple, heading, progress }) => {
    const user = userEvent.setup()
    renderDirectoryToWizard(simple)
    await screen.findByRole('heading', { name: 'Lucía Torres' })
    await user.click(screen.getByRole('button', { name: 'Preparar borrador completo' }))
    await user.click(screen.getAllByRole('button', { name: 'Reservar con este profesional' })[0]!)

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.getByText(progress)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /09:30/i })).not.toBeInTheDocument()
  })

  it('ignora una respuesta obsoleta después de cambiar de carga', async () => {
    const slow = deferred<PatientDirectoryData>()
    const fastData: PatientDirectoryData = { specialties: [{ id: 'fast', name: 'Rápida', description: 'Actual' }], doctors: [] }
    const slowAdapter = { load: vi.fn(() => slow.promise) }
    const fastAdapter = { load: vi.fn().mockResolvedValue(fastData) }
    const view = render(<MemoryRouter><BookingProvider><SpecialtiesPage directoryAdapter={slowAdapter} /></BookingProvider></MemoryRouter>)

    view.rerender(<MemoryRouter><BookingProvider><SpecialtiesPage directoryAdapter={fastAdapter} /></BookingProvider></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Rápida' })).toBeInTheDocument()
    await act(async () => slow.resolve({ specialties: [{ id: 'slow', name: 'Obsoleta', description: 'Anterior' }], doctors: [] }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Obsoleta' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Rápida' })).toBeInTheDocument()
  })
})
