import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createDoctorAppointmentDetailAdapter, DoctorAppointmentDetailError } from '../services/supabase/doctorAppointmentDetailAdapter'
import type { Database } from '../types/database'

const appointmentId = '11111111-1111-4111-8111-111111111111'
const specialtyId = '22222222-2222-4222-8222-222222222222'
const appointment = {
  id: appointmentId,
  code: 'CMA-DETAIL-01',
  specialty_id: specialtyId,
  appointment_date: '2026-11-11',
  appointment_time: '09:30:00',
  duration_minutes: 45,
  status: 'confirmed' as const,
}

function detailClient(options: {
  appointmentData?: unknown
  appointmentError?: unknown
  patientData?: unknown
  specialtyData?: unknown
  rpcData?: unknown
  rpcError?: unknown
} = {}) {
  const selections = new Map<string, ReturnType<typeof vi.fn>>()
  const resultFor = (relation: string) => {
    if (relation === 'appointments') return { data: options.appointmentData === undefined ? appointment : options.appointmentData, error: options.appointmentError ?? null }
    if (relation === 'appointment_patient_names') return { data: options.patientData === undefined ? { appointment_id: appointmentId, first_name: 'Ana', last_name: 'Rojas' } : options.patientData, error: null }
    return { data: options.specialtyData === undefined ? { id: specialtyId, name: 'Cardiología' } : options.specialtyData, error: null }
  }
  const from = vi.fn((relation: string) => {
    const maybeSingle = vi.fn().mockResolvedValue(resultFor(relation))
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    selections.set(relation, select)
    return { select }
  })
  const rpc = vi.fn().mockResolvedValue({ data: options.rpcData ?? null, error: options.rpcError ?? null })
  return { client: { from, rpc } as unknown as SupabaseClient<Database>, from, rpc, selections }
}

describe('adapter cloud del detalle médico', () => {
  it('lee solo la proyección mínima permitida por RLS y compone el detalle', async () => {
    const mocked = detailClient()

    await expect(createDoctorAppointmentDetailAdapter(mocked.client).load(appointmentId)).resolves.toEqual({
      id: appointmentId,
      code: 'CMA-DETAIL-01',
      date: '2026-11-11',
      time: '09:30:00',
      durationMinutes: 45,
      status: 'confirmed',
      patientName: 'Ana Rojas',
      specialtyName: 'Cardiología',
    })
    expect(mocked.from).toHaveBeenCalledWith('appointments')
    expect(mocked.from).toHaveBeenCalledWith('appointment_patient_names')
    expect(mocked.from).toHaveBeenCalledWith('specialties')
    expect(mocked.selections.get('appointments')).toHaveBeenCalledWith('id, code, specialty_id, appointment_date, appointment_time, duration_minutes, status')
    expect(JSON.stringify([...mocked.selections.values()].flatMap((select) => select.mock.calls))).not.toMatch(/patient_id|reason|diagnos|prescription|notes/i)
  })

  it('trata una fila ausente por RLS igual que una cita inexistente', async () => {
    const adapter = createDoctorAppointmentDetailAdapter(detailClient({ appointmentData: null }).client)

    await expect(adapter.load(appointmentId)).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_FOUND' })
  })

  it('valida UUID y sanea errores de autorización y transporte', async () => {
    await expect(createDoctorAppointmentDetailAdapter(detailClient().client).load('not-an-id'))
      .rejects.toEqual(new DoctorAppointmentDetailError('INVALID_INPUT'))
    await expect(createDoctorAppointmentDetailAdapter(detailClient({ appointmentError: { code: '42501', message: 'private SQL detail' } }).client).load(appointmentId))
      .rejects.toMatchObject({ code: 'FORBIDDEN', message: 'No pudimos completar la operación sobre la cita.' })
  })

  it.each(['attended', 'no_show'] as const)('usa únicamente la RPC para registrar %s', async (outcome) => {
    const mocked = detailClient({ rpcData: { ok: true, data: { id: appointmentId, status: outcome } } })

    await expect(createDoctorAppointmentDetailAdapter(mocked.client).setOutcome(appointmentId, outcome)).resolves.toBeUndefined()
    expect(mocked.rpc).toHaveBeenCalledWith('set_doctor_appointment_outcome', { p_appointment_id: appointmentId, p_outcome: outcome })
    expect(mocked.from).not.toHaveBeenCalled()
  })

  it('mapea errores de negocio conocidos sin exponer el mensaje remoto', async () => {
    const mocked = detailClient({ rpcData: { ok: false, error: { code: 'APPOINTMENT_NOT_YET_ELIGIBLE', message: 'private detail' } } })

    await expect(createDoctorAppointmentDetailAdapter(mocked.client).setOutcome(appointmentId, 'attended'))
      .rejects.toMatchObject({ code: 'APPOINTMENT_NOT_YET_ELIGIBLE', message: 'No pudimos completar la operación sobre la cita.' })
  })
})
