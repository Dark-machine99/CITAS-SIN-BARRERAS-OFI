import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createFutureLimaDates, createPatientAvailabilityAdapter, PatientAvailabilityError } from '../services/supabase/patientAvailabilityAdapter'
import type { Database } from '../types/database'

const doctorId = '11111111-1111-4111-8111-111111111111'
const specialtyId = '22222222-2222-4222-8222-222222222222'
const input = { doctorId, specialtyId, date: '2026-10-29' }

function clientWith(response: unknown) {
  const rpc = vi.fn().mockResolvedValue(response)
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe('adapter de disponibilidad Paciente', () => {
  it('llama la RPC tipada y valida, ordena y transforma los slots del servidor', async () => {
    const mocked = clientWith({ data: { ok: true, data: {
      doctor_id: doctorId,
      specialty_id: specialtyId,
      date: input.date,
      time_zone: 'America/Lima',
      slots: [
        { time: '15:00:00', duration_minutes: 45 },
        { time: '09:30:00', duration_minutes: 30 },
      ],
    } }, error: null })

    await expect(createPatientAvailabilityAdapter(mocked.client).load(input)).resolves.toEqual({
      doctorId,
      specialtyId,
      date: input.date,
      timeZone: 'America/Lima',
      slots: [
        { time: '09:30:00', durationMinutes: 30 },
        { time: '15:00:00', durationMinutes: 45 },
      ],
    })
    expect(mocked.rpc).toHaveBeenCalledWith('get_available_slots', {
      p_doctor_id: doctorId,
      p_specialty_id: specialtyId,
      p_date: input.date,
    })
  })

  it('conserva los códigos de dominio autorizados sin filtrar mensajes internos', async () => {
    const mocked = clientWith({ data: { ok: false, error: { code: 'UNAUTHORIZED', message: 'private SQL detail' } }, error: null })
    const request = createPatientAvailabilityAdapter(mocked.client).load(input)

    await expect(request).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(request).rejects.toThrow('No pudimos consultar los horarios disponibles')
    await expect(request).rejects.not.toThrow('private SQL detail')
  })

  it('rechaza respuestas incoherentes, slots duplicados y duraciones inventadas', async () => {
    const mocked = clientWith({ data: { ok: true, data: {
      doctor_id: doctorId,
      specialty_id: specialtyId,
      date: input.date,
      time_zone: 'UTC',
      slots: [{ time: '09:00:00', duration_minutes: 0 }],
    } }, error: null })

    await expect(createPatientAvailabilityAdapter(mocked.client).load(input)).rejects.toEqual(new PatientAvailabilityError('INTERNAL_ERROR'))
  })

  it('normaliza fallos de transporte y valida entradas antes de llamar al servidor', async () => {
    const mocked = clientWith({ data: null, error: { code: 'FETCH_ERROR', message: 'internal endpoint' } })
    await expect(createPatientAvailabilityAdapter(mocked.client).load(input)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    await expect(createPatientAvailabilityAdapter(mocked.client).load({ ...input, doctorId: 'demo-doctor' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(mocked.rpc).toHaveBeenCalledTimes(1)
  })
})

describe('ventana clínica de fechas', () => {
  it('genera únicamente días futuros según America/Lima incluso cerca de medianoche UTC', () => {
    expect(createFutureLimaDates(new Date('2026-10-29T03:30:00.000Z'), 3)).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ])
  })
})
