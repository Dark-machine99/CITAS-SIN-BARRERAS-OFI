import type { AppointmentStatus } from '../../types/domain'
import type { AdminAppointmentOverviewDTO, AdminUserDirectoryDTO, DoctorAppointmentDTO, MedicalAdminStore } from '../../types/medicalAdmin'

export const doctorAgendaAdapter = {
  listAssigned(store: MedicalAdminStore, doctorId: string): DoctorAppointmentDTO[] {
    return store.doctorAppointments.filter((item) => item.doctor_id === doctorId)
  },
  findAssigned(store: MedicalAdminStore, doctorId: string, appointmentId: string) {
    return store.doctorAppointments.find((item) => item.id === appointmentId && item.doctor_id === doctorId)
  },
}

export const adminAppointmentAdapter = {
  list(store: MedicalAdminStore): AdminAppointmentOverviewDTO[] {
    return store.adminAppointments.map(({ id, code, doctor_id, specialty_id, appointment_date, start_time, duration_minutes, status }) => ({ id, code, doctor_id, specialty_id, appointment_date, start_time, duration_minutes, status }))
  },
}

export const adminUserDirectoryAdapter = {
  list(store: MedicalAdminStore): AdminUserDirectoryDTO[] {
    return store.users.map(({ profile_id, first_name, last_name, role }) => ({ profile_id, first_name, last_name, role }))
  },
}

export const canDoctorTransition = (current: AppointmentStatus, next: AppointmentStatus) =>
  current === 'confirmed' && (next === 'attended' || next === 'no_show')
