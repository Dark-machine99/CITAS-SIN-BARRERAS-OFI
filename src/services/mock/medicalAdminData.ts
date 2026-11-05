import type { MedicalAdminStore } from '../../types/medicalAdmin'

export const createMedicalAdminStore = (): MedicalAdminStore => ({
  specialties: [
    { id: 'esp-cardio', name: 'Cardiología', description: 'Cuidado cardiovascular y controles preventivos.', active: true },
    { id: 'esp-neuro', name: 'Neurología', description: 'Sistema nervioso y seguimiento clínico.', active: true },
    { id: 'esp-trauma', name: 'Traumatología', description: 'Articulaciones, huesos y movilidad.', active: true },
    { id: 'esp-derma', name: 'Dermatología', description: 'Cuidado de piel, cabello y uñas.', active: true },
    { id: 'esp-general', name: 'Medicina general', description: 'Orientación y atención integral.', active: true },
    { id: 'esp-oftalmo', name: 'Oftalmología', description: 'Evaluación visual y salud ocular.', active: false },
  ],
  doctors: [
    { id: 'doc-lucia', first_name: 'Lucía', last_name: 'Rivera Demo', email: 'lucia.demo@ejemplo.test', specialty_ids: ['esp-cardio', 'esp-general'], active: true },
    { id: 'doc-mateo', first_name: 'Mateo', last_name: 'Rivas Demo', email: 'mateo.demo@ejemplo.test', specialty_ids: ['esp-neuro'], active: true },
    { id: 'doc-valeria', first_name: 'Valeria', last_name: 'León Demo', email: 'valeria.demo@ejemplo.test', specialty_ids: ['esp-trauma'], active: true },
    { id: 'doc-andres', first_name: 'Andrés', last_name: 'Paz Demo', email: 'andres.demo@ejemplo.test', specialty_ids: ['esp-derma'], active: false },
  ],
  doctorAppointments: [
    { id: 'med-1', code: 'MED-D2F4', doctor_id: 'doc-lucia', patient_name: 'Camila Prueba', specialty_id: 'esp-cardio', appointment_date: '2026-10-23', start_time: '08:30', duration_minutes: 30, status: 'confirmed', reason: 'Control preventivo de demostración.' },
    { id: 'med-2', code: 'MED-K8R1', doctor_id: 'doc-lucia', patient_name: 'Jorge Muestra', specialty_id: 'esp-general', appointment_date: '2026-10-23', start_time: '10:00', duration_minutes: 30, status: 'confirmed' },
    { id: 'med-3', code: 'MED-T7B9', doctor_id: 'doc-lucia', patient_name: 'Sofía Ejemplo', specialty_id: 'esp-cardio', appointment_date: '2026-10-24', start_time: '15:30', duration_minutes: 30, status: 'confirmed', reason: 'Seguimiento general de demostración.' },
    { id: 'med-4', code: 'MED-H3P6', doctor_id: 'doc-lucia', patient_name: 'Diego Prueba', specialty_id: 'esp-cardio', appointment_date: '2026-10-20', start_time: '09:00', duration_minutes: 30, status: 'attended' },
    { id: 'med-5', code: 'MED-W5C2', doctor_id: 'doc-mateo', patient_name: 'Paciente no autorizado', specialty_id: 'esp-neuro', appointment_date: '2026-10-23', start_time: '11:00', duration_minutes: 30, status: 'confirmed' },
  ],
  adminAppointments: [
    { id: 'med-1', code: 'MED-D2F4', doctor_id: 'doc-lucia', specialty_id: 'esp-cardio', appointment_date: '2026-10-23', start_time: '08:30', duration_minutes: 30, status: 'confirmed' },
    { id: 'med-2', code: 'MED-K8R1', doctor_id: 'doc-lucia', specialty_id: 'esp-general', appointment_date: '2026-10-23', start_time: '10:00', duration_minutes: 30, status: 'confirmed' },
    { id: 'med-3', code: 'MED-T7B9', doctor_id: 'doc-lucia', specialty_id: 'esp-cardio', appointment_date: '2026-10-24', start_time: '15:30', duration_minutes: 30, status: 'confirmed' },
    { id: 'adm-4', code: 'ADM-C6A8', doctor_id: 'doc-valeria', specialty_id: 'esp-trauma', appointment_date: '2026-10-23', start_time: '12:00', duration_minutes: 45, status: 'cancelled' },
  ],
  users: [
    { profile_id: 'usr-p1', first_name: 'Ana', last_name: 'Paciente Demo', role: 'patient' },
    { profile_id: 'usr-p2', first_name: 'Bruno', last_name: 'Paciente Prueba', role: 'patient' },
    { profile_id: 'usr-d1', first_name: 'Lucía', last_name: 'Rivera Demo', role: 'doctor' },
    { profile_id: 'usr-d2', first_name: 'Mateo', last_name: 'Rivas Demo', role: 'doctor' },
  ],
  availability: [
    { id: 'av-1', doctor_id: 'doc-lucia', weekday: 1, start_time: '08:00', end_time: '13:00', active: true },
    { id: 'av-2', doctor_id: 'doc-lucia', weekday: 3, start_time: '14:00', end_time: '18:00', active: true },
    { id: 'av-3', doctor_id: 'doc-mateo', weekday: 2, start_time: '09:00', end_time: '15:00', active: true },
  ],
  exceptions: [
    { id: 'ex-1', doctor_id: 'doc-lucia', date: '2026-10-27', type: 'blocked', start_time: null, end_time: null },
    { id: 'ex-2', doctor_id: 'doc-lucia', date: '2026-10-31', type: 'available_override', start_time: '09:00', end_time: '12:00' },
  ],
})
