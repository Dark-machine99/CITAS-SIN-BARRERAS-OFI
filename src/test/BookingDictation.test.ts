import { describe, expect, it, vi } from 'vitest'
import { looksLikeFullBookingRequest, resolveBookingRequest } from '../features/voice/bookingDictation'
import type { PatientAvailabilityAdapter } from '../services/supabase/patientAvailabilityAdapter'
import type { PatientDirectoryData } from '../services/supabase/patientDirectoryAdapter'
import type { AppointmentDraft } from '../types/domain'

const cardioId = '11111111-1111-4111-8111-111111111111'
const luciaId = '22222222-2222-4222-8222-222222222222'
const mateoId = '33333333-3333-4333-8333-333333333333'
const emptyDraft: AppointmentDraft = { specialtyId: null, doctorId: null, date: null, time: null, reason: '' }
const directory: PatientDirectoryData = {
  specialties: [{ id: cardioId, name: 'Cardiología', description: 'Corazón' }],
  doctors: [
    { id: luciaId, name: 'Lucía Torres', initials: 'LT', specialtyIds: [cardioId] },
    { id: mateoId, name: 'Mateo Rivas', initials: 'MR', specialtyIds: [cardioId] },
  ],
}
const slots = [{ time: '09:30:00', durationMinutes: 45 }, { time: '15:00:00', durationMinutes: 30 }]
const availability = (values = slots): PatientAvailabilityAdapter => ({ load: vi.fn(async ({ doctorId, specialtyId, date }) => ({ doctorId, specialtyId, date, timeZone: 'America/Lima' as const, slots: values })) })
const options = (data = directory, values = slots) => ({ directoryAdapter: { load: vi.fn().mockResolvedValue(data) }, availabilityAdapter: availability(values), now: new Date('2026-10-31T17:00:00Z') })

describe('propuesta cloud de reserva por voz', () => {
  it('resuelve especialidad, médico, fecha relativa, hora y motivo contra slots reales', async () => {
    const result = await resolveBookingRequest('Reservar cita mañana de cardiología con doctora Lucía Torres a las nueve y treinta por dolor de cabeza', emptyDraft, options())
    expect(result.status).toBe('proposal')
    if (result.status !== 'proposal') return
    expect(result.proposal.draft).toEqual({ specialtyId: cardioId, doctorId: luciaId, date: '2026-11-01', time: '09:30:00', reason: 'dolor de cabeza' })
    expect(result.proposal.summary).toContain('Lucía Torres')
  })

  it('pide elegir y recomienda opciones cuando hay varios médicos u horarios', async () => {
    const doctorResult = await resolveBookingRequest('Reservar cita mañana de cardiología', emptyDraft, options())
    expect(doctorResult).toMatchObject({ status: 'clarification', options: ['Lucía Torres', 'Mateo Rivas'] })

    const timeResult = await resolveBookingRequest('Reservar cita mañana de cardiología con Lucía Torres', emptyDraft, options())
    expect(timeResult).toMatchObject({ status: 'clarification', options: ['09:30 (45 minutos)', '15:00 (30 minutos)'] })
  })

  it('distingue fecha sin slots y conserva el borrador parcial', async () => {
    const result = await resolveBookingRequest('Reservar cita mañana de cardiología con Lucía Torres a las nueve y treinta', emptyDraft, options(directory, []))
    expect(result).toMatchObject({ status: 'no-slots', draft: { specialtyId: cardioId, doctorId: luciaId, date: '2026-11-01', time: null } })
  })

  it('propone horas reales cuando la solicitada no existe', async () => {
    const result = await resolveBookingRequest('Reservar cita mañana de cardiología con Lucía Torres a las diez', emptyDraft, options())
    expect(result).toMatchObject({ status: 'clarification', options: ['09:30 (45 minutos)', '15:00 (30 minutos)'] })
  })

  it('distingue navegación simple de una solicitud completa', () => {
    expect(looksLikeFullBookingRequest('reservar cita')).toBe(false)
    expect(looksLikeFullBookingRequest('reservar cita mañana de cardiología')).toBe(true)
  })
})
