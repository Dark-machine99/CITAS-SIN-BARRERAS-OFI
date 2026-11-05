import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export const CLINICAL_TIME_ZONE = 'America/Lima'

export type AvailabilityErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'DOCTOR_NOT_FOUND'
  | 'DOCTOR_INACTIVE'
  | 'INVALID_SPECIALTY'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'

export interface AvailabilitySlot {
  time: string
  durationMinutes: number
}

export interface PatientAvailabilityData {
  doctorId: string
  specialtyId: string
  date: string
  timeZone: typeof CLINICAL_TIME_ZONE
  slots: AvailabilitySlot[]
}

export interface PatientAvailabilityInput {
  doctorId: string
  specialtyId: string
  date: string
}

export interface PatientAvailabilityAdapter {
  load: (input: PatientAvailabilityInput) => Promise<PatientAvailabilityData>
}

type AvailabilityClient = Pick<SupabaseClient<Database>, 'rpc'>
type UnknownRecord = Record<string, unknown>

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
const domainErrorCodes = new Set<AvailabilityErrorCode>([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_INPUT',
  'DOCTOR_NOT_FOUND',
  'DOCTOR_INACTIVE',
  'INVALID_SPECIALTY',
])

export class PatientAvailabilityError extends Error {
  constructor(public readonly code: AvailabilityErrorCode) {
    super('No pudimos consultar los horarios disponibles.')
    this.name = 'PatientAvailabilityError'
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

function parseSuccess(value: unknown, input: PatientAvailabilityInput): PatientAvailabilityData {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.data)) throw new PatientAvailabilityError('INTERNAL_ERROR')
  const data = value.data
  if (
    !isUuid(data.doctor_id)
    || !isUuid(data.specialty_id)
    || data.doctor_id !== input.doctorId
    || data.specialty_id !== input.specialtyId
    || !isDate(data.date)
    || data.date !== input.date
    || data.time_zone !== CLINICAL_TIME_ZONE
    || !Array.isArray(data.slots)
  ) throw new PatientAvailabilityError('INTERNAL_ERROR')

  const seen = new Set<string>()
  const slots = data.slots.map((value) => {
    if (!isRecord(value) || typeof value.time !== 'string' || !timePattern.test(value.time) || !Number.isInteger(value.duration_minutes) || Number(value.duration_minutes) <= 0 || seen.has(value.time)) {
      throw new PatientAvailabilityError('INTERNAL_ERROR')
    }
    seen.add(value.time)
    return { time: value.time, durationMinutes: Number(value.duration_minutes) }
  }).sort((left, right) => left.time.localeCompare(right.time))

  return {
    doctorId: data.doctor_id,
    specialtyId: data.specialty_id,
    date: data.date,
    timeZone: CLINICAL_TIME_ZONE,
    slots,
  }
}

function parseDomainError(value: unknown): PatientAvailabilityError | null {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error) || typeof value.error.code !== 'string') return null
  return new PatientAvailabilityError(domainErrorCodes.has(value.error.code as AvailabilityErrorCode) ? value.error.code as AvailabilityErrorCode : 'INTERNAL_ERROR')
}

function mapTransportError(error: unknown) {
  if (isRecord(error) && (error.code === 'PGRST301' || error.code === 'UNAUTHORIZED')) return new PatientAvailabilityError('UNAUTHORIZED')
  return new PatientAvailabilityError('NETWORK_ERROR')
}

export function createPatientAvailabilityAdapter(client: AvailabilityClient): PatientAvailabilityAdapter {
  return {
    async load(input) {
      if (!isUuid(input.doctorId) || !isUuid(input.specialtyId) || !isDate(input.date)) throw new PatientAvailabilityError('INVALID_INPUT')

      try {
        const { data, error } = await client.rpc('get_available_slots', {
          p_doctor_id: input.doctorId,
          p_specialty_id: input.specialtyId,
          p_date: input.date,
        })
        if (error) throw mapTransportError(error)
        const domainError = parseDomainError(data)
        if (domainError) throw domainError
        return parseSuccess(data, input)
      } catch (error) {
        if (error instanceof PatientAvailabilityError) throw error
        throw mapTransportError(error)
      }
    },
  }
}

export function createFutureLimaDates(now: Date = new Date(), count = 7) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINICAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const base = Date.UTC(read('year'), read('month') - 1, read('day'))
  return Array.from({ length: count }, (_, index) => new Date(base + (index + 1) * 86_400_000).toISOString().slice(0, 10))
}

export const patientAvailabilityAdapter = createPatientAvailabilityAdapter(supabase)
