import { supabase } from '../../lib/supabase'

export type DoctorFirstAccessErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'PASSWORD_CHANGE_FAILED'
  | 'FINALIZATION_PENDING'
  | 'INTERNAL_ERROR'

export type DoctorFirstAccessStatus = 'completed' | 'already_completed'

export interface DoctorFirstAccessAdapter {
  complete: (password: string) => Promise<DoctorFirstAccessStatus>
}

type Invoke = (name: string, options: { body: { password: string } }) => Promise<{ data: unknown; error: unknown }>
type UnknownRecord = Record<string, unknown>

const errorCodes = new Set<DoctorFirstAccessErrorCode>([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_INPUT',
  'PASSWORD_CHANGE_FAILED',
  'FINALIZATION_PENDING',
  'INTERNAL_ERROR',
])

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value)

function errorCodeFrom(value: unknown): DoctorFirstAccessErrorCode | null {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error) || typeof value.error.code !== 'string') return null
  return errorCodes.has(value.error.code as DoctorFirstAccessErrorCode) ? value.error.code as DoctorFirstAccessErrorCode : 'INTERNAL_ERROR'
}

async function errorCodeFromInvoke(error: unknown, data: unknown) {
  const direct = errorCodeFrom(data)
  if (direct) return direct
  if (!isRecord(error)) return 'INTERNAL_ERROR' as const
  const context = error.context
  if (!(context instanceof Response)) return 'INTERNAL_ERROR' as const
  try { return errorCodeFrom(await context.clone().json()) ?? 'INTERNAL_ERROR' }
  catch { return 'INTERNAL_ERROR' as const }
}

function successStatus(value: unknown): DoctorFirstAccessStatus | null {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.data)) return null
  return value.data.status === 'completed' || value.data.status === 'already_completed' ? value.data.status : null
}

export class DoctorFirstAccessError extends Error {
  constructor(public readonly code: DoctorFirstAccessErrorCode) {
    super('No pudimos completar el primer acceso médico.')
    this.name = 'DoctorFirstAccessError'
  }
}

export function createDoctorFirstAccessAdapter(invoke: Invoke): DoctorFirstAccessAdapter {
  return {
    async complete(password) {
      const { data, error } = await invoke('doctor-complete-first-access', { body: { password } })
      if (error) throw new DoctorFirstAccessError(await errorCodeFromInvoke(error, data))
      const status = successStatus(data)
      if (!status) throw new DoctorFirstAccessError('INTERNAL_ERROR')
      return status
    },
  }
}

export const doctorFirstAccessAdapter = createDoctorFirstAccessAdapter((name, options) => supabase.functions.invoke(name, options))
