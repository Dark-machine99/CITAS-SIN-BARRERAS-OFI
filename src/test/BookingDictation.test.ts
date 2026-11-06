import { describe, expect, it, vi } from 'vitest'
import { looksLikeFullBookingRequest, resolveBookingRequest } from '../features/voice/bookingDictation'
import type { AvailabilitySlot, PatientAvailabilityAdapter } from '../services/supabase/patientAvailabilityAdapter'
import type { PatientDirectoryData } from '../services/supabase/patientDirectoryAdapter'
import type { AppointmentDraft } from '../types/domain'

const cardioId = '11111111-1111-4111-8111-111111111111'
const luciaId = '22222222-2222-4222-8222-222222222222'
const mateoId = '33333333-3333-4333-8333-333333333333'
const neuroId = '44444444-4444-4444-8444-444444444444'
const elenaId = '55555555-5555-4555-8555-555555555555'
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
const multiDoctorOptions = (slotsByDoctor: Record<string, AvailabilitySlot[]>, data = directory) => {
  const load = vi.fn<PatientAvailabilityAdapter['load']>(async ({ doctorId, specialtyId, date }) => ({
    doctorId, specialtyId, date, timeZone: 'America/Lima', slots: slotsByDoctor[doctorId] ?? [],
  }))
  return { directoryAdapter: { load: vi.fn().mockResolvedValue(data) }, availabilityAdapter: { load }, now: new Date('2026-10-31T17:00:00Z'), load }
}

describe('propuesta cloud de reserva por voz', () => {
  it('resuelve especialidad, médico, fecha relativa, hora y motivo contra slots reales', async () => {
    const result = await resolveBookingRequest('Reservar cita mañana de cardiología con doctora Lucía Torres a las nueve y treinta por dolor de cabeza', emptyDraft, options())
    expect(result.status).toBe('proposal')
    if (result.status !== 'proposal') return
    expect(result.proposal.draft).toEqual({ specialtyId: cardioId, doctorId: luciaId, date: '2026-11-01', time: '09:30:00', reason: 'dolor de cabeza' })
    expect(result.proposal.summary).toContain('Lucía Torres')
  })

  it('pide elegir cuando falta un periodo y recomienda opciones si el médico tiene varios horarios', async () => {
    const doctorResult = await resolveBookingRequest('Reservar cita mañana de cardiología', emptyDraft, options())
    expect(doctorResult).toMatchObject({ status: 'clarification', options: ['Lucía Torres', 'Mateo Rivas'] })

    const timeResult = await resolveBookingRequest('Reservar cita mañana de cardiología con Lucía Torres', emptyDraft, options())
    expect(timeResult).toMatchObject({ status: 'clarification', options: ['09:30 (45 minutos)', '15:00 (30 minutos)'] })
  })

  it('resuelve el texto reportado comparando todos los médicos y elige el turno más temprano del periodo', async () => {
    const resolver = multiDoctorOptions({
      [luciaId]: [{ time: '15:00:00', durationMinutes: 30 }],
      [mateoId]: [{ time: '13:30:00', durationMinutes: 45 }],
    })
    const result = await resolveBookingRequest('puedes reservar cita mañana por la tarde de cardiología por dolor de cabeza', emptyDraft, resolver)

    expect(result.status).toBe('proposal')
    if (result.status !== 'proposal') return
    expect(result.proposal.draft).toEqual({ specialtyId: cardioId, doctorId: mateoId, date: '2026-11-01', time: '13:30:00', reason: 'dolor de cabeza' })
    expect(result.proposal.decisions).toContain('Seleccioné el horario más temprano de la tarde; en empates respeté el orden estable del directorio.')
    expect(resolver.load).toHaveBeenCalledTimes(2)
    expect(resolver.load.mock.calls.map(([input]) => input.doctorId)).toEqual([luciaId, mateoId])
  })

  it('elige otro médico cuando el primero no tiene horario en el periodo solicitado', async () => {
    const resolver = multiDoctorOptions({
      [luciaId]: [{ time: '09:30:00', durationMinutes: 45 }],
      [mateoId]: [{ time: '15:00:00', durationMinutes: 30 }],
    })
    const result = await resolveBookingRequest('Reservar cita mañana por la tarde de cardiología', emptyDraft, resolver)

    expect(result).toMatchObject({ status: 'proposal', proposal: { draft: { doctorId: mateoId, time: '15:00:00' } } })
  })

  it('desempata horarios iguales con el orden estable del directorio', async () => {
    const resolver = multiDoctorOptions({
      [luciaId]: [{ time: '15:00:00', durationMinutes: 45 }],
      [mateoId]: [{ time: '15:00:00', durationMinutes: 30 }],
    })
    const result = await resolveBookingRequest('Reservar cita mañana por la tarde de cardiología', emptyDraft, resolver)

    expect(result).toMatchObject({ status: 'proposal', proposal: { draft: { doctorId: luciaId, time: '15:00:00' } } })
  })

  it('no sustituye a un médico nombrado aunque otro tenga horario en el periodo', async () => {
    const resolver = multiDoctorOptions({
      [luciaId]: [{ time: '09:30:00', durationMinutes: 45 }],
      [mateoId]: [{ time: '15:00:00', durationMinutes: 30 }],
    })
    const result = await resolveBookingRequest('Reservar cita mañana por la tarde de cardiología con Lucía Torres', emptyDraft, resolver)

    expect(result).toMatchObject({ status: 'clarification', draft: { doctorId: luciaId }, options: ['09:30 (45 minutos)'] })
    expect(resolver.load).toHaveBeenCalledTimes(1)
    expect(resolver.load).toHaveBeenCalledWith(expect.objectContaining({ doctorId: luciaId }))
  })

  it('rechaza un médico explícito incompatible sin recomendar silenciosamente otro', async () => {
    const mixedDirectory: PatientDirectoryData = {
      specialties: [...directory.specialties, { id: neuroId, name: 'Neurología', description: 'Sistema nervioso' }],
      doctors: [...directory.doctors, { id: elenaId, name: 'Elena Salas', initials: 'ES', specialtyIds: [neuroId] }],
    }
    const resolver = multiDoctorOptions({
      [luciaId]: [{ time: '15:00:00', durationMinutes: 30 }],
      [mateoId]: [{ time: '16:00:00', durationMinutes: 30 }],
      [elenaId]: [{ time: '14:00:00', durationMinutes: 30 }],
    }, mixedDirectory)
    const result = await resolveBookingRequest('Reservar cita mañana por la tarde de cardiología con Elena Salas', emptyDraft, resolver)

    expect(result).toMatchObject({
      status: 'clarification',
      draft: { specialtyId: cardioId, doctorId: null, time: null },
      message: 'Elena Salas no atiende Cardiología. Elige un profesional compatible o cambia la especialidad.',
      options: ['Lucía Torres', 'Mateo Rivas'],
    })
    expect(resolver.load).not.toHaveBeenCalled()
  })

  it('aclara coincidencias globales ambiguas antes de filtrar por especialidad', async () => {
    const mixedDirectory: PatientDirectoryData = {
      specialties: [...directory.specialties, { id: neuroId, name: 'Neurología', description: 'Sistema nervioso' }],
      doctors: [...directory.doctors, { id: elenaId, name: 'Lucía Salas', initials: 'LS', specialtyIds: [neuroId] }],
    }
    const resolver = multiDoctorOptions({}, mixedDirectory)
    const result = await resolveBookingRequest('Reservar cita mañana por la tarde de cardiología con Lucía', emptyDraft, resolver)

    expect(result).toMatchObject({
      status: 'clarification',
      draft: { specialtyId: cardioId, doctorId: null, time: null },
      options: ['Lucía Torres', 'Lucía Salas'],
    })
    expect(resolver.load).not.toHaveBeenCalled()
  })

  it('prioriza el nombre completo exacto cuando dos médicos comparten nombre', async () => {
    const mixedDirectory: PatientDirectoryData = {
      specialties: [...directory.specialties, { id: neuroId, name: 'Neurología', description: 'Sistema nervioso' }],
      doctors: [...directory.doctors, { id: elenaId, name: 'Lucía Salas', initials: 'LS', specialtyIds: [neuroId] }],
    }
    const resolver = multiDoctorOptions({
      [luciaId]: [{ time: '15:00:00', durationMinutes: 30 }],
      [elenaId]: [{ time: '14:00:00', durationMinutes: 30 }],
    }, mixedDirectory)
    const result = await resolveBookingRequest('Reservar cita mañana por la tarde de cardiología con Lucía Torres', emptyDraft, resolver)

    expect(result).toMatchObject({ status: 'proposal', proposal: { draft: { doctorId: luciaId, time: '15:00:00' } } })
    expect(resolver.load).toHaveBeenCalledTimes(1)
    expect(resolver.load).toHaveBeenCalledWith(expect.objectContaining({ doctorId: luciaId }))
  })

  it('respeta una hora explícita y ofrece horarios reales si ningún médico la tiene', async () => {
    const resolver = multiDoctorOptions({
      [luciaId]: [{ time: '09:30:00', durationMinutes: 45 }],
      [mateoId]: [{ time: '15:00:00', durationMinutes: 30 }],
    })
    const result = await resolveBookingRequest('Reservar cita mañana de cardiología a las diez', emptyDraft, resolver)

    expect(result).toMatchObject({
      status: 'clarification',
      draft: { doctorId: null, time: null },
      options: ['Lucía Torres: 09:30 (45 minutos)', 'Mateo Rivas: 15:00 (30 minutos)'],
    })
    expect(resolver.load).toHaveBeenCalledTimes(2)
  })

  it('informa cero slots del periodo sin inventar y conserva alternativas reales', async () => {
    const resolver = multiDoctorOptions({
      [luciaId]: [{ time: '09:30:00', durationMinutes: 45 }],
      [mateoId]: [],
    })
    const result = await resolveBookingRequest('Reservar cita mañana por la tarde de cardiología', emptyDraft, resolver)

    expect(result).toMatchObject({
      status: 'no-slots',
      draft: { specialtyId: cardioId, doctorId: null, date: '2026-11-01', time: null },
      options: ['Lucía Torres: 09:30 (45 minutos)'],
    })
    expect(resolver.load).toHaveBeenCalledTimes(2)
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
