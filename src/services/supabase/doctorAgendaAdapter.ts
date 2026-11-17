import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import type { AppointmentStatus } from '../../types/domain'

export interface DoctorAgendaAppointment {
  id: string
  code: string
  date: string
  time: string
  durationMinutes: number
  status: AppointmentStatus
  patientName: string
  specialtyName: string
}

export interface DoctorAgendaAdapter {
  list: () => Promise<DoctorAgendaAppointment[]>
}

type AgendaClient = Pick<SupabaseClient<Database>, 'from'>
type UnknownRecord = Record<string, unknown>

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
const statuses = new Set<AppointmentStatus>(['pending', 'confirmed', 'attended', 'no_show', 'cancelled'])

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year!, month! - 1, day!))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month! - 1 && parsed.getUTCDate() === day
}

function parseAppointment(value: unknown) {
  if (!isRecord(value)
    || typeof value.id !== 'string' || !uuidPattern.test(value.id)
    || typeof value.code !== 'string' || !value.code.trim()
    || typeof value.doctor_id !== 'string' || !uuidPattern.test(value.doctor_id)
    || typeof value.specialty_id !== 'string' || !uuidPattern.test(value.specialty_id)
    || !isDate(value.appointment_date)
    || typeof value.appointment_time !== 'string' || !timePattern.test(value.appointment_time)
    || !Number.isInteger(value.duration_minutes) || Number(value.duration_minutes) <= 0
    || typeof value.status !== 'string' || !statuses.has(value.status as AppointmentStatus)) {
    throw new Error('invalid-agenda-row')
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

export function createDoctorAgendaAdapter(client: AgendaClient): DoctorAgendaAdapter {
  return {
    async list() {
      try {
        const [appointmentsResult, patientsResult, specialtiesResult] = await Promise.all([
          client.from('appointments')
            .select('id, code, doctor_id, specialty_id, appointment_date, appointment_time, duration_minutes, status')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true }),
          client.from('appointment_patient_names').select('appointment_id, first_name, last_name'),
          client.from('specialties').select('id, name'),
        ])
        if (appointmentsResult.error || patientsResult.error || specialtiesResult.error) throw new Error('agenda-query-failed')

        const patients = new Map<string, string>()
        for (const row of patientsResult.data ?? []) {
          if (!row.appointment_id || !uuidPattern.test(row.appointment_id)) continue
          const name = `${row.first_name?.trim() ?? ''} ${row.last_name?.trim() ?? ''}`.trim()
          if (name) patients.set(row.appointment_id, name)
        }
        const specialties = new Map<string, string>()
        for (const row of specialtiesResult.data ?? []) {
          if (uuidPattern.test(row.id) && row.name.trim()) specialties.set(row.id, row.name.trim())
        }

        return (appointmentsResult.data ?? []).map((row) => {
          const appointment = parseAppointment(row)
          return {
            id: appointment.id,
            code: appointment.code,
            date: appointment.date,
            time: appointment.time,
            durationMinutes: appointment.durationMinutes,
            status: appointment.status,
            patientName: patients.get(appointment.id) ?? 'Paciente no disponible',
            specialtyName: specialties.get(appointment.specialtyId) ?? 'Especialidad no disponible',
          }
        })
      } catch {
        throw new Error('No pudimos cargar tu agenda. Inténtalo nuevamente.')
      }
    },
  }
}

export const doctorAgendaAdapter = createDoctorAgendaAdapter(supabase)
