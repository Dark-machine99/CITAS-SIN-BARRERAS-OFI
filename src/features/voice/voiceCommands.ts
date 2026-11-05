import { bodyRegions } from '../../services/mock/data'
import type { AccessibilityPreferences } from '../../app/providers/AccessibilityProvider'
import type { DemoRole } from '../../types/medicalAdmin'

type AccessibilityPatch = Partial<Pick<AccessibilityPreferences, 'highContrast' | 'largeCursor' | 'reducedMotion' | 'simpleMode' | 'magnifier' | 'readingGuide' | 'textScale'>>
export type VoiceIntent =
  | { type: 'navigate'; path: string; label: string }
  | { type: 'accessibility'; patch: AccessibilityPatch; label: string }
  | { type: 'booking'; request: string }
  | { type: 'reason'; reason: string }
  | { type: 'body'; regionId: string; label: string }
  | { type: 'confirm' | 'cancel' | 'help' | 'repeat' | 'stop' }
  | { type: 'unknown' }

export function normalizeVoiceText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9:./\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function requestedState(command: string) {
  return !/\b(desactivar|desactiva|apagar|apaga|quitar|quita|sin)\b/.test(command)
}

const spokenHours: Record<string, string> = {
  ocho: '08', nueve: '09', diez: '10', once: '11', quince: '15', dieciseis: '16',
}

export function parseRequestedTime(command: string) {
  const numeric = command.match(/(?:a las|hora)\s+([01]?\d|2[0-3])(?:[:.]| y )?([0-5]\d)?/)
  if (numeric?.[1]) return `${numeric[1].padStart(2, '0')}:${numeric[2] ?? '00'}:00`
  const spoken = command.match(/(?:a las|hora)\s+(ocho|nueve|diez|once|quince|dieciseis)(?:\s+y\s+(media|treinta))?/)
  if (!spoken?.[1]) return null
  return `${spokenHours[spoken[1]]}:${spoken[2] ? '30' : '00'}:00`
}

export function parseVoiceCommand(raw: string, role: DemoRole = 'patient'): VoiceIntent {
  const command = normalizeVoiceText(raw)
  if (!command) return { type: 'unknown' }
  if (/\b(detener|parar|silencio)\b/.test(command)) return { type: 'stop' }
  if (/\b(repetir|repite)\b/.test(command)) return { type: 'repeat' }
  if (/\b(ayuda|comandos|que puedo decir)\b/.test(command)) return { type: 'help' }
  if (/\b(confirmar|confirma)\b.*\b(cita|reserva)\b|\b(cita|reserva)\b.*\b(confirmar|confirma)\b/.test(command)) return { type: 'confirm' }
  if (/\b(cancelar|cancela|descartar)\b.*\b(cita|reserva)\b/.test(command)) return { type: 'cancel' }

  const patientRoutes = [
    { match: /\bmis citas\b/, path: '/paciente/citas', label: 'Mis citas' },
    { match: /\bmedicos?\b/, path: '/paciente/medicos', label: 'Médicos' },
    { match: /\bespecialidades\b/, path: '/paciente/especialidades', label: 'Especialidades' },
    { match: /\bmi perfil\b|\bperfil\b/, path: '/paciente/perfil', label: 'Mi perfil' },
    { match: /\baccesibilidad\b/, path: '/paciente/accesibilidad', label: 'Accesibilidad' },
    { match: /\b(reservar|nueva cita|pedir cita)\b/, path: '/paciente/reservar', label: 'Reservar' },
    { match: /\b(inicio|principal)\b/, path: '/paciente', label: 'Inicio' },
  ]
  const doctorRoutes = [
    { match: /\b(agenda|inicio|principal)\b/, path: '/medico', label: 'Mi agenda' },
    { match: /\baccesibilidad\b/, path: '/accesibilidad', label: 'Accesibilidad' },
  ]
  const adminRoutes = [
    { match: /\b(profesionales|medicos)\b/, path: '/administracion/medicos', label: 'Profesionales' },
    { match: /\bespecialidades\b/, path: '/administracion/especialidades', label: 'Especialidades' },
    { match: /\b(horarios|disponibilidad)\b/, path: '/administracion/horarios', label: 'Horarios' },
    { match: /\bcitas\b/, path: '/administracion/citas', label: 'Citas' },
    { match: /\busuarios\b/, path: '/administracion/usuarios', label: 'Usuarios' },
    { match: /\b(resumen|inicio|principal)\b/, path: '/administracion', label: 'Resumen' },
    { match: /\baccesibilidad\b/, path: '/accesibilidad', label: 'Accesibilidad' },
  ]
  const routes = role === 'doctor' ? doctorRoutes : role === 'admin' ? adminRoutes : patientRoutes

  if (/\balto contraste\b/.test(command)) return { type: 'accessibility', patch: { highContrast: requestedState(command) }, label: 'alto contraste' }
  if (/\bcursor grande\b/.test(command)) return { type: 'accessibility', patch: { largeCursor: requestedState(command) }, label: 'cursor grande' }
  if (/\b(modo simple|vista simple)\b/.test(command)) return { type: 'accessibility', patch: { simpleMode: requestedState(command) }, label: 'modo simple' }
  if (/\b(guia de lectura|guia)\b/.test(command)) return { type: 'accessibility', patch: { readingGuide: requestedState(command) }, label: 'guía de lectura' }
  if (/\b(lupa|magnificador)\b/.test(command)) return { type: 'accessibility', patch: { magnifier: requestedState(command) }, label: 'lupa de texto' }
  if (/\b(reducir movimiento|menos movimiento)\b/.test(command)) return { type: 'accessibility', patch: { reducedMotion: requestedState(command) }, label: 'movimiento reducido' }
  if (/\btexto (grande|mayor)\b/.test(command)) return { type: 'accessibility', patch: { textScale: 'large' }, label: 'texto grande' }
  if (/\btexto (normal|mediano)\b/.test(command)) return { type: 'accessibility', patch: { textScale: 'normal' }, label: 'texto normal' }
  if (/\btexto pequeno\b/.test(command)) return { type: 'accessibility', patch: { textScale: 'small' }, label: 'texto pequeño' }

  if (role !== 'patient') {
    const roleRoute = routes.find((item) => item.match.test(command))
    if (roleRoute) return { type: 'navigate', path: roleRoute.path, label: roleRoute.label }
  }

  if (role === 'patient' && /^(?:ir a |abrir )?(?:reservar|reservar una cita|nueva cita|pedir cita)$/.test(command)) {
    return { type: 'navigate', path: '/paciente/reservar', label: 'Reservar' }
  }

  const reasonMatch = raw.trim().match(/\bmotivo\s+(.+)/i)
  if (reasonMatch?.[1]) return { type: 'reason', reason: reasonMatch[1].trim().slice(0, 280) }

  const region = bodyRegions.find(([, label]) => command.includes(normalizeVoiceText(label)))
  if (region && /\b(zona|molestia|seleccionar|marca|marcar|duele|dolor)\b/.test(command)) return { type: 'body', regionId: region[0], label: region[1] }

  if (role === 'patient' && /\b(reservar|agendar|especialidad|cardiologia|neurologia|traumatologia|dermatologia|oftalmologia|doctor|doctora|fecha|manana|tarde|hora)\b/.test(command)) {
    return { type: 'booking', request: raw.trim() }
  }

  const route = routes.find((item) => item.match.test(command))
  if (route) return { type: 'navigate', path: route.path, label: route.label }
  return { type: 'unknown' }
}
