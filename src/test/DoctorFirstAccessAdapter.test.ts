import { describe, expect, it, vi } from 'vitest'
import { createDoctorFirstAccessAdapter, DoctorFirstAccessError } from '../services/supabase/doctorFirstAccessAdapter'

describe('adapter de primer acceso médico', () => {
  it.each(['completed', 'already_completed'] as const)('acepta el estado terminal %s', async (status) => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true, data: { status } }, error: null })
    const adapter = createDoctorFirstAccessAdapter(invoke)

    await expect(adapter.complete('Nueva-clave-2026')).resolves.toBe(status)
    expect(invoke).toHaveBeenCalledWith('doctor-complete-first-access', { body: { password: 'Nueva-clave-2026' } })
  })

  it('expone solo el código saneado FINALIZATION_PENDING de una respuesta Edge', async () => {
    const context = new Response(JSON.stringify({ ok: false, error: { code: 'FINALIZATION_PENDING', detail: 'no debe mostrarse' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
    const adapter = createDoctorFirstAccessAdapter(vi.fn().mockResolvedValue({ data: null, error: { context } }))

    await expect(adapter.complete('Nueva-clave-2026')).rejects.toEqual(expect.objectContaining<Partial<DoctorFirstAccessError>>({ code: 'FINALIZATION_PENDING' }))
  })

  it('falla cerrado ante una respuesta exitosa con forma inesperada', async () => {
    const adapter = createDoctorFirstAccessAdapter(vi.fn().mockResolvedValue({ data: { status: 'completed', secret: 'no' }, error: null }))

    await expect(adapter.complete('Nueva-clave-2026')).rejects.toEqual(expect.objectContaining<Partial<DoctorFirstAccessError>>({ code: 'INTERNAL_ERROR' }))
  })
})
