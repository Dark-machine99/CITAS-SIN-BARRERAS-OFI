import type { PatientTutorialAction } from './tutorialEvents'

type TutorialAdvance =
  | { type: 'manual' }
  | { type: 'route'; path: string }
  | { type: 'action'; action: PatientTutorialAction }

export interface PatientTutorialStep {
  id: string
  targetIds: readonly string[]
  title: string
  description: string
  advance: TutorialAdvance
  allowInteraction?: boolean
  bookingMode?: boolean
  content?: 'voice-navigation' | 'voice-booking'
}

const routeStep = (id: string, label: string, path: string, description: string): PatientTutorialStep => ({
  id, targetIds: [`patient-nav-${id}-desktop`, `patient-nav-${id}-mobile`, 'patient-menu-button'], title: `Abre ${label}`, description,
  advance: { type: 'route', path }, allowInteraction: true,
})

export const patientTutorialSteps: readonly PatientTutorialStep[] = [
  { id: 'welcome', targetIds: ['patient-header'], title: 'Tu espacio personal', description: 'Recorrerás las ventanas reales y harás una reserva de práctica que nunca se enviará al servidor.', advance: { type: 'manual' } },
  routeStep('inicio', 'Inicio', '/paciente', 'Selecciona Inicio en el menú. El tutorial avanzará cuando la ruta cambie de verdad.'),
  { ...routeStep('reservar', 'Reservar', '/paciente/reservar', 'En Reservar usarás el mismo asistente de 7 pasos o 3 pasos, pero con datos sintéticos.'), bookingMode: true },
  { id: 'practica', targetIds: ['tutorial-practice-booking'], title: 'Completa una reserva de práctica', description: 'Elige especialidad, profesional, fecha y hora; añade un motivo ficticio si quieres y confirma. Nada se guardará como cita.', advance: { type: 'action', action: 'practice-complete' }, allowInteraction: true, bookingMode: true },
  { ...routeStep('citas', 'Mis citas', '/paciente/citas', 'Esta ventana reúne próximas atenciones, historial y detalle.'), bookingMode: true },
  routeStep('medicos', 'Médicos', '/paciente/medicos', 'Aquí puedes buscar profesionales y comenzar una reserva real fuera del tutorial.'),
  routeStep('especialidades', 'Especialidades', '/paciente/especialidades', 'Consulta las especialidades activas del directorio.'),
  routeStep('accesibilidad', 'Accesibilidad', '/paciente/accesibilidad', 'Configura perfiles, contraste, texto, movimiento y ayudas persistentes.'),
  { id: 'accessibility-open', targetIds: ['accessibility-quick-trigger'], title: 'Prueba el panel rápido', description: 'Abre el control de accesibilidad. Voz y Accesibilidad son paneles exclusivos: al abrir uno se cierra el otro.', advance: { type: 'action', action: 'accessibility-open' }, allowInteraction: true },
  routeStep('perfil', 'Mi perfil', '/paciente/perfil', 'Revisa tus datos y preferencias guardadas desde Mi perfil.'),
  { id: 'voice-navigation', targetIds: ['patient-content'], title: 'Practica un comando de navegación', description: 'Di o escribe “ir a mis citas”. Se usa el parser real, pero esta práctica no cambia de ruta ni guarda el comando.', advance: { type: 'action', action: 'voice-navigation-complete' }, content: 'voice-navigation' },
  { id: 'voice-booking', targetIds: ['patient-content'], title: 'Practica una propuesta detallada', description: 'Di o escribe una solicitud con especialidad, fecha y hora. Se resolverá solo contra datos sintéticos y no modificará tu borrador.', advance: { type: 'action', action: 'voice-booking-complete' }, content: 'voice-booking' },
  { id: 'help', targetIds: ['patient-tutorial-help'], title: 'Puedes repetirlo cuando quieras', description: '“Ayuda y tutorial” reinicia esta guía. Al finalizar se limpia toda la práctica.', advance: { type: 'manual' } },
] as const

export const PATIENT_TUTORIAL_VERSION = 1
