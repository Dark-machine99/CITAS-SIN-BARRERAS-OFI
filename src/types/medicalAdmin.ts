import type { AppointmentStatus } from './domain'

export type DemoRole = 'patient' | 'doctor' | 'admin'
export type AsyncViewState = 'loading' | 'success' | 'empty' | 'error' | 'forbidden'
export type MutationState = 'idle' | 'confirming' | 'submitting' | 'success' | 'error' | 'conflict'

export interface DoctorAppointmentDTO {
  id: string
  code: string
  doctor_id: string
  patient_name: string
  specialty_id: string
  appointment_date: string
  start_time: string
  duration_minutes: number
  status: AppointmentStatus
  reason?: string
}

export interface AdminAppointmentOverviewDTO {
  id: string
  code: string
  doctor_id: string
  specialty_id: string
  appointment_date: string
  start_time: string
  duration_minutes: number
  status: AppointmentStatus
}

export interface AdminUserDirectoryDTO {
  profile_id: string
  first_name: string
  last_name: string
  role: 'patient' | 'doctor'
}

export interface AdminDoctorDTO {
  id: string
  first_name: string
  last_name: string
  email: string
  specialty_ids: string[]
  active: boolean
}

export interface AdminSpecialtyDTO { id: string; name: string; description: string; active: boolean }
export interface WeeklyAvailabilityDTO { id: string; doctor_id: string; weekday: number; start_time: string; end_time: string; active: boolean }
export interface AvailabilityExceptionDTO { id: string; doctor_id: string; date: string; type: 'blocked' | 'available_override'; start_time: string | null; end_time: string | null }

export interface MedicalAdminStore {
  doctorAppointments: DoctorAppointmentDTO[]
  doctors: AdminDoctorDTO[]
  specialties: AdminSpecialtyDTO[]
  availability: WeeklyAvailabilityDTO[]
  exceptions: AvailabilityExceptionDTO[]
  adminAppointments: AdminAppointmentOverviewDTO[]
  users: AdminUserDirectoryDTO[]
}
