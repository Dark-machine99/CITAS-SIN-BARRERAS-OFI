import type { AppointmentDraft } from '../../types/domain'

export type BookingRequiredField = 'specialty' | 'doctor' | 'date' | 'time'

const standardStepByField: Record<BookingRequiredField, number> = {
  specialty: 0,
  doctor: 1,
  date: 2,
  time: 3,
}

const requiredFields: BookingRequiredField[] = ['specialty', 'doctor', 'date', 'time']

export function firstMissingBookingField(draft: AppointmentDraft) {
  return requiredFields.find((field) => !isBookingFieldComplete(draft, field)) ?? null
}

export function isBookingFieldComplete(draft: AppointmentDraft, field: BookingRequiredField) {
  if (field === 'specialty') return Boolean(draft.specialtyId)
  if (field === 'doctor') return Boolean(draft.doctorId)
  if (field === 'date') return Boolean(draft.date)
  return Boolean(draft.time)
}

export function firstIncompleteBookingStep(draft: AppointmentDraft, simple: boolean) {
  const missing = firstMissingBookingField(draft)
  if (!missing) return simple ? 2 : 4
  if (simple) return missing === 'specialty' || missing === 'doctor' ? 0 : 1
  return standardStepByField[missing]
}

export function requiredFieldsBeforeAdvance(simple: boolean, step: number): BookingRequiredField[] {
  if (simple) return step === 0 ? requiredFields.slice(0, 2) : requiredFields
  if (step <= 0) return requiredFields.slice(0, 1)
  if (step === 1) return requiredFields.slice(0, 2)
  if (step === 2) return requiredFields.slice(0, 3)
  return requiredFields
}
