import type { PatientAvailabilityAdapter } from '../supabase/patientAvailabilityAdapter'
import type { PatientDirectoryAdapter } from '../supabase/patientDirectoryAdapter'
import type { PatientReservationData } from '../supabase/patientReservationAdapter'
import type { AppointmentDraft } from '../../types/domain'

export const tutorialSpecialtyId = '10000000-0000-4000-8000-000000000001'
export const tutorialDoctorId = '20000000-0000-4000-8000-000000000001'

export const patientTutorialDirectoryAdapter: PatientDirectoryAdapter = {
  load: async () => ({
    specialties: [{ id: tutorialSpecialtyId, name: 'Medicina general', description: 'Opción sintética para practicar el recorrido.' }],
    doctors: [{ id: tutorialDoctorId, name: 'Dra. Elena Práctica', initials: 'EP', specialtyIds: [tutorialSpecialtyId] }],
  }),
}

export const patientTutorialAvailabilityAdapter: PatientAvailabilityAdapter = {
  load: async ({ doctorId, specialtyId, date }) => ({
    doctorId,
    specialtyId,
    date,
    timeZone: 'America/Lima',
    slots: [
      { time: '09:00:00', durationMinutes: 30 },
      { time: '10:30:00', durationMinutes: 30 },
      { time: '15:00:00', durationMinutes: 30 },
    ],
  }),
}

export function createPatientTutorialReservation(draft: AppointmentDraft): PatientReservationData {
  return {
    id: 'tutorial-local-reservation',
    code: 'PRÁCTICA-LOCAL',
    doctorId: draft.doctorId ?? tutorialDoctorId,
    specialtyId: draft.specialtyId ?? tutorialSpecialtyId,
    date: draft.date ?? '',
    time: draft.time ?? '',
    durationMinutes: 30,
    status: 'confirmed',
  }
}
