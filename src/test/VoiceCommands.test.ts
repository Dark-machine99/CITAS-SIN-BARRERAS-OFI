import { describe, expect, it } from 'vitest'
import { normalizeVoiceText, parseVoiceCommand } from '../features/voice/voiceCommands'

describe('comandos de voz locales', () => {
  it('normaliza tildes y puntuación para reconocer órdenes en español', () => {
    expect(normalizeVoiceText('¡Abrir MÉDICOS!')).toBe('abrir medicos')
    expect(parseVoiceCommand('Abrir médicos')).toMatchObject({ type: 'navigate', path: '/paciente/medicos' })
  })

  it('activa y desactiva ayudas de accesibilidad explícitamente', () => {
    expect(parseVoiceCommand('activar lupa')).toEqual({ type: 'accessibility', patch: { magnifier: true }, label: 'lupa de texto' })
    expect(parseVoiceCommand('desactivar alto contraste')).toEqual({ type: 'accessibility', patch: { highContrast: false }, label: 'alto contraste' })
  })

  it('entrega solicitudes parciales al resolver cloud sin inventar identificadores', () => {
    expect(parseVoiceCommand('reservar cardiología')).toEqual({ type: 'booking', request: 'reservar cardiología' })
    expect(parseVoiceCommand('doctora Lucía Torres')).toEqual({ type: 'booking', request: 'doctora Lucía Torres' })
    expect(parseVoiceCommand('hora nueve y treinta')).toEqual({ type: 'booking', request: 'hora nueve y treinta' })
  })

  it('dirige navegación breve a Reservar y mantiene Accesibilidad dentro de Paciente', () => {
    expect(parseVoiceCommand('reservar una cita')).toEqual({ type: 'booking', request: 'reservar una cita' })
    expect(parseVoiceCommand('ir a reservar')).toEqual({ type: 'booking', request: 'ir a reservar' })
    expect(parseVoiceCommand('abrir accesibilidad')).toEqual({ type: 'navigate', path: '/paciente/accesibilidad', label: 'Accesibilidad' })
  })

  it('preserva el texto del motivo y reconoce zonas corporales', () => {
    expect(parseVoiceCommand('motivo Dolor leve en el hombro desde ayer')).toEqual({ type: 'reason', reason: 'Dolor leve en el hombro desde ayer' })
    expect(parseVoiceCommand('seleccionar hombro izquierdo')).toEqual({ type: 'body', regionId: 'hombro_izquierdo', label: 'Hombro izquierdo' })
  })

  it('mantiene la confirmación como una intención separada', () => {
    expect(parseVoiceCommand('confirmar cita')).toEqual({ type: 'confirm' })
    expect(parseVoiceCommand('cancelar reserva')).toEqual({ type: 'cancel' })
    expect(parseVoiceCommand('palabras sin comando')).toEqual({ type: 'unknown' })
  })
})
