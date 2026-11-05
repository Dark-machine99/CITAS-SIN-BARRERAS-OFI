import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createPatientReservationAdapter, PatientReservationError } from '../services/supabase/patientReservationAdapter'
import type { Database } from '../types/database'

const doctorId = '11111111-1111-4111-8111-111111111111'
const specialtyId = '22222222-2222-4222-8222-222222222222'
const appointmentId = '33333333-3333-4333-8333-333333333333'
const input = { doctorId, specialtyId, date: '2026-10-31', time: '09:30:00', reason: '  Control preventivo  ' }

function clientWith(response: unknown) {
  const rpc = vi.fn().mockResolvedValue(response)
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

function success() {
  return { data: { ok: true, data: {
    id: appointmentId,
    code: 'CMA-OPACO-01',
    doctor_id: doctorId,
    specialty_id: specialtyId,
    appointment_date: input.date,
    appointment_time: input.time,
    duration_minutes: 45,
    status: 'confirmed',
  } }, error: null }
}

describe('adapter de confirmación de reserva Paciente', () => {
  it('envía exclusivamente los cinco parámetros y transforma el éxito del servidor', async () => {
    const mocked = clientWith(success())

    await expect(createPatientReservationAdapter(mocked.client).reserve(input)).resolves.toEqual({
      id: appointmentId,
      code: 'CMA-OPACO-01',
      doctorId,
      specialtyId,
      date: input.date,
      time: input.time,
      durationMinutes: 45,
      status: 'confirmed',
    })
    expect(mocked.rpc).toHaveBeenCalledWith('reserve_appointment', {
      p_doctor_id: doctorId,
      p_specialty_id: specialtyId,
      p_date: input.date,
      p_time: input.time,
      p_reason: 'Control preventivo',
    })
    expect(Object.keys(mocked.rpc.mock.calls[0]![1])).toEqual(['p_doctor_id', 'p_specialty_id', 'p_date', 'p_time', 'p_reason'])
  })

  it('normaliza motivo vacío a null y no inventa campos del cliente', async () => {
    const mocked = clientWith(success())
    await createPatientReservationAdapter(mocked.client).reserve({ ...input, reason: '   ' })
    expect(mocked.rpc).toHaveBeenCalledWith('reserve_appointment', expect.objectContaining({ p_reason: null }))
  })

  it.each(['SLOT_UNAVAILABLE', 'UNAUTHORIZED', 'FORBIDDEN', 'INVALID_INPUT'] as const)('conserva el código de dominio %s sin filtrar detalle interno', async (code) => {
    const mocked = clientWith({ data: { ok: false, error: { code, message: 'private SQL detail' } }, error: null })
    const request = createPatientReservationAdapter(mocked.client).reserve(input)
    await expect(request).rejects.toMatchObject({ code })
    await expect(request).rejects.toThrow('No pudimos confirmar la cita')
    await expect(request).rejects.not.toThrow('private SQL detail')
  })

  it('rechaza entrada o respuesta incoherente y normaliza fallos de transporte', async () => {
    const invalidResponse = clientWith({ data: { ok: true, data: { ...success().data.data, duration_minutes: 0 } }, error: null })
    await expect(createPatientReservationAdapter(invalidResponse.client).reserve(input)).rejects.toEqual(new PatientReservationError('INTERNAL_ERROR'))

    const transport = clientWith({ data: null, error: { code: 'PGRST301', message: 'private endpoint' } })
    await expect(createPatientReservationAdapter(transport.client).reserve(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })

    const neverCalled = clientWith(success())
    await expect(createPatientReservationAdapter(neverCalled.client).reserve({ ...input, doctorId: 'demo-doctor' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(createPatientReservationAdapter(neverCalled.client).reserve({ ...input, reason: 'x'.repeat(501) })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(neverCalled.rpc).not.toHaveBeenCalled()
  })
})
