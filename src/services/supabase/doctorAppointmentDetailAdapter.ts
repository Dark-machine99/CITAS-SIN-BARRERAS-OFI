import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import type { AppointmentStatus } from '../../types/domain'

export type DoctorAppointmentOutcome = 'attended' | 'no_show'
export type DoctorAppointmentDetailErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'APPOINTMENT_NOT_FOUND'
  | 'APPOINTMENT_NOT_YET_ELIGIBLE'
  | 'INVALID_APPOINTMENT_STATE'
  | 'APPOINTMENT_OUTCOME_CONFLICT'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'

export interface DoctorAppointmentDetail {
  id: string
  code: string
  date: string
  time: string
  durationMinutes: number
  status: AppointmentStatus
  patientName: string
  specialtyName: string
}

export interface DoctorAppointmentDetailAdapter {
  load: (appointmentId: string) => Promise<DoctorAppointmentDetail>
  setOutcome: (appointmentId: string, outcome: DoctorAppointmentOutcome) => Promise<void>
}

type DetailClient = Pick<SupabaseClient<Database>, 'from' | 'rpc'>
type UnknownRecord = Record<string, unknown>

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
const statuses = new Set<AppointmentStatus>(['pending', 'confirmed', 'attended', 'no_show', 'cancelled'])
const outcomeCodes = new Set<DoctorAppointmentDetailErrorCode>([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_INPUT',
  'APPOINTMENT_NOT_FOUND',
  'APPOINTMENT_NOT_YET_ELIGIBLE',
  'INVALID_APPOINTMENT_STATE',
  'APPOINTMENT_OUTCOME_CONFLICT',
])

export class DoctorAppointmentDetailError extends Error {
  constructor(public readonly code: DoctorAppointmentDetailErrorCode) {
    super('No pudimos completar la operación sobre la cita.')
    this.name = 'DoctorAppointmentDetailError'
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

function parseAppointment(value: unknown) {
  if (!isRecord(value)
    || !isUuid(value.id)
    || typeof value.code !== 'string' || !value.code.trim()
    || !isUuid(value.specialty_id)
    || !isDate(value.appointment_date)
    || typeof value.appointment_time !== 'string' || !timePattern.test(value.appointment_time)
    || !Number.isInteger(value.duration_minutes) || Number(value.duration_minutes) <= 0
    || typeof value.status !== 'string' || !statuses.has(value.status as AppointmentStatus)) {
    throw new DoctorAppointmentDetailError('INTERNAL_ERROR')
  }
  return {
    id: value.id,
    code: value.code.trim(),
    specialtyId: value.specialty_id,
    date: value.appointment_date,
    time: value.appointment_time,
    durationMinutes: Number(value.duration_minutes),
    status: value.status as AppointmentStatus,
  }
}

function parseOutcome(value: unknown, appointmentId: string, outcome: DoctorAppointmentOutcome) {
  if (!isRecord(value)) throw new DoctorAppointmentDetailError('INTERNAL_ERROR')
  if (value.ok === true && isRecord(value.data)
    && value.data.id === appointmentId
    && value.data.status === outcome) return
  if (value.ok === false && isRecord(value.error) && typeof value.error.code === 'string') {
    throw new DoctorAppointmentDetailError(outcomeCodes.has(value.error.code as DoctorAppointmentDetailErrorCode)
      ? value.error.code as DoctorAppointmentDetailErrorCode
      : 'INTERNAL_ERROR')
  }
  throw new DoctorAppointmentDetailError('INTERNAL_ERROR')
}

function mappedTransportError(error: unknown) {
  if (isRecord(error) && (error.code === 'PGRST301' || error.code === 'UNAUTHORIZED' || error.status === 401)) {
    return new DoctorAppointmentDetailError('UNAUTHORIZED')
  }
  if (isRecord(error) && (error.code === '42501' || error.code === 'FORBIDDEN' || error.status === 403)) {
    return new DoctorAppointmentDetailError('FORBIDDEN')
  }
  return new DoctorAppointmentDetailError('NETWORK_ERROR')
}

export function createDoctorAppointmentDetailAdapter(client: DetailClient): DoctorAppointmentDetailAdapter {
  return {
    async load(appointmentId) {
      if (!isUuid(appointmentId)) throw new DoctorAppointmentDetailError('INVALID_INPUT')
      try {
        const appointmentResult = await client.from('appointments')
          .select('id, code, specialty_id, appointment_date, appointment_time, duration_minutes, status')
          .eq('id', appointmentId)
          .maybeSingle()
        if (appointmentResult.error) throw mappedTransportError(appointmentResult.error)
        if (!appointmentResult.data) throw new DoctorAppointmentDetailError('APPOINTMENT_NOT_FOUND')
        const appointment = parseAppointment(appointmentResult.data)

        const [patientResult, specialtyResult] = await Promise.all([
          client.from('appointment_patient_names')
            .select('appointment_id, first_name, last_name')
            .eq('appointment_id', appointmentId)
            .maybeSingle(),
          client.from('specialties')
            .select('id, name')
            .eq('id', appointment.specialtyId)
            .maybeSingle(),
        ])
        if (patientResult.error) throw mappedTransportError(patientResult.error)
        if (specialtyResult.error) throw mappedTransportError(specialtyResult.error)

        const patientName = patientResult.data
          ? `${patientResult.data.first_name?.trim() ?? ''} ${patientResult.data.last_name?.trim() ?? ''}`.trim()
          : ''
        const specialtyName = specialtyResult.data?.name.trim() ?? ''
        return {
          id: appointment.id,
          code: appointment.code,
          date: appointment.date,
          time: appointment.time,
          durationMinutes: appointment.durationMinutes,
          status: appointment.status,
          patientName: patientName || 'Paciente no disponible',
          specialtyName: specialtyName || 'Especialidad no disponible',
        }
      } catch (error) {
        if (error instanceof DoctorAppointmentDetailError) throw error
        throw mappedTransportError(error)
      }
    },
    async setOutcome(appointmentId, outcome) {
      if (!isUuid(appointmentId) || (outcome !== 'attended' && outcome !== 'no_show')) {
        throw new DoctorAppointmentDetailError('INVALID_INPUT')
      }
      try {
        const { data, error } = await client.rpc('set_doctor_appointment_outcome', {
          p_appointment_id: appointmentId,
          p_outcome: outcome,
        })
        if (error) throw mappedTransportError(error)
        parseOutcome(data, appointmentId, outcome)
      } catch (error) {
        if (error instanceof DoctorAppointmentDetailError) throw error
        throw mappedTransportError(error)
      }
    },
  }
}

export const doctorAppointmentDetailAdapter = createDoctorAppointmentDetailAdapter(supabase)
