import { describe, expect, it } from 'vitest'
import type { AppointmentDraft } from '../types/domain'
import { firstIncompleteBookingStep, firstMissingBookingField, requiredFieldsBeforeAdvance } from '../features/booking/bookingProgress'

const completeDraft: AppointmentDraft = {
  specialtyId: 'cardiology',
  doctorId: 'doctor-1',
  date: '2026-10-25',
  time: '08:30:00',
  reason: '',
}

describe('progreso de reserva', () => {
  it('encuentra el primer requisito incompleto en ambos modos', () => {
    expect(firstIncompleteBookingStep({ ...completeDraft, specialtyId: null }, false)).toBe(0)
    expect(firstIncompleteBookingStep({ ...completeDraft, doctorId: null }, false)).toBe(1)
    expect(firstIncompleteBookingStep({ ...completeDraft, date: null }, false)).toBe(2)
    expect(firstIncompleteBookingStep({ ...completeDraft, time: null }, false)).toBe(3)
    expect(firstIncompleteBookingStep(completeDraft, false)).toBe(4)

    expect(firstIncompleteBookingStep({ ...completeDraft, doctorId: null }, true)).toBe(0)
    expect(firstIncompleteBookingStep({ ...completeDraft, date: null }, true)).toBe(1)
    expect(firstIncompleteBookingStep(completeDraft, true)).toBe(2)
  })

  it('valida acumulativamente los requisitos de pasos anteriores', () => {
    expect(requiredFieldsBeforeAdvance(false, 0)).toEqual(['specialty'])
    expect(requiredFieldsBeforeAdvance(false, 2)).toEqual(['specialty', 'doctor', 'date'])
    expect(requiredFieldsBeforeAdvance(false, 5)).toEqual(['specialty', 'doctor', 'date', 'time'])
    expect(requiredFieldsBeforeAdvance(true, 0)).toEqual(['specialty', 'doctor'])
    expect(requiredFieldsBeforeAdvance(true, 1)).toEqual(['specialty', 'doctor', 'date', 'time'])
  })

  it('informa el primer campo obligatorio que falta para voz y navegación directa', () => {
    expect(firstMissingBookingField({ ...completeDraft, specialtyId: null, doctorId: null })).toBe('specialty')
    expect(firstMissingBookingField({ ...completeDraft, doctorId: null })).toBe('doctor')
    expect(firstMissingBookingField({ ...completeDraft, date: null })).toBe('date')
    expect(firstMissingBookingField({ ...completeDraft, time: null })).toBe('time')
    expect(firstMissingBookingField(completeDraft)).toBeNull()
  })
})
