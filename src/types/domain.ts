export type AppointmentStatus = 'pending' | 'confirmed' | 'attended' | 'no_show' | 'cancelled'

export interface AppointmentDraft {
  specialtyId: string | null
  doctorId: string | null
  date: string | null
  time: string | null
  reason: string
}

export type BodyModel = 'masculino' | 'femenino'
export interface BodySelectionDraft { model: BodyModel; regions: string[] }

export interface Specialty { id: string; name: string; description: string; icon: string }
export interface Doctor { id: string; name: string; initials: string; specialtyIds: string[]; availability: string }
export interface DemoAppointment {
  id: string
  code: string
  doctorId: string
  specialtyId: string
  date: string
  time: string
  durationMinutes: number
  reason?: string
  status: AppointmentStatus
}
