import { describe, expect, it } from 'vitest'
import { adminAppointmentAdapter, adminUserDirectoryAdapter, canDoctorTransition, doctorAgendaAdapter } from '../services/mock/medicalAdminAdapters'
import { createMedicalAdminStore } from '../services/mock/medicalAdminData'

describe('contratos mock médico y administración', () => {
  it('limita la agenda al profesional asignado', () => {
    const result = doctorAgendaAdapter.listAssigned(createMedicalAdminStore(), 'doc-lucia')
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((item) => item.doctor_id === 'doc-lucia')).toBe(true)
  })

  it('no expone paciente ni motivo en la proyección administrativa de citas', () => {
    const [item] = adminAppointmentAdapter.list(createMedicalAdminStore())
    expect(item).toBeDefined()
    expect(item).not.toHaveProperty('patient_name')
    expect(item).not.toHaveProperty('patient_id')
    expect(item).not.toHaveProperty('reason')
  })

  it('no expone contacto o preferencias en el directorio de usuarios', () => {
    const [item] = adminUserDirectoryAdapter.list(createMedicalAdminStore())
    expect(item).toBeDefined()
    expect(item).not.toHaveProperty('email')
    expect(item).not.toHaveProperty('phone')
    expect(item).not.toHaveProperty('password')
    expect(item).not.toHaveProperty('preferences')
  })

  it('solo permite al médico cerrar una cita confirmada como atendida o inasistencia', () => {
    expect(canDoctorTransition('confirmed', 'attended')).toBe(true)
    expect(canDoctorTransition('confirmed', 'no_show')).toBe(true)
    expect(canDoctorTransition('confirmed', 'cancelled')).toBe(false)
    expect(canDoctorTransition('pending', 'attended')).toBe(false)
    expect(canDoctorTransition('attended', 'no_show')).toBe(false)
  })
})
