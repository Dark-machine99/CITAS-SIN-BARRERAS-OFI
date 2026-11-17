import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DoctorAgendaPage } from '../features/doctor/DoctorPages'
import type { DoctorAgendaAdapter, DoctorAgendaAppointment } from '../services/supabase/doctorAgendaAdapter'

const today = '2026-11-11'
const appointments: DoctorAgendaAppointment[] = [
  { id: '11111111-1111-4111-8111-111111111111', code: 'CMA-HOY', date: today, time: '09:00:00', durationMinutes: 45, status: 'confirmed', patientName: 'Ana Rojas', specialtyName: 'Cardiología' },
  { id: '22222222-2222-4222-8222-222222222222', code: 'CMA-FUTURA', date: '2026-11-12', time: '12:00:00', durationMinutes: 30, status: 'confirmed', patientName: 'Luis Vega', specialtyName: 'Neurología' },
  { id: '33333333-3333-4333-8333-333333333333', code: 'CMA-PASADA', date: '2026-11-10', time: '16:00:00', durationMinutes: 30, status: 'attended', patientName: 'Elena Díaz', specialtyName: 'Pediatría' },
]

const adapter = (list: DoctorAgendaAdapter['list']): DoctorAgendaAdapter => ({ list })
const renderAgenda = (value: DoctorAgendaAdapter) => render(<MemoryRouter><DoctorAgendaPage adapter={value} today={today} /></MemoryRouter>)

afterEach(cleanup)

describe('dashboard y agenda médica real', () => {
  it('mantiene los datos ocultos durante loading y presenta solo la agenda resuelta', async () => {
    let resolve!: (value: DoctorAgendaAppointment[]) => void
    const pending = new Promise<DoctorAgendaAppointment[]>((done) => { resolve = done })
    renderAgenda(adapter(vi.fn().mockReturnValue(pending)))

    expect(screen.getByRole('heading', { name: /cargando tu agenda/i })).toBeInTheDocument()
    expect(screen.queryByText('Ana Rojas')).not.toBeInTheDocument()
    await act(async () => { resolve(appointments); await pending })

    expect(await screen.findByText('Ana Rojas')).toBeInTheDocument()
    expect(screen.getByText('CMA-HOY')).toBeInTheDocument()
    expect(screen.queryByText('Luis Vega')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver detalle/i })).toHaveAttribute('href', '/medico/citas/11111111-1111-4111-8111-111111111111')
  })

  it('segmenta hoy, próximas e historial según America/Lima y conserva estados textuales', async () => {
    const user = userEvent.setup()
    renderAgenda(adapter(vi.fn().mockResolvedValue(appointments)))
    await screen.findByText('Ana Rojas')

    await user.click(screen.getByRole('button', { name: 'Próximas' }))
    expect(screen.getByText('Luis Vega')).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Historial' }))
    expect(screen.getByText('Elena Díaz')).toBeInTheDocument()
    expect(screen.getByText('Atendida')).toBeInTheDocument()
  })

  it('filtra desde el mini calendario con un control de teclado nativo', async () => {
    const user = userEvent.setup()
    renderAgenda(adapter(vi.fn().mockResolvedValue(appointments)))
    await screen.findByText('Ana Rojas')

    const futureDate = screen.getByRole('button', { name: /12 de noviembre de 2026, 1 cita/i })
    await user.click(futureDate)

    expect(futureDate).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Luis Vega')).toBeInTheDocument()
    expect(screen.queryByText('Ana Rojas')).not.toBeInTheDocument()
  })

  it('muestra error saneado y permite reintentar sin datos parciales', async () => {
    const user = userEvent.setup()
    const list = vi.fn().mockRejectedValueOnce(new Error('private SQL detail')).mockResolvedValueOnce(appointments)
    renderAgenda(adapter(list))

    expect(await screen.findByRole('heading', { name: /no pudimos cargar tu agenda/i })).toBeInTheDocument()
    expect(screen.queryByText(/private SQL detail/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Ana Rojas')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    expect(await screen.findByText('Ana Rojas')).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('distingue agenda vacía de filtros sin resultados', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAgenda(adapter(vi.fn().mockResolvedValue([])))
    expect(await screen.findByRole('heading', { name: /tu agenda está vacía/i })).toBeInTheDocument()
    unmount()

    renderAgenda(adapter(vi.fn().mockResolvedValue(appointments)))
    await screen.findByText('Ana Rojas')
    await user.type(screen.getByPlaceholderText(/buscar paciente/i), 'sin coincidencias')
    expect(screen.getByRole('heading', { name: /no hay citas con estos filtros/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /limpiar filtros/i }))
    expect(screen.getByText('Ana Rojas')).toBeInTheDocument()
  })
})
