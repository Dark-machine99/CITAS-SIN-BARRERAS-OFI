import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createDoctorAgendaAdapter } from '../services/supabase/doctorAgendaAdapter'
import type { Database } from '../types/database'

const appointmentId = '11111111-1111-4111-8111-111111111111'
const doctorId = '22222222-2222-4222-8222-222222222222'
const specialtyId = '33333333-3333-4333-8333-333333333333'
const appointment = {
  id: appointmentId, code: 'CMA-MED-01', doctor_id: doctorId, specialty_id: specialtyId,
  appointment_date: '2026-11-11', appointment_time: '09:30:00', duration_minutes: 45,
  status: 'confirmed' as const,
}

function agendaClient(
  appointmentRows: unknown[] = [appointment],
  appointmentError: unknown = null,
  patientRows: unknown[] = [{ appointment_id: appointmentId, first_name: 'Ana', last_name: 'Rojas' }],
  specialtyRows: unknown[] = [{ id: specialtyId, name: 'Cardiología' }],
) {
  const secondOrder = vi.fn().mockResolvedValue({ data: appointmentRows, error: appointmentError })
  const firstOrder = vi.fn(() => ({ order: secondOrder }))
  const appointmentSelect = vi.fn(() => ({ order: firstOrder }))
  const patientSelect = vi.fn().mockResolvedValue({ data: patientRows, error: null })
  const specialtySelect = vi.fn().mockResolvedValue({ data: specialtyRows, error: null })
  const from = vi.fn((relation: string) => {
    if (relation === 'appointments') return { select: appointmentSelect }
    if (relation === 'appointment_patient_names') return { select: patientSelect }
    return { select: specialtySelect }
  })
  return { client: { from } as unknown as SupabaseClient<Database>, from, appointmentSelect, firstOrder, secondOrder }
}

describe('adapter cloud de agenda médica', () => {
  it('lee solo la proyección asignada por RLS y enriquece nombre mínimo y especialidad', async () => {
    const mocked = agendaClient()

    await expect(createDoctorAgendaAdapter(mocked.client).list()).resolves.toEqual([{
      id: appointmentId, code: 'CMA-MED-01', date: '2026-11-11', time: '09:30:00',
      durationMinutes: 45, status: 'confirmed', patientName: 'Ana Rojas', specialtyName: 'Cardiología',
    }])
    expect(mocked.from).toHaveBeenCalledWith('appointments')
    expect(mocked.from).toHaveBeenCalledWith('appointment_patient_names')
    expect(mocked.from).toHaveBeenCalledWith('specialties')
    expect(mocked.appointmentSelect).toHaveBeenCalledWith('id, code, doctor_id, specialty_id, appointment_date, appointment_time, duration_minutes, status')
    expect(mocked.firstOrder).toHaveBeenCalledWith('appointment_date', { ascending: true })
    expect(mocked.secondOrder).toHaveBeenCalledWith('appointment_time', { ascending: true })
    expect(JSON.stringify(mocked.appointmentSelect.mock.calls)).not.toMatch(/patient_id|reason/)
  })

  it('usa sustitutos explícitos cuando una proyección autorizada no tiene nombre', async () => {
    const mocked = agendaClient([appointment], null, [], [])

    await expect(createDoctorAgendaAdapter(mocked.client).list()).resolves.toEqual([
      expect.objectContaining({ patientName: 'Paciente no disponible', specialtyName: 'Especialidad no disponible' }),
    ])
  })

  it('falla cerrado y saneado ante error de consulta o fila inválida', async () => {
    await expect(createDoctorAgendaAdapter(agendaClient([], { message: 'private SQL detail' }).client).list())
      .rejects.toThrow('No pudimos cargar tu agenda')
    await expect(createDoctorAgendaAdapter(agendaClient([{ ...appointment, duration_minutes: 0 }]).client).list())
      .rejects.toThrow('No pudimos cargar tu agenda')
  })
})
