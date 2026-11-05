import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export interface DirectorySpecialty {
  id: string
  name: string
  description: string
}

export interface DirectoryDoctor {
  id: string
  name: string
  initials: string
  specialtyIds: string[]
}

export interface PatientDirectoryData {
  specialties: DirectorySpecialty[]
  doctors: DirectoryDoctor[]
}

export interface PatientDirectoryAdapter {
  load: () => Promise<PatientDirectoryData>
}

type DirectoryClient = Pick<SupabaseClient<Database>, 'from'>

const safeDirectoryError = 'No pudimos cargar el directorio médico. Inténtalo nuevamente.'

const isPresent = (value: string | null): value is string => typeof value === 'string' && value.trim().length > 0

async function loadPatientDirectory(client: DirectoryClient): Promise<PatientDirectoryData> {
  const [specialtyResult, doctorResult] = await Promise.all([
    client.from('specialties').select('id, name, description').eq('active', true).order('name', { ascending: true }),
    client.from('doctor_directory').select('doctor_id, first_name, last_name, specialty_id'),
  ])

  if (specialtyResult.error || doctorResult.error) throw new Error(safeDirectoryError)

  const specialties = (specialtyResult.data ?? [])
    .map(({ id, name, description }) => ({ id, name: name.trim(), description: description.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es-PE', { sensitivity: 'base' }))
  const specialtyIds = new Set(specialties.map(({ id }) => id))
  const doctorsById = new Map<string, DirectoryDoctor>()

  for (const row of doctorResult.data ?? []) {
    if (!isPresent(row.doctor_id) || !isPresent(row.first_name) || !isPresent(row.last_name) || !isPresent(row.specialty_id)) {
      throw new Error(safeDirectoryError)
    }
    if (!specialtyIds.has(row.specialty_id)) continue

    const existing = doctorsById.get(row.doctor_id)
    if (existing) {
      if (!existing.specialtyIds.includes(row.specialty_id)) existing.specialtyIds.push(row.specialty_id)
      continue
    }

    const firstName = row.first_name.trim()
    const lastName = row.last_name.trim()
    doctorsById.set(row.doctor_id, {
      id: row.doctor_id,
      name: `${firstName} ${lastName}`,
      initials: `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase(),
      specialtyIds: [row.specialty_id],
    })
  }

  const specialtyOrder = new Map(specialties.map(({ id }, index) => [id, index]))
  const doctors = [...doctorsById.values()]
    .map((doctor) => ({
      ...doctor,
      specialtyIds: doctor.specialtyIds.toSorted((left, right) => (specialtyOrder.get(left) ?? 0) - (specialtyOrder.get(right) ?? 0)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'es-PE', { sensitivity: 'base' }))
  return { specialties, doctors }
}

export function createPatientDirectoryAdapter(client: DirectoryClient): PatientDirectoryAdapter {
  return {
    async load() {
      try { return await loadPatientDirectory(client) }
      catch { throw new Error(safeDirectoryError) }
    },
  }
}

export const patientDirectoryAdapter = createPatientDirectoryAdapter(supabase)
