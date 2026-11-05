import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createPatientAppointmentsAdapter, PatientAppointmentsError } from '../services/supabase/patientAppointmentsAdapter'
import type { Database } from '../types/database'

const appointmentId = '11111111-1111-4111-8111-111111111111'
const doctorId = '22222222-2222-4222-8222-222222222222'
const specialtyId = '33333333-3333-4333-8333-333333333333'
const row = {
  id: appointmentId, code: 'CMA-REAL-01', doctor_id: doctorId, specialty_id: specialtyId,
  appointment_date: '2026-11-05', appointment_time: '09:30:00', duration_minutes: 45,
  reason: 'Control', status: 'confirmed' as const,
}

function listClient() {
  const secondOrder = vi.fn().mockResolvedValue({ data: [row], error: null })
  const firstOrder = vi.fn(() => ({ order: secondOrder }))
  const appointmentSelect = vi.fn(() => ({ order: firstOrder }))
  const doctorSelect = vi.fn().mockResolvedValue({ data: [{ doctor_id: doctorId, first_name: 'Lucía', last_name: 'Torres', specialty_id: specialtyId }], error: null })
  const specialtySelect = vi.fn().mockResolvedValue({ data: [{ id: specialtyId, name: 'Cardiología' }], error: null })
  const from = vi.fn((relation: string) => {
    if (relation === 'appointments') return { select: appointmentSelect }
    if (relation === 'doctor_directory') return { select: doctorSelect }
    return { select: specialtySelect }
  })
  return { client: { from } as unknown as SupabaseClient<Database>, from, appointmentSelect, firstOrder, secondOrder }
}

function rpcClient(response: unknown) {
  const rpc = vi.fn().mockResolvedValue(response)
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

const mutationSuccess = (overrides: Record<string, unknown> = {}) => ({ data: { ok: true, data: { ...row, reason: undefined, ...overrides } }, error: null })

describe('adapter cloud de citas Paciente', () => {
  it('lista bajo RLS sin patient_id y enriquece con directorio y especialidad reales', async () => {
    const mocked = listClient()
    await expect(createPatientAppointmentsAdapter(mocked.client).list()).resolves.toEqual([{
      id: appointmentId, code: 'CMA-REAL-01', doctorId, specialtyId,
      date: '2026-11-05', time: '09:30:00', durationMinutes: 45, reason: 'Control',
      status: 'confirmed', doctorName: 'Lucía Torres', specialtyName: 'Cardiología',
    }])
    expect(mocked.from).toHaveBeenCalledWith('appointments')
    expect(mocked.from).toHaveBeenCalledWith('doctor_directory')
    expect(mocked.from).toHaveBeenCalledWith('specialties')
    expect(mocked.appointmentSelect).toHaveBeenCalledWith('id, code, doctor_id, specialty_id, appointment_date, appointment_time, duration_minutes, reason, status')
    expect(mocked.firstOrder).toHaveBeenCalledWith('appointment_date', { ascending: false })
    expect(mocked.secondOrder).toHaveBeenCalledWith('appointment_time', { ascending: false })
    expect(JSON.stringify(mocked.from.mock.calls)).not.toContain('patient_id')
  })

  it('envía exclusivamente argumentos RPC nombrados para cancelar y reprogramar', async () => {
    const cancelMock = rpcClient(mutationSuccess({ status: 'cancelled' }))
    await createPatientAppointmentsAdapter(cancelMock.client).cancel(appointmentId)
    expect(cancelMock.rpc).toHaveBeenCalledWith('cancel_appointment', { p_appointment_id: appointmentId })

    const rescheduleMock = rpcClient(mutationSuccess({ appointment_date: '2026-11-06', appointment_time: '10:15:00' }))
    await createPatientAppointmentsAdapter(rescheduleMock.client).reschedule(appointmentId, '2026-11-06', '10:15')
    expect(rescheduleMock.rpc).toHaveBeenCalledWith('reschedule_appointment', {
      p_appointment_id: appointmentId, p_new_date: '2026-11-06', p_new_time: '10:15:00',
    })
  })

  it('conserva códigos de dominio y no filtra mensajes internos', async () => {
    const mocked = rpcClient({ data: { ok: false, error: { code: 'SLOT_UNAVAILABLE', message: 'private SQL detail' } }, error: null })
    const request = createPatientAppointmentsAdapter(mocked.client).reschedule(appointmentId, '2026-11-06', '10:15')
    await expect(request).rejects.toEqual(new PatientAppointmentsError('SLOT_UNAVAILABLE'))
    await expect(request).rejects.not.toThrow('private SQL detail')
  })

  it('rechaza identificadores y respuestas inválidas antes de inventar éxito', async () => {
    const invalid = rpcClient(mutationSuccess({ duration_minutes: 0 }))
    await expect(createPatientAppointmentsAdapter(invalid.client).cancel(appointmentId)).rejects.toMatchObject({ code: 'INTERNAL_ERROR' })
    const neverCalled = rpcClient(mutationSuccess())
    await expect(createPatientAppointmentsAdapter(neverCalled.client).cancel('demo-1')).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(neverCalled.rpc).not.toHaveBeenCalled()
  })
})
