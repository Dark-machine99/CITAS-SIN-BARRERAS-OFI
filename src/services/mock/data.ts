import type { DemoAppointment, Doctor, Specialty } from '../../types/domain'

export const specialties: Specialty[] = [
  { id: 'esp-cardio', name: 'Cardiología', description: 'Orientación para el cuidado cardiovascular y controles preventivos.', icon: 'heart' },
  { id: 'esp-neuro', name: 'Neurología', description: 'Evaluación especializada del sistema nervioso y seguimiento clínico.', icon: 'brain' },
  { id: 'esp-trauma', name: 'Traumatología', description: 'Atención de articulaciones, huesos y movilidad.', icon: 'bone' },
  { id: 'esp-derma', name: 'Dermatología', description: 'Cuidado de la piel, cabello y uñas.', icon: 'sparkles' },
  { id: 'esp-general', name: 'Medicina general', description: 'Primera orientación y atención integral para personas adultas.', icon: 'stethoscope' },
  { id: 'esp-oftalmo', name: 'Oftalmología', description: 'Evaluación visual y salud de los ojos.', icon: 'eye' },
]

export const doctors: Doctor[] = [
  { id: 'doc-lucia', name: 'Dra. Lucía Torres', initials: 'LT', specialtyIds: ['esp-cardio', 'esp-general'], availability: 'Próximos espacios de demostración esta semana' },
  { id: 'doc-mateo', name: 'Dr. Mateo Rivas', initials: 'MR', specialtyIds: ['esp-neuro'], availability: 'Próximos espacios de demostración mañana' },
  { id: 'doc-valeria', name: 'Dra. Valeria León', initials: 'VL', specialtyIds: ['esp-trauma'], availability: 'Próximos espacios de demostración en 2 días' },
  { id: 'doc-andres', name: 'Dr. Andrés Paz', initials: 'AP', specialtyIds: ['esp-derma', 'esp-general'], availability: 'Próximos espacios de demostración esta semana' },
  { id: 'doc-elena', name: 'Dra. Elena Cruz', initials: 'EC', specialtyIds: ['esp-oftalmo'], availability: 'Próximos espacios de demostración mañana' },
]

function futureDate(days: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export const initialAppointments: DemoAppointment[] = [
  { id: 'demo-1', code: 'DEMO-A7K2', doctorId: 'doc-lucia', specialtyId: 'esp-cardio', date: futureDate(3), time: '09:30:00', durationMinutes: 30, reason: 'Control preventivo de demostración', status: 'confirmed' },
  { id: 'demo-2', code: 'DEMO-P4M8', doctorId: 'doc-valeria', specialtyId: 'esp-trauma', date: futureDate(11), time: '15:00:00', durationMinutes: 30, status: 'confirmed' },
  { id: 'demo-3', code: 'DEMO-H2Q9', doctorId: 'doc-andres', specialtyId: 'esp-derma', date: futureDate(-18), time: '11:00:00', durationMinutes: 30, status: 'attended' },
  { id: 'demo-4', code: 'DEMO-C5N1', doctorId: 'doc-mateo', specialtyId: 'esp-neuro', date: futureDate(-32), time: '10:00:00', durationMinutes: 30, status: 'cancelled' },
  { id: 'demo-5', code: 'DEMO-X8B3', doctorId: 'doc-elena', specialtyId: 'esp-oftalmo', date: futureDate(-45), time: '08:30:00', durationMinutes: 30, status: 'no_show' },
]

export const demoDates = [1, 2, 3, 4, 5].map(futureDate)
export const demoTimes = ['08:30:00', '09:30:00', '10:30:00', '11:30:00', '15:00:00', '16:00:00']

export const bodyRegions = [
  ['cabeza', 'Cabeza', 'zona_cabeza'], ['cuello', 'Cuello', 'zona_cuello'],
  ['hombro_izquierdo', 'Hombro izquierdo', 'zona_hombro_izquierdo'], ['hombro_derecho', 'Hombro derecho', 'zona_hombro_derecho'],
  ['pecho', 'Pecho', 'zona_pecho'], ['abdomen', 'Abdomen', 'zona_abdomen'], ['espalda', 'Espalda', 'zona_espalda'],
  ['brazo_izquierdo', 'Brazo izquierdo', 'zona_brazo_izquierdo'], ['brazo_derecho', 'Brazo derecho', 'zona_brazo_derecho'],
  ['antebrazo_izquierdo', 'Antebrazo izquierdo', 'zona_antebrazo_izquierdo'], ['antebrazo_derecho', 'Antebrazo derecho', 'zona_antebrazo_derecho'],
  ['mano_izquierda', 'Mano izquierda', 'zona_mano_izquierdo'], ['mano_derecha', 'Mano derecha', 'zona_mano_derecho'],
  ['cadera', 'Cadera', 'zona_cadera'], ['muslo_izquierdo', 'Muslo izquierdo', 'zona_muslo_izquierdo'], ['muslo_derecho', 'Muslo derecho', 'zona_muslo_derecho'],
  ['pierna_izquierda', 'Pierna izquierda', 'zona_pierna_izquierdo'], ['pierna_derecha', 'Pierna derecha', 'zona_pierna_derecho'],
  ['pie_izquierdo', 'Pie izquierdo', 'zona_pie_izquierdo'], ['pie_derecho', 'Pie derecho', 'zona_pie_derecho'],
] as const

export function specialtyName(id: string) { return specialties.find((item) => item.id === id)?.name ?? 'Especialidad no disponible' }
export function doctorName(id: string) { return doctors.find((item) => item.id === id)?.name ?? 'Profesional no disponible' }
