import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type ReservationErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'DOCTOR_NOT_FOUND'
  | 'DOCTOR_INACTIVE'
  | 'INVALID_SPECIALTY'
  | 'SLOT_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'

export interface PatientReservationInput {
  doctorId: string
  specialtyId: string
  date: string
  time: string
  reason: string
}

export interface PatientReservationData {
  id: string
  code: string
  doctorId: string
  specialtyId: string
  date: string
  time: string
  durationMinutes: number
  status: 'confirmed'
}

export interface PatientReservationAdapter {
  reserve: (input: PatientReservationInput) => Promise<PatientReservationData>
}

type ReservationClient = Pick<SupabaseClient<Database>, 'rpc'>
type UnknownRecord = Record<string, unknown>

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
const domainErrorCodes = new Set<ReservationErrorCode>([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_INPUT',
  'DOCTOR_NOT_FOUND',
  'DOCTOR_INACTIVE',
  'INVALID_SPECIALTY',
  'SLOT_UNAVAILABLE',
])

export class PatientReservationError extends Error {
  constructor(public readonly code: ReservationErrorCode) {
    super('No pudimos confirmar la cita.')
    this.name = 'PatientReservationError'
  }
}

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value)

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year!, month! - 1, day!))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month! - 1 && parsed.getUTCDate() === day
}

export function normalizeReservationReason(value: string) {
  const normalized = value.trim()
  if (normalized.length > 500) throw new PatientReservationError('INVALID_INPUT')
  return normalized || null
}

function parseSuccess(value: unknown, input: PatientReservationInput): PatientReservationData {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.data)) throw new PatientReservationError('INTERNAL_ERROR')
  const data = value.data
  if (
    !isUuid(data.id)
    || typeof data.code !== 'string'
    || !data.code.trim()
    || !isUuid(data.doctor_id)
    || data.doctor_id !== input.doctorId
    || !isUuid(data.specialty_id)
    || data.specialty_id !== input.specialtyId
    || !isDate(data.appointment_date)
    || data.appointment_date !== input.date
    || typeof data.appointment_time !== 'string'
    || !timePattern.test(data.appointment_time)
    || data.appointment_time !== input.time
    || !Number.isInteger(data.duration_minutes)
    || Number(data.duration_minutes) <= 0
    || data.status !== 'confirmed'
  ) throw new PatientReservationError('INTERNAL_ERROR')

  return {
    id: data.id,
    code: data.code,
    doctorId: data.doctor_id,
    specialtyId: data.specialty_id,
    date: data.appointment_date,
    time: data.appointment_time,
    durationMinutes: Number(data.duration_minutes),
    status: data.status,
  }
}

function parseDomainError(value: unknown): PatientReservationError | null {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error) || typeof value.error.code !== 'string') return null
  return new PatientReservationError(domainErrorCodes.has(value.error.code as ReservationErrorCode) ? value.error.code as ReservationErrorCode : 'INTERNAL_ERROR')
}

function mapTransportError(error: unknown) {
  if (isRecord(error) && (error.code === 'PGRST301' || error.code === 'UNAUTHORIZED')) return new PatientReservationError('UNAUTHORIZED')
  return new PatientReservationError('NETWORK_ERROR')
}

export function createPatientReservationAdapter(client: ReservationClient): PatientReservationAdapter {
  return {
    async reserve(input) {
      if (!isUuid(input.doctorId) || !isUuid(input.specialtyId) || !isDate(input.date) || !timePattern.test(input.time)) {
        throw new PatientReservationError('INVALID_INPUT')
      }
      const reason = normalizeReservationReason(input.reason)

      try {
        const { data, error } = await client.rpc('reserve_appointment', {
          p_doctor_id: input.doctorId,
          p_specialty_id: input.specialtyId,
          p_date: input.date,
          p_time: input.time,
          p_reason: reason,
        })
        if (error) throw mapTransportError(error)
        const domainError = parseDomainError(data)
        if (domainError) throw domainError
        return parseSuccess(data, input)
      } catch (error) {
        if (error instanceof PatientReservationError) throw error
        throw mapTransportError(error)
      }
    },
  }
}

export const patientReservationAdapter = createPatientReservationAdapter(supabase)
