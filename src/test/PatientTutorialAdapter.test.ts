import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createPatientTutorialProgressAdapter } from '../services/supabase/patientTutorialProgressAdapter'
import type { Database } from '../types/database'

const userId = '11111111-1111-4111-8111-111111111111'
const row = {
  user_id: userId,
  tutorial_version: 1,
  status: 'in_progress' as const,
  current_step: 2,
  started_at: '2026-11-04T12:00:00.000Z',
  finished_at: null,
  created_at: '2026-11-04T12:00:00.000Z',
  updated_at: '2026-11-04T12:05:00.000Z',
}
const write = {
  tutorialVersion: 1,
  status: 'in_progress' as const,
  currentStep: 2,
  startedAt: '2026-11-04T12:00:00.000Z',
  finishedAt: null,
}

function loadClient(result: { data: typeof row | null; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { client: { from } as unknown as SupabaseClient<Database>, from, select, eq }
}

function mutationClient(kind: 'insert' | 'update', result: { data: typeof row | null; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const selectAfter = vi.fn(() => ({ single }))
  const eq = vi.fn(() => ({ select: selectAfter }))
  const mutation = vi.fn(() => kind === 'insert' ? { select: selectAfter } : { eq })
  const from = vi.fn(() => ({ [kind]: mutation }))
  return { client: { from } as unknown as SupabaseClient<Database>, from, mutation, eq }
}

describe('adapter de progreso del tutorial Paciente', () => {
  it('interpreta una fila ausente como progreso pendiente sin inventar datos', async () => {
    const mocked = loadClient({ data: null, error: null })
    await expect(createPatientTutorialProgressAdapter(mocked.client).load(userId)).resolves.toBeNull()
    expect(mocked.from).toHaveBeenCalledWith('patient_tutorial_progress')
    expect(mocked.eq).toHaveBeenCalledWith('user_id', userId)
  })

  it('mapea una fila propia sin leer contenido sensible del producto', async () => {
    const mocked = loadClient({ data: row, error: null })
    await expect(createPatientTutorialProgressAdapter(mocked.client).load(userId)).resolves.toEqual({
      userId,
      tutorialVersion: 1,
      status: 'in_progress',
      currentStep: 2,
      startedAt: row.started_at,
      finishedAt: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
    expect(mocked.select).toHaveBeenCalledWith('user_id, tutorial_version, status, current_step, started_at, finished_at, created_at, updated_at')
  })

  it('crea con user_id y actualiza sin intentar mutarlo', async () => {
    const created = mutationClient('insert', { data: row, error: null })
    await createPatientTutorialProgressAdapter(created.client).create(userId, write)
    expect(created.mutation).toHaveBeenCalledWith({
      user_id: userId,
      tutorial_version: 1,
      status: 'in_progress',
      current_step: 2,
      started_at: row.started_at,
      finished_at: null,
    })

    const updated = mutationClient('update', { data: row, error: null })
    await createPatientTutorialProgressAdapter(updated.client).update(userId, write)
    expect(updated.mutation).toHaveBeenCalledWith({
      tutorial_version: 1,
      status: 'in_progress',
      current_step: 2,
      started_at: row.started_at,
      finished_at: null,
    })
    expect(JSON.stringify(updated.mutation.mock.calls)).not.toContain('user_id')
    expect(updated.eq).toHaveBeenCalledWith('user_id', userId)
  })

  it('normaliza fallos sin filtrar mensajes internos', async () => {
    const mocked = loadClient({ data: null, error: { message: 'private SQL relation leaked' } })
    const request = createPatientTutorialProgressAdapter(mocked.client).load(userId)
    await expect(request).rejects.toThrow('No pudimos cargar el progreso del tutorial')
    await expect(request).rejects.not.toThrow('private SQL')
  })
})
