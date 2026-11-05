import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type PatientTutorialStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export interface PatientTutorialProgress {
  userId: string
  tutorialVersion: number
  status: PatientTutorialStatus
  currentStep: number
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PatientTutorialProgressWrite {
  tutorialVersion: number
  status: PatientTutorialStatus
  currentStep: number
  startedAt: string | null
  finishedAt: string | null
}

export interface PatientTutorialProgressAdapter {
  load: (userId: string) => Promise<PatientTutorialProgress | null>
  create: (userId: string, progress: PatientTutorialProgressWrite) => Promise<PatientTutorialProgress>
  update: (userId: string, progress: PatientTutorialProgressWrite) => Promise<PatientTutorialProgress>
}

type TutorialRow = Database['public']['Tables']['patient_tutorial_progress']['Row']

const selection = 'user_id, tutorial_version, status, current_step, started_at, finished_at, created_at, updated_at'

function mapRow(row: TutorialRow): PatientTutorialProgress {
  return {
    userId: row.user_id,
    tutorialVersion: row.tutorial_version,
    status: row.status,
    currentStep: row.current_step,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function writePayload(progress: PatientTutorialProgressWrite) {
  return {
    tutorial_version: progress.tutorialVersion,
    status: progress.status,
    current_step: progress.currentStep,
    started_at: progress.startedAt,
    finished_at: progress.finishedAt,
  }
}

function safeError(): Error {
  return new Error('No pudimos guardar el progreso del tutorial')
}

export function createPatientTutorialProgressAdapter(
  client: SupabaseClient<Database> = supabase,
): PatientTutorialProgressAdapter {
  return {
    async load(userId) {
      try {
        const { data, error } = await client
          .from('patient_tutorial_progress')
          .select(selection)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw error
        return data ? mapRow(data) : null
      } catch {
        throw new Error('No pudimos cargar el progreso del tutorial')
      }
    },
    async create(userId, progress) {
      try {
        const { data, error } = await client
          .from('patient_tutorial_progress')
          .insert({ user_id: userId, ...writePayload(progress) })
          .select(selection)
          .single()
        if (error || !data) throw error ?? safeError()
        return mapRow(data)
      } catch {
        throw safeError()
      }
    },
    async update(userId, progress) {
      try {
        const { data, error } = await client
          .from('patient_tutorial_progress')
          .update(writePayload(progress))
          .eq('user_id', userId)
          .select(selection)
          .single()
        if (error || !data) throw error ?? safeError()
        return mapRow(data)
      } catch {
        throw safeError()
      }
    },
  }
}

export const patientTutorialProgressAdapter = createPatientTutorialProgressAdapter()
