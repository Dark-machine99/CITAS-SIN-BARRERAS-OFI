import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DoctorAppointmentDetailPage } from '../features/doctor/DoctorPages'
import { DoctorAppointmentDetailError, type DoctorAppointmentDetail, type DoctorAppointmentDetailAdapter } from '../services/supabase/doctorAppointmentDetailAdapter'

const appointmentId = '11111111-1111-4111-8111-111111111111'
const secondAppointmentId = '22222222-2222-4222-8222-222222222222'
const confirmed: DoctorAppointmentDetail = {
  id: appointmentId,
  code: 'CMA-DETAIL-01',
  date: '2026-11-11',
  time: '09:30:00',
  durationMinutes: 45,
  status: 'confirmed',
  patientName: 'Ana Rojas',
  specialtyName: 'Cardiología',
}

const adapter = (load: DoctorAppointmentDetailAdapter['load'], setOutcome = vi.fn().mockResolvedValue(undefined)): DoctorAppointmentDetailAdapter => ({ load, setOutcome })
const renderDetail = (value: DoctorAppointmentDetailAdapter, route = `/medico/citas/${appointmentId}`, navigation = false) => render(
  <MemoryRouter initialEntries={[route]}>{navigation ? <Link to={`/medico/citas/${secondAppointmentId}`}>Abrir segunda cita</Link> : null}<Routes><Route path="/medico/citas/:id" element={<DoctorAppointmentDetailPage adapter={value} />} /></Routes></MemoryRouter>,
)

afterEach(cleanup)

describe('detalle real y resultado de cita médica', () => {
  it('oculta datos durante loading y muestra solo la proyección clínica mínima', async () => {
    let resolve!: (value: DoctorAppointmentDetail) => void
    const pending = new Promise<DoctorAppointmentDetail>((done) => { resolve = done })
    renderDetail(adapter(vi.fn().mockReturnValue(pending)))

    expect(screen.getByRole('heading', { name: /cargando detalle/i })).toBeInTheDocument()
    expect(screen.queryByText('Ana Rojas')).not.toBeInTheDocument()
    await act(async () => { resolve(confirmed); await pending })

    expect(await screen.findByRole('heading', { name: 'Ana Rojas' })).toBeInTheDocument()
    expect(screen.getAllByText('Cardiología')).toHaveLength(2)
    expect(screen.getByText('09:30')).toBeInTheDocument()
    expect(screen.queryByText(/motivo|diagnóstico|receta|historia clínica/i)).not.toBeInTheDocument()
  })

  it('presenta cita ausente o bloqueada por RLS sin revelar su existencia', async () => {
    renderDetail(adapter(vi.fn().mockRejectedValue(new DoctorAppointmentDetailError('APPOINTMENT_NOT_FOUND'))))

    expect(await screen.findByRole('heading', { name: /cita no disponible/i })).toBeInTheDocument()
    expect(screen.getByText(/no existe una cita disponible.*o tu cuenta no puede verla/i)).toBeInTheDocument()
  })

  it('muestra error saneado y reintenta la carga', async () => {
    const user = userEvent.setup()
    const load = vi.fn().mockRejectedValueOnce(new Error('private SQL detail')).mockResolvedValueOnce(confirmed)
    renderDetail(adapter(load))

    expect(await screen.findByRole('heading', { name: /no pudimos cargar la cita/i })).toBeInTheDocument()
    expect(screen.queryByText(/private SQL detail/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    expect(await screen.findByRole('heading', { name: 'Ana Rojas' })).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('cancela el modal con Escape y devuelve el foco al disparador correcto', async () => {
    const user = userEvent.setup()
    renderDetail(adapter(vi.fn().mockResolvedValue(confirmed)))
    await screen.findByRole('heading', { name: 'Ana Rojas' })
    const trigger = screen.getByRole('button', { name: 'No asistió' })

    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: /confirma el resultado/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it.each([
    ['Atendido', 'attended'],
    ['No asistió', 'no_show'],
  ] as const)('registra %s, bloquea doble envío y recarga el estado terminal', async (buttonName, outcome) => {
    const user = userEvent.setup()
    let resolveOutcome!: () => void
    const pendingOutcome = new Promise<void>((resolve) => { resolveOutcome = resolve })
    const setOutcome = vi.fn(() => pendingOutcome)
    const terminal = { ...confirmed, status: outcome } as DoctorAppointmentDetail
    const load = vi.fn().mockResolvedValueOnce(confirmed).mockResolvedValueOnce(terminal)
    renderDetail(adapter(load, setOutcome))
    await screen.findByRole('heading', { name: 'Ana Rojas' })

    await user.click(screen.getByRole('button', { name: buttonName }))
    const confirmButton = screen.getByRole('button', { name: /confirmar resultado/i })
    await user.click(confirmButton)
    await user.click(confirmButton)
    expect(setOutcome).toHaveBeenCalledTimes(1)
    expect(setOutcome).toHaveBeenCalledWith(appointmentId, outcome)
    expect(confirmButton).toBeDisabled()
    await act(async () => { resolveOutcome(); await pendingOutcome })

    expect(await screen.findByRole('status')).toHaveTextContent(`Resultado registrado: ${buttonName}.`)
    expect(screen.getByText(outcome === 'attended' ? 'Atendida' : 'Inasistencia')).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'Atendido' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Resultado de la cita' })).toHaveFocus())
  })

  it('conserva el modal y comunica un rechazo elegible sin filtrar detalles', async () => {
    const user = userEvent.setup()
    const setOutcome = vi.fn().mockRejectedValue(new DoctorAppointmentDetailError('APPOINTMENT_NOT_YET_ELIGIBLE'))
    renderDetail(adapter(vi.fn().mockResolvedValue(confirmed), setOutcome))
    await screen.findByRole('heading', { name: 'Ana Rojas' })

    await user.click(screen.getByRole('button', { name: 'Atendido' }))
    await user.click(screen.getByRole('button', { name: /confirmar resultado/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/cuando comience la hora clínica/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('recarga ante conflicto terminal y no conserva controles operables', async () => {
    const user = userEvent.setup()
    const setOutcome = vi.fn().mockRejectedValue(new DoctorAppointmentDetailError('APPOINTMENT_OUTCOME_CONFLICT'))
    const load = vi.fn().mockResolvedValueOnce(confirmed).mockResolvedValueOnce({ ...confirmed, status: 'no_show' })
    renderDetail(adapter(load, setOutcome))
    await screen.findByRole('heading', { name: 'Ana Rojas' })

    await user.click(screen.getByRole('button', { name: 'Atendido' }))
    await user.click(screen.getByRole('button', { name: /confirmar resultado/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya tenía otro resultado.*detalle fue actualizado/i)
    expect(screen.getByText('Inasistencia')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atendido' })).not.toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Resultado de la cita' })).toHaveFocus())
  })

  it('invalida una mutación tardía al navegar de la cita A a la cita B', async () => {
    const user = userEvent.setup()
    let resolveOutcome!: () => void
    const pendingOutcome = new Promise<void>((resolve) => { resolveOutcome = resolve })
    const secondConfirmed: DoctorAppointmentDetail = {
      ...confirmed,
      id: secondAppointmentId,
      code: 'CMA-DETAIL-02',
      patientName: 'Beatriz Luna',
      specialtyName: 'Neurología',
    }
    const load = vi.fn((id: string) => Promise.resolve(id === appointmentId ? confirmed : secondConfirmed))
    const setOutcome = vi.fn(() => pendingOutcome)
    renderDetail(adapter(load, setOutcome), `/medico/citas/${appointmentId}`, true)
    await screen.findByRole('heading', { name: 'Ana Rojas' })

    await user.click(screen.getByRole('button', { name: 'Atendido' }))
    await user.click(screen.getByRole('button', { name: /confirmar resultado/i }))
    expect(screen.getByRole('button', { name: /confirmar resultado/i })).toBeDisabled()
    await user.click(screen.getByRole('link', { name: /abrir segunda cita/i }))

    expect(await screen.findByRole('heading', { name: 'Beatriz Luna' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atendido' })).toBeEnabled()
    await act(async () => { resolveOutcome(); await pendingOutcome; await Promise.resolve() })

    expect(screen.getByRole('heading', { name: 'Beatriz Luna' })).toBeInTheDocument()
    expect(screen.queryByText('Ana Rojas')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(2)
    expect(load).toHaveBeenNthCalledWith(1, appointmentId)
    expect(load).toHaveBeenNthCalledWith(2, secondAppointmentId)
  })

  it.each(['attended', 'no_show', 'pending', 'cancelled'] as const)('no ofrece controles de resultado para estado %s', async (status) => {
    renderDetail(adapter(vi.fn().mockResolvedValue({ ...confirmed, status })))

    expect(await screen.findByRole('heading', { name: 'Ana Rojas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /resultado de la cita/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Atendido' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument()
  })
})
