import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'
import { createMedicalAdminStore } from '../../services/mock/medicalAdminData'
import { canDoctorTransition } from '../../services/mock/medicalAdminAdapters'
import type { AppointmentStatus } from '../../types/domain'
import type { AdminDoctorDTO, AdminSpecialtyDTO, AvailabilityExceptionDTO, MedicalAdminStore, WeeklyAvailabilityDTO } from '../../types/medicalAdmin'

interface MedicalAdminContextValue extends MedicalAdminStore {
  updateAppointmentStatus: (id: string, next: AppointmentStatus) => boolean
  addDoctor: (input: Omit<AdminDoctorDTO, 'id' | 'active'>) => { ok: true } | { ok: false; code: 409 }
  toggleDoctor: (id: string) => void
  saveSpecialty: (input: Omit<AdminSpecialtyDTO, 'id' | 'active'> & { id?: string }) => void
  toggleSpecialty: (id: string) => void
  saveAvailability: (input: Omit<WeeklyAvailabilityDTO, 'id' | 'active'>) => void
  addException: (input: Omit<AvailabilityExceptionDTO, 'id'>) => void
}

const Context = createContext<MedicalAdminContextValue | null>(null)

export function MedicalAdminDemoProvider({ children }: PropsWithChildren) {
  const [store, setStore] = useState(createMedicalAdminStore)
  const value = useMemo<MedicalAdminContextValue>(() => ({
    ...store,
    updateAppointmentStatus: (id, next) => {
      const current = store.doctorAppointments.find((item) => item.id === id)
      if (!current || !canDoctorTransition(current.status, next)) return false
      setStore((snapshot) => ({
        ...snapshot,
        doctorAppointments: snapshot.doctorAppointments.map((item) => item.id === id ? { ...item, status: next } : item),
        adminAppointments: snapshot.adminAppointments.map((item) => item.id === id ? { ...item, status: next } : item),
      }))
      return true
    },
    addDoctor: (input) => {
      if (store.doctors.some((item) => item.email.toLowerCase() === input.email.toLowerCase())) return { ok: false, code: 409 }
      setStore((snapshot) => ({ ...snapshot, doctors: [...snapshot.doctors, { ...input, id: `doc-demo-${snapshot.doctors.length + 1}`, active: true }] }))
      return { ok: true }
    },
    toggleDoctor: (id) => setStore((snapshot) => ({ ...snapshot, doctors: snapshot.doctors.map((item) => item.id === id ? { ...item, active: !item.active } : item) })),
    saveSpecialty: (input) => setStore((snapshot) => ({ ...snapshot, specialties: input.id ? snapshot.specialties.map((item) => item.id === input.id ? { ...item, name: input.name, description: input.description } : item) : [...snapshot.specialties, { ...input, id: `esp-demo-${snapshot.specialties.length + 1}`, active: true }] })),
    toggleSpecialty: (id) => setStore((snapshot) => ({ ...snapshot, specialties: snapshot.specialties.map((item) => item.id === id ? { ...item, active: !item.active } : item) })),
    saveAvailability: (input) => setStore((snapshot) => ({ ...snapshot, availability: [...snapshot.availability, { ...input, id: `av-demo-${snapshot.availability.length + 1}`, active: true }] })),
    addException: (input) => setStore((snapshot) => ({ ...snapshot, exceptions: [...snapshot.exceptions, { ...input, id: `ex-demo-${snapshot.exceptions.length + 1}` }] })),
  }), [store])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useMedicalAdminDemo() {
  const value = useContext(Context)
  if (!value) throw new Error('useMedicalAdminDemo debe usarse dentro de MedicalAdminDemoProvider')
  return value
}
