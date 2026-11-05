import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { AppointmentStatus } from '../../types/domain'
import type { Database } from '../../types/database'

export type AppointmentMutationErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'APPOINTMENT_NOT_FOUND'
  | 'INVALID_APPOINTMENT_STATE'
  | 'INVALID_INPUT'
  | 'DOCTOR_INACTIVE'
  | 'INVALID_SPECIALTY'
  | 'SLOT_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'

export interface PatientAppointmentSummary {
  id: string
  code: string
  doctorId: string
  specialtyId: string
  date: string
  time: string
  durationMinutes: number
  status: AppointmentStatus
}

export interface PatientAppointment extends PatientAppointmentSummary {
  doctorName: string
  specialtyName: string
  reason: string | null
}

export interface PatientAppointmentsAdapter {
  list: () => Promise<PatientAppointment[]>
  cancel: (appointmentId: string) => Promise<PatientAppointmentSummary>
  reschedule: (appointmentId: string, date: string, time: string) => Promise<PatientAppointmentSummary>
}

type AppointmentsClient = Pick<SupabaseClient<Database>, 'from' | 'rpc'>
type UnknownRecord = Record<string, unknown>

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
const statuses = new Set<AppointmentStatus>(['pending', 'confirmed', 'attended', 'no_show', 'cancelled'])
const mutationCodes = new Set<AppointmentMutationErrorCode>([
  'UNAUTHORIZED', 'FORBIDDEN', 'APPOINTMENT_NOT_FOUND', 'INVALID_APPOINTMENT_STATE',
  'INVALID_INPUT', 'DOCTOR_INACTIVE', 'INVALID_SPECIALTY', 'SLOT_UNAVAILABLE',
])

export class PatientAppointmentsError extends Error {
  constructor(public readonly code: AppointmentMutationErrorCode) {
    super('No pudimos actualizar la cita.')
    this.name = 'PatientAppointmentsError'
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

function isTime(value: unknown): value is string {
  return typeof value === 'string' && timePattern.test(value)
}

function parseSummary(value: unknown): PatientAppointmentSummary {
  if (!isRecord(value)
    || !isUuid(value.id)
    || typeof value.code !== 'string'
    || !value.code.trim()
    || !isUuid(value.doctor_id)
    || !isUuid(value.specialty_id)
    || !isDate(value.appointment_date)
    || !isTime(value.appointment_time)
    || !Number.isInteger(value.duration_minutes)
    || Number(value.duration_minutes) <= 0
    || typeof value.status !== 'string'
    || !statuses.has(value.status as AppointmentStatus)) {
    throw new PatientAppointmentsError('INTERNAL_ERROR')
  }
  return {
    id: value.id,
    code: value.code.trim(),
    doctorId: value.doctor_id,
    specialtyId: value.specialty_id,
    date: value.appointment_date,
    time: value.appointment_time,
    durationMinutes: Number(value.duration_minutes),
    status: value.status as AppointmentStatus,
  }
}

function parseMutation(value: unknown) {
  if (!isRecord(value)) throw new PatientAppointmentsError('INTERNAL_ERROR')
  if (value.ok === true && isRecord(value.data)) return parseSummary(value.data)
  if (value.ok === false && isRecord(value.error) && typeof value.error.code === 'string') {
    throw new PatientAppointmentsError(mutationCodes.has(value.error.code as AppointmentMutationErrorCode)
      ? value.error.code as AppointmentMutationErrorCode
      : 'INTERNAL_ERROR')
  }
  throw new PatientAppointmentsError('INTERNAL_ERROR')
}

function transportError(error: unknown) {
  if (isRecord(error) && (error.code === 'PGRST301' || error.code === 'UNAUTHORIZED')) return new PatientAppointmentsError('UNAUTHORIZED')
  return new PatientAppointmentsError('NETWORK_ERROR')
}

async function loadAppointments(client: AppointmentsClient): Promise<PatientAppointment[]> {
  const [appointmentResult, doctorResult, specialtyResult] = await Promise.all([
    client.from('appointments')
      .select('id, code, doctor_id, specialty_id, appointment_date, appointment_time, duration_minutes, reason, status')
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false }),
    client.from('doctor_directory').select('doctor_id, first_name, last_name, specialty_id'),
    client.from('specialties').select('id, name'),
  ])
  if (appointmentResult.error || doctorResult.error || specialtyResult.error) throw new Error('safe-list-error')

  const doctors = new Map<string, string>()
  for (const row of doctorResult.data ?? []) {
    if (row.doctor_id && row.first_name?.trim() && row.last_name?.trim()) {
      doctors.set(row.doctor_id, `${row.first_name.trim()} ${row.last_name.trim()}`)
    }
  }
  const specialties = new Map((specialtyResult.data ?? []).map((row) => [row.id, row.name.trim()]))

  return (appointmentResult.data ?? []).map((row) => {
    const summary = parseSummary(row)
    return {
      ...summary,
      doctorName: doctors.get(summary.doctorId) ?? 'Profesional no disponible',
      specialtyName: specialties.get(summary.specialtyId) ?? 'Especialidad no disponible',
      reason: typeof row.reason === 'string' && row.reason.trim() ? row.reason.trim() : null,
    }
  })
}

type MutationCall =
  | { functionName: 'cancel_appointment'; args: Database['public']['Functions']['cancel_appointment']['Args'] }
  | { functionName: 'reschedule_appointment'; args: Database['public']['Functions']['reschedule_appointment']['Args'] }

async function mutate(client: AppointmentsClient, call: MutationCall) {
  try {
    const { data, error } = call.functionName === 'cancel_appointment'
      ? await client.rpc('cancel_appointment', call.args)
      : await client.rpc('reschedule_appointment', call.args)
    if (error) throw transportError(error)
    return parseMutation(data)
  } catch (error) {
    if (error instanceof PatientAppointmentsError) throw error
    throw transportError(error)
  }
}

export function createPatientAppointmentsAdapter(client: AppointmentsClient): PatientAppointmentsAdapter {
  return {
    async list() {
      try { return await loadAppointments(client) }
      catch { throw new Error('No pudimos cargar tus citas. Inténtalo nuevamente.') }
    },
    async cancel(appointmentId) {
      if (!isUuid(appointmentId)) throw new PatientAppointmentsError('INVALID_INPUT')
      return mutate(client, { functionName: 'cancel_appointment', args: { p_appointment_id: appointmentId } })
    },
    async reschedule(appointmentId, date, time) {
      const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time
      if (!isUuid(appointmentId) || !isDate(date) || !isTime(normalizedTime)) throw new PatientAppointmentsError('INVALID_INPUT')
      return mutate(client, { functionName: 'reschedule_appointment', args: {
        p_appointment_id: appointmentId, p_new_date: date, p_new_time: normalizedTime,
      } })
    },
  }
}

export const patientAppointmentsAdapter = createPatientAppointmentsAdapter(supabase)
